from __future__ import annotations

import logging
import os
import re
import uuid

logger = logging.getLogger(__name__)
from datetime import datetime, timedelta, timezone
from typing import Annotated, Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from fastapi.responses import RedirectResponse
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.core.rate_limit import get_client_ip, rl_hit, rl_is_blocked
from app.database import get_db, set_tenant_context
from app.modules.booking.schemas import BookingConfirm, CounterProposeRequest, ManageBookingOut, PublicRequestCreate, RescheduleRequest
from app.modules.contracts.schemas import PublicContractOut, PublicSignRequest

# Public, unauthenticated endpoints — consumed by the marketing site (getyippie.com).
# Mounted in main.py WITHOUT auth dependencies. Never expose tenant-level data here;
# global aggregates only.
router = APIRouter(prefix="/public", tags=["public"])


@router.get("/sentry-test")
async def sentry_test() -> None:
    """Deliberately raises so Sentry capture can be verified end-to-end.
    Harmless: returns a 500, touches no data. Only useful when SENTRY_DSN is set."""
    raise RuntimeError("Sentry backend verification test — this error is intentional")

# Average agent time saved per automated ticket, in minutes. Tunable later.
AVG_MINUTES_PER_TICKET = 15

# The platform owner — demo follow-up contacts/tickets land in this user's tenant.
ROOT_OWNER_EMAIL = os.getenv("ADMIN_EMAIL", "").lower()

# Cached root-owner tenant id (per process); resolved once from the DB.
_root_tenant_id: Optional[uuid.UUID] = None

# Default demo tenant lifetime (days) — overridable per tenant via demo_expires_at.
DEFAULT_DEMO_DAYS = 7

# Kanban stage used for inbound demo requests in the root owner's pipeline.
DEMO_PIPELINE_STAGE = "Demo"
DEMO_RATE_LIMIT = 5
DEMO_RATE_WINDOW = 3600  # seconds

# One generic 409 for every "this email already has something" case on the
# public provisioning endpoints. Distinct messages ("already registered" vs
# "demo already pending") let an attacker enumerate which addresses have a
# Yippie account — every conflict cause must return this exact string.
GENERIC_CONFLICT_DETAIL = (
    "An account or demo already exists for this email address. "
    "Check your inbox, or contact support if you need help."
)


async def _public_rate_limit(ip: str, bucket: str, limit: int) -> None:
    """Per-endpoint public rate limit. Each bucket has its own counter so a
    burst on one endpoint (e.g. refreshing a booking page) can't lock a visitor
    out of another (e.g. confirming that booking)."""
    key = f"{bucket}:{ip}"
    if await rl_is_blocked(key, limit, DEMO_RATE_WINDOW):
        raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                            detail="Too many requests. Please try again later.")
    await rl_hit(key, DEMO_RATE_WINDOW)


async def _public_rate_limit_check(ip: str, bucket: str, limit: int) -> None:
    """Read-only variant for the provisioning endpoints: raises 429 when the
    per-IP budget is exhausted but does NOT record an attempt. Pair with
    _public_rate_limit_record() after a successful provision so failed attempts
    (validation typos, duplicate-email 409s) never burn the visitor's budget."""
    if await rl_is_blocked(f"{bucket}:{ip}", limit, DEMO_RATE_WINDOW):
        raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                            detail="Too many requests. Please try again later.")


async def _public_rate_limit_record(ip: str, bucket: str) -> None:
    """Count one successful provision against the per-IP budget."""
    await rl_hit(f"{bucket}:{ip}", DEMO_RATE_WINDOW)


# Global provisioning cap. Per IP limiting alone cannot stop an attacker who
# rotates IPs from provisioning unbounded tenants (each demo/signup creates a
# real tenant row, seeds demo data, and sends outbound email via Resend). This
# bounds total tenants created per hour across ALL visitors, per bucket.
# The counter is recorded only after a tenant is actually created, so failed
# attempts (409 duplicate email, validation errors) cannot burn the budget —
# exhausting the cap requires actually creating tenants.
GLOBAL_PROVISION_LIMIT = int(os.getenv("GLOBAL_PROVISION_LIMIT", "20"))  # per bucket per hour


async def _check_global_provision_cap(bucket: str) -> None:
    """Raise 429 when the hourly global tenant-creation budget for *bucket*
    (request_demo / signup) is exhausted. Call before doing any work."""
    if await rl_is_blocked(f"provision_global:{bucket}", GLOBAL_PROVISION_LIMIT, DEMO_RATE_WINDOW):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="We are receiving a high volume of signups right now. Please try again in an hour.",
        )


async def _record_global_provision(bucket: str) -> None:
    """Count one successfully created tenant against the global budget."""
    await rl_hit(f"provision_global:{bucket}", DEMO_RATE_WINDOW)


@router.get("/stats")
async def get_public_stats(db: Annotated[AsyncSession, Depends(get_db)]) -> dict:
    """Global, cross-tenant aggregate of hours saved by Yippie.

    Intentionally NOT tenant-filtered: this powers the marketing site's
    "hours saved globally" counter, summed across all tenants.
    """
    settings = get_settings()
    result = await db.execute(
        text("SELECT COUNT(*) FROM tickets WHERE deleted_at IS NULL")
    )
    tickets_automated = int(result.scalar_one() or 0)
    hours_saved = settings.base_hours_saved + (
        tickets_automated * AVG_MINUTES_PER_TICKET
    ) // 60
    return {
        "hours_saved": hours_saved,
        "tickets_automated": tickets_automated,
    }


class Questionnaire(BaseModel):
    team_size: Optional[str] = None
    industry: Optional[str] = None
    current_tools: Optional[list[str]] = None
    pain_points: Optional[list[str]] = None
    recommended_modules: Optional[list[str]] = None  # what was shown to user
    branding_color: Optional[str] = None  # hex colour picked in /custom configurator
    # Logo from /custom configurator as a data URL; capped to prevent request bloat.
    branding_logo: Optional[str] = Field(default=None, max_length=500_000)


class RequestDemo(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    company_name: str = Field(min_length=1, max_length=200)
    email: EmailStr
    slug: Optional[str] = None
    questionnaire: Optional[Questionnaire] = None
    # Honeypot — hidden field on the marketing form. Humans never fill it;
    # a non-empty value means a bot, and the endpoint fakes success.
    website: Optional[str] = None


class CustomPlanQuestionnaire(BaseModel):
    # Same base shape as Questionnaire (demo/signup forms), plus package fields.
    team_size: Optional[str] = None
    industry: Optional[str] = None
    current_tools: Optional[list[str]] = None
    pain_points: Optional[list[str]] = None
    recommended_modules: Optional[list[str]] = None  # what was shown to user
    plan_selected: Optional[str] = None
    modules_selected: Optional[list[str]] = None
    monthly_total: Optional[int] = None
    billing_cycle: Optional[str] = None  # "monthly" | "annual"
    branding_color: Optional[str] = None  # sidebar colour picked in the mini workspace preview
    # Logo uploaded in the mini workspace preview, as a data URL — kept on the
    # contact record so environment provisioning can reuse it. Size capped so a
    # huge upload can't bloat the request (~375KB of image data).
    branding_logo: Optional[str] = Field(default=None, max_length=500_000)


class CustomPlanRequest(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    company_name: str = Field(min_length=1, max_length=200)
    email: EmailStr
    questionnaire: Optional[CustomPlanQuestionnaire] = None
    # Honeypot — see RequestDemo.website.
    website: Optional[str] = None


CUSTOM_PLAN_PIPELINE_STAGE = "Custom plan"
CUSTOM_PLAN_LABEL = "custom plan"


def _slugify(value: str) -> str:
    """company_name -> lowercase, spaces->hyphens, strip non-alphanumeric."""
    value = (value or "").strip().lower()
    value = re.sub(r"\s+", "-", value)
    value = re.sub(r"[^a-z0-9-]", "", value)
    value = re.sub(r"-{2,}", "-", value).strip("-")
    return value or "demo"


async def _unique_slug(db: AsyncSession, base: str) -> str:
    """Append -2, -3, ... until the slug is free in the tenants table."""
    from app.core.models import Tenant

    candidate = base
    suffix = 2
    while await db.scalar(select(Tenant.id).where(Tenant.slug == candidate)):
        candidate = f"{base}-{suffix}"
        suffix += 1
    return candidate


async def _resolve_root_tenant_id(db: AsyncSession) -> uuid.UUID:
    global _root_tenant_id
    if _root_tenant_id is None:
        from app.core.models import User

        tid = await db.scalar(
            select(User.tenant_id).where(func.lower(User.email) == ROOT_OWNER_EMAIL)
        )
        if tid is None:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Demo provisioning is not configured.",
            )
        _root_tenant_id = tid
    return _root_tenant_id


def _demo_client_base_url() -> str:
    """Public app URL for demo magic links (sandbox in staging, app in production)."""
    settings = get_settings()
    return settings.client_base_url or settings.effective_base_url or settings.app_base_url


# Testing exception — this address always bypasses the "already registered" /
# "already has a demo" checks so demo creation can be exercised end-to-end.
DEMO_BYPASS_EMAILS = {e.strip().lower() for e in os.getenv("DEMO_BYPASS_EMAILS", "").split(",") if e.strip()}


async def _reject_active_user_email(db: AsyncSession, email: str) -> None:
    """Block demo provisioning when the address already belongs to a Yippie account.

    Two cases are rejected — a live (non-demo) tenant, and a pending/active demo —
    but both return the same generic 409 (GENERIC_CONFLICT_DETAIL) so the endpoint
    can't be used to enumerate which addresses have an account.

    The address(es) in ``DEMO_BYPASS_EMAILS`` skip all checks (testing exception).
    """
    from app.core.models import Tenant, User

    email = email.lower().strip()
    if email in DEMO_BYPASS_EMAILS:
        return

    row = await db.execute(
        select(User, Tenant)
        .join(Tenant, Tenant.id == User.tenant_id)
        .where(func.lower(User.email) == email)
    )
    result = row.first()
    if result is None:
        return

    user, tenant = result

    # An existing demo tenant (pending or still within its lifetime) for this email.
    # NOTE: the 409 detail is deliberately identical for every conflict cause —
    # distinct messages would reveal whether an address has a Yippie account.
    if tenant.is_demo:
        now = datetime.now(timezone.utc)
        active_demo = tenant.demo_expires_at is None or tenant.demo_expires_at > now
        if active_demo:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=GENERIC_CONFLICT_DETAIL,
            )
        # Expired demo — fall through and let a fresh demo be provisioned.
        return

    # A live (non-demo) account.
    if user.is_active:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=GENERIC_CONFLICT_DETAIL,
        )


async def _purge_stale_demo_for_email(db: AsyncSession, email: str) -> None:
    """Remove any existing demo tenant (and its users) for ``email``.

    Used so a fresh demo can be provisioned when:
      * the address is a testing-bypass email, or
      * its previous demo has expired / been deactivated.

    Only demo tenants are ever touched here — a live (non-demo) account is left
    untouched (and is already rejected upstream by ``_reject_active_user_email``).
    create_tenant rejects any colliding user, so the old demo tenant (with all of
    its rows) must be wiped first.

    All tenant-scoped tables carry ON DELETE CASCADE FKs to tenants(id)
    (migration tenant_cascade_all), so deleting the tenant row removes every
    child row. (The old manual TENANT_DELETE_ORDER table list no longer exists —
    importing it here used to break this purge at runtime.)
    """
    from app.core.models import Tenant, User

    email = email.lower().strip()
    rows = await db.execute(
        select(User, Tenant)
        .join(Tenant, Tenant.id == User.tenant_id)
        .where(func.lower(User.email) == email)
    )
    seen: set[uuid.UUID] = set()
    for _user, tenant in rows.all():
        if not tenant.is_demo or tenant.id in seen:
            continue  # never delete a live account; wipe each tenant once
        seen.add(tenant.id)
        # Tenant.users has passive_deletes, so the DB level ON DELETE CASCADE removes children.
        await db.delete(tenant)
        await db.flush()


async def _purge_tenant_after_failed_provision(db: AsyncSession, tenant_id: uuid.UUID) -> None:
    """Compensation cleanup for the public provisioning endpoints.

    Deletes a tenant that was created earlier in this request but whose
    provisioning could not be completed (e.g. the onboarding email failed to
    send). Without this the tenant + user rows linger and the visitor's retry
    hits the duplicate 409. Children cascade via the tenants(id) FKs
    (migration tenant_cascade_all).

    Rolls back first, which also clears any SET LOCAL tenant context, so the
    delete runs on the connecting (RLS bypassing) role. Never raises — a failed
    purge is logged and the caller's error response still goes out.
    """
    from app.core.models import Tenant

    try:
        await db.rollback()
        # Tenant.users has passive_deletes, so the DB level ON DELETE CASCADE removes children.
        tenant = await db.get(Tenant, tenant_id)
        if tenant is not None:
            await db.delete(tenant)
            await db.commit()
            logger.warning("Purged partially provisioned tenant %s after a provisioning failure", tenant_id)
    except Exception:
        logger.exception("Failed to purge partially provisioned tenant %s", tenant_id)
        try:
            await db.rollback()
        except Exception:
            pass


async def _ensure_demo_pipeline_stage(db: AsyncSession, tenant_id: uuid.UUID):
    """First kanban column for demo leads — create a Demo stage at position 0 if missing."""
    from app.modules.pipeline.models import PipelineStage

    stage = await db.scalar(
        select(PipelineStage).where(
            PipelineStage.tenant_id == tenant_id,
            func.lower(PipelineStage.name) == DEMO_PIPELINE_STAGE.lower(),
        )
    )
    if stage is not None:
        return stage

    first = await db.scalar(
        select(PipelineStage)
        .where(PipelineStage.tenant_id == tenant_id)
        .order_by(PipelineStage.display_order)
        .limit(1)
    )
    if first is not None:
        return first

    stage = PipelineStage(
        tenant_id=tenant_id,
        name=DEMO_PIPELINE_STAGE,
        color="#5BA4F5",
        display_order=0,
    )
    db.add(stage)
    await db.flush()
    return stage


async def _ensure_stage_by_name(
    db: AsyncSession, tenant_id: uuid.UUID, name: str, color: str
):
    """Find or create a pipeline stage by name for the given tenant.

    Unlike ``find_stage_by_name``, this never returns None — it creates the
    stage if it is missing.  Use for public-flow stages that must exist even
    when the tenant was seeded before the DEFAULT_STAGES list was introduced.
    """
    from app.modules.pipeline.models import PipelineStage

    stage = await db.scalar(
        select(PipelineStage).where(
            PipelineStage.tenant_id == tenant_id,
            func.lower(PipelineStage.name) == name.lower(),
        )
    )
    if stage is not None:
        return stage

    # Determine a sensible display_order (append after current last stage).
    last_order = await db.scalar(
        select(func.max(PipelineStage.display_order)).where(
            PipelineStage.tenant_id == tenant_id
        )
    )
    stage = PipelineStage(
        tenant_id=tenant_id,
        name=name,
        color=color,
        display_order=(last_order or 0) + 1,
    )
    db.add(stage)
    await db.flush()
    return stage


async def _ensure_demo_label(db: AsyncSession, tenant_id: uuid.UUID):
    """Find or create the 'potential client: demo' label in the root tenant."""
    from app.modules.contacts.models import ContactLabel

    label = await db.scalar(
        select(ContactLabel).where(
            ContactLabel.tenant_id == tenant_id,
            ContactLabel.name == "potential client: demo",
        )
    )
    if label is None:
        label = ContactLabel(tenant_id=tenant_id, name="potential client: demo")
        db.add(label)
        await db.flush()
    return label


async def _ensure_custom_plan_label(db: AsyncSession, tenant_id: uuid.UUID):
    """Find or create the 'custom plan' label in the root tenant."""
    from app.modules.contacts.models import ContactLabel

    label = await db.scalar(
        select(ContactLabel).where(
            ContactLabel.tenant_id == tenant_id,
            ContactLabel.name == CUSTOM_PLAN_LABEL,
        )
    )
    if label is None:
        label = ContactLabel(tenant_id=tenant_id, name=CUSTOM_PLAN_LABEL)
        db.add(label)
        await db.flush()
    return label


@router.post("/custom-plan", status_code=201)
async def custom_plan_request(
    body: CustomPlanRequest,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict:
    """Capture a bespoke-package configurator lead — no auth, no demo tenant created.

    Files a Contact + Ticket in the root owner's tenant so the lead shows up
    in the pipeline immediately.
    """
    from app.modules.contacts.models import Contact, contact_label_links
    from app.modules.pipeline.service import _assign_stage
    from app.modules.tickets.models import MessageSource, Ticket, TicketPriority, TicketStatus

    # Honeypot: bots fill the hidden `website` field — fake success, touch nothing.
    if body.website:
        return {"ok": True}

    ip = get_client_ip(request)
    # Read-only check up front; the attempt is only counted after a successful
    # submission so validation failures can't lock a real prospect out.
    await _public_rate_limit_check(ip, "custom_plan", DEMO_RATE_LIMIT)

    root_tenant_id = await _resolve_root_tenant_id(db)
    await set_tenant_context(db, str(root_tenant_id))

    label = await _ensure_custom_plan_label(db, root_tenant_id)
    contact = Contact(
        tenant_id=root_tenant_id,
        full_name=body.name.strip(),
        email=body.email.lower().strip(),
        company=body.company_name.strip(),
    )
    db.add(contact)
    await db.flush()
    await db.execute(
        contact_label_links.insert().values(contact_id=contact.id, label_id=label.id)
    )

    stage = await _ensure_stage_by_name(
        db, root_tenant_id, CUSTOM_PLAN_PIPELINE_STAGE, "#8B5CF6"
    )
    await _assign_stage(db, root_tenant_id, contact.id, stage.id)

    q = body.questionnaire
    if q:
        contact.custom_fields = {
            "team_size": q.team_size,
            "industry": q.industry,
            "current_tools": q.current_tools,
            "pain_points": q.pain_points,
            "recommended_modules": q.recommended_modules,
            "plan_selected": q.plan_selected,
            "modules_selected": q.modules_selected,
            "monthly_total": q.monthly_total,
            "billing_cycle": q.billing_cycle,
            "branding_color": q.branding_color,
            "branding_logo": q.branding_logo,
        }

    q_lines: list[str] = []
    if q:
        if q.team_size:
            q_lines.append(f"Team size: {q.team_size}")
        if q.industry:
            q_lines.append(f"Industry: {q.industry}")
        if q.pain_points:
            q_lines.append(f"Pain points: {', '.join(q.pain_points)}")
        if q.current_tools:
            q_lines.append(f"Current tools: {', '.join(q.current_tools)}")
        if q.recommended_modules:
            q_lines.append(f"Recommended: {', '.join(q.recommended_modules)}")
        if q.plan_selected:
            q_lines.append(f"Plan: {q.plan_selected.capitalize()}")
        if q.modules_selected:
            q_lines.append(f"Modules: {', '.join(q.modules_selected)}")
        if q.monthly_total is not None:
            cycle = q.billing_cycle or "monthly"
            q_lines.append(f"Estimated total: €{q.monthly_total}/mo ({cycle})")
        if q.branding_color:
            q_lines.append(f"Branding colour: {q.branding_color}")
        if q.branding_logo:
            # The data URL itself lives on the contact's custom fields; the
            # ticket only notes that it exists.
            q_lines.append("Logo: uploaded (stored on the contact record)")

    plan_label = q.plan_selected.capitalize() if q and q.plan_selected else "Custom"
    description = (
        f"Custom plan request from {body.name.strip()} ({body.email.lower().strip()}) "
        f"at {body.company_name.strip()}."
    )
    if q_lines:
        description += "\n\nConfiguration:\n" + "\n".join(f"- {line}" for line in q_lines)

    now = datetime.now(timezone.utc)
    db.add(Ticket(
        tenant_id=root_tenant_id,
        contact_id=contact.id,
        subject=f"Custom plan: {body.company_name.strip()} | {plan_label}",
        description=description,
        status=TicketStatus.open,
        priority=TicketPriority.medium,
        source=MessageSource.manual,
        sla_due_at=now + timedelta(days=2),
    ))
    await db.commit()

    await _public_rate_limit_record(ip, "custom_plan")
    return {"ok": True}


@router.post("/request-demo")
async def request_demo(
    body: RequestDemo,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict:
    """Self-serve demo provisioning — no auth.

    Creates an is_demo tenant, seeds its demo data in the request path, then
    sends the magic-link email and files a follow-up Contact + Ticket in the
    root owner's own tenant. If the email cannot be sent the tenant is purged
    so a retry never hits the duplicate 409.
    """
    import secrets

    from sqlalchemy.exc import IntegrityError

    from app.auth.invite import send_demo_ready_email
    from app.auth.tokens import create_signed_token
    from app.core.mailer import ResendNotConfiguredError
    from app.core.models import Tenant, User
    from app.modules.admin.schemas import TenantCreate
    from app.modules.admin.service import create_tenant
    from app.modules.contacts.models import Contact, contact_label_links
    from app.modules.pipeline.service import _assign_stage
    from app.modules.tickets.models import MessageSource, Ticket, TicketPriority, TicketStatus

    # Honeypot: bots fill the hidden `website` field — fake a plausible success
    # response (same shape as the real one) without creating anything.
    if body.website:
        return {
            "tenant_id": str(uuid.uuid4()),
            "slug": _slugify(body.slug or body.company_name),
            "invited": True,
        }

    ip = get_client_ip(request)
    # Read-only per-IP check; the attempt is counted only after a tenant is
    # actually provisioned, so typo'd or duplicate submissions can't lock a
    # prospect out for an hour.
    await _public_rate_limit_check(ip, "request_demo", 5)
    await _check_global_provision_cap("request_demo")

    email = body.email.lower().strip()
    # Rejects live accounts and already-active demos (one generic 409 for both);
    # returns cleanly for new emails, expired demos, and the testing-bypass email.
    await _reject_active_user_email(db, email)

    # Any leftover demo tenant/user for this email (expired demo, or a bypass-email
    # re-test) is wiped so create_tenant's "user already exists" guard won't fire.
    await _purge_stale_demo_for_email(db, email)

    root_tenant_id = await _resolve_root_tenant_id(db)

    base_slug = _slugify(body.slug or body.company_name)
    slug = await _unique_slug(db, base_slug)

    # Random password => create_tenant creates a hashed-password user and
    # suppresses the generic set-password invite email; we send a magic-login
    # demo link instead.
    pwd = secrets.token_urlsafe(32)
    try:
        from app.config import ALL_MODULES
        tenant = await create_tenant(
            db,
            TenantCreate(
                name=body.company_name.strip(),
                slug=slug,
                admin_email=email,
                admin_full_name=body.name.strip(),
                is_demo=True,
                admin_password=pwd,
                enabled_modules=ALL_MODULES,
            ),
        )
    except ValueError:
        # create_tenant's "user already exists" guard — same generic 409 as
        # every other conflict cause (no email enumeration).
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=GENERIC_CONFLICT_DETAIL)
    except IntegrityError:
        # Concurrent duplicate submission raced past the pre-check and tripped
        # the users.email unique constraint — a conflict, not a server error.
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=GENERIC_CONFLICT_DETAIL)
    except ResendNotConfiguredError:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Demo provisioning email is not configured.",
        )

    await _record_global_provision("request_demo")
    await _public_rate_limit_record(ip, "request_demo")

    tenant_id = tenant["id"]
    demo_tenant_uuid = uuid.UUID(str(tenant_id))

    # From here on the demo tenant exists. If any of the steps needed to hand
    # the prospect a working magic link fails, purge the tenant so their retry
    # doesn't hit the duplicate 409 — otherwise they'd be stranded.
    try:
        demo_tenant = await db.get(Tenant, demo_tenant_uuid)
        expires_at = (
            demo_tenant.demo_expires_at
            if demo_tenant and demo_tenant.demo_expires_at
            else datetime.now(timezone.utc) + timedelta(days=DEFAULT_DEMO_DAYS)
        )

        user = await db.scalar(select(User).where(func.lower(User.email) == email))
        if not user:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Demo account could not be created.",
            )

        ttl = expires_at - datetime.now(timezone.utc)
        if ttl.total_seconds() < 60:
            ttl = timedelta(days=DEFAULT_DEMO_DAYS)
        token = create_signed_token(
            "demo_magic",
            ttl,
            user_id=str(user.id),
            email=email,
            tenant_id=str(tenant_id),
        )
        base = _demo_client_base_url()
        if not base:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Demo link URL is not configured.",
            )
        magic_link = f"{base}/demo-enter?token={token}"
    except HTTPException:
        await _purge_tenant_after_failed_provision(db, demo_tenant_uuid)
        raise

    # Seed the demo workspace BEFORE the email goes out, so the prospect's very
    # first click never lands in an empty workspace (the old BackgroundTask
    # raced the email). seed_demo_data opens its own DB session, logs loudly on
    # failure and never raises — a seed failure still leaves the default stages,
    # so we prefer proceeding with the email over stranding the lead.
    from app.core.demo_seeder import seed_demo_data
    await seed_demo_data(demo_tenant_uuid, user.id)

    # If the magic-link email cannot be sent, the tenant would exist with no way
    # in and every retry would 409. Purge it and tell the prospect to retry.
    try:
        await send_demo_ready_email(email, body.name.strip(), magic_link)
    except Exception:
        logger.exception(
            "Failed to send demo ready email to %s — purging demo tenant %s so a retry can succeed",
            email, tenant_id,
        )
        await _purge_tenant_after_failed_provision(db, demo_tenant_uuid)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="We couldn't send your demo email. Please try again in a few minutes.",
        )

    # All remaining writes are in the root tenant — set RLS context so
    # pipeline_stages INSERT/SELECT passes the tenant_isolation policy.
    await set_tenant_context(db, str(root_tenant_id))

    # File a follow-up Contact + Ticket in the root owner's own tenant.
    # Best effort: the demo is live and the magic link is already in the
    # prospect's inbox — a pipeline hiccup here must not fail the request
    # (and must NOT purge the tenant the email now points at).
    try:
        label = await _ensure_demo_label(db, root_tenant_id)
        contact = Contact(
            tenant_id=root_tenant_id,
            full_name=body.name.strip(),
            email=email,
            company=body.company_name.strip(),
        )
        db.add(contact)
        await db.flush()
        await db.execute(
            contact_label_links.insert().values(contact_id=contact.id, label_id=label.id)
        )

        stage = await _ensure_demo_pipeline_stage(db, root_tenant_id)
        await _assign_stage(db, root_tenant_id, contact.id, stage.id)

        # Store questionnaire as structured data on the contact for later reuse
        # (pre-filling signup page, demo nudge emails, etc.)
        if body.questionnaire:
            contact.custom_fields = {
                "team_size": body.questionnaire.team_size,
                "industry": body.questionnaire.industry,
                "current_tools": body.questionnaire.current_tools,
                "pain_points": body.questionnaire.pain_points,
                "recommended_modules": body.questionnaire.recommended_modules,
            }

        q = body.questionnaire
        q_lines = []
        if q:
            if q.team_size:
                q_lines.append(f"Team size: {q.team_size}")
            if q.industry:
                q_lines.append(f"Industry: {q.industry}")
            if q.current_tools:
                q_lines.append(f"Current tools: {', '.join(q.current_tools)}")
            if q.pain_points:
                q_lines.append(f"Pain points: {', '.join(q.pain_points)}")
            if q.recommended_modules:
                q_lines.append(f"Modules recommended: {', '.join(q.recommended_modules)}")

        description = (
            f"Demo requested by {body.name.strip()} ({email}). "
            f"Tenant slug: {slug}. Follow up within 3 days."
        )
        if q_lines:
            description += "\n\nQuestionnaire answers:\n" + "\n".join(f"- {line}" for line in q_lines)

        now = datetime.now(timezone.utc)
        db.add(Ticket(
            tenant_id=root_tenant_id,
            contact_id=contact.id,
            subject=f"Follow up: {body.company_name.strip()} demo",
            description=description,
            status=TicketStatus.open,
            priority=TicketPriority.medium,
            source=MessageSource.manual,
            sla_due_at=now + timedelta(days=3),
        ))
        await db.commit()
    except Exception:
        logger.exception("request_demo: root tenant follow-up failed for %s (demo tenant %s is live)", email, tenant_id)
        await db.rollback()

    import asyncio
    from app.core.mailer import notify_owner
    _q_parts: list[str] = []
    if body.questionnaire:
        _q = body.questionnaire
        if _q.team_size:
            _q_parts.append(f"Team size: {_q.team_size}")
        if _q.industry:
            _q_parts.append(f"Industry: {_q.industry}")
        if _q.current_tools:
            _q_parts.append(f"Tools: {', '.join(_q.current_tools)}")
        if _q.pain_points:
            _q_parts.append(f"Pain points: {', '.join(_q.pain_points)}")
    _q_summary = ("\n\n" + "\n".join(_q_parts)) if _q_parts else ""
    asyncio.create_task(notify_owner(
        subject=f"Demo request: {body.company_name.strip()}",
        body=(
            f"{body.name.strip()} ({email}) from {body.company_name.strip()} requested a demo."
            f"{_q_summary}"
        ),
    ))

    return {"tenant_id": str(tenant_id), "slug": slug, "invited": True}


@router.get("/demo-enter")
async def demo_enter(token: str, response: Response, db: Annotated[AsyncSession, Depends(get_db)]):
    from app.auth.tokens import verify_signed_token
    from app.auth.router import create_access_token, _set_auth_cookie
    from app.core.models import Tenant, User
    from app.core.schemas import UserOut

    claims = verify_signed_token(token, "demo_magic")
    if not claims:
        logger.warning("demo_enter: invalid or expired token (first 20 chars: %s…)", token[:20])
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired demo link.")

    user = await db.get(User, uuid.UUID(claims["user_id"]))
    if not user or not user.is_active:
        logger.warning("demo_enter: user %s not found or inactive", claims.get("user_id"))
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Demo account not found.")

    token_email = (claims.get("email") or "").lower()
    if token_email and token_email != user.email.lower():
        logger.warning("demo_enter: token email %s does not match user email %s", token_email, user.email)
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired demo link.")

    tenant = await db.get(Tenant, user.tenant_id)
    if not tenant or not tenant.is_active:
        logger.warning("demo_enter: tenant %s not found or inactive for user %s", user.tenant_id, user.id)
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Demo account not found.")
    if tenant.is_demo and tenant.demo_expires_at:
        expires = tenant.demo_expires_at
        if expires.tzinfo is None:
            expires = expires.replace(tzinfo=timezone.utc)
        if expires < datetime.now(timezone.utc):
            logger.warning("demo_enter: demo expired at %s for user %s", expires, user.id)
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="This demo has expired.")

    settings = get_settings()
    access_token = create_access_token(str(user.id), settings)
    _set_auth_cookie(response, access_token, settings)
    return {"user": UserOut.model_validate(user).model_dump(mode="json")}


# --------------------------------------------------------------------------- #
# Public booking (BK1) — customer-facing, no auth. Tenant context is set from
# the token's own tenant_id once the token is resolved.
# --------------------------------------------------------------------------- #

# BK7 manage endpoints — MUST be declared before /booking/{token_id} so FastAPI
# does not swallow /booking/manage/{x} as if it were a token_id.

class MeetBookRequest(BaseModel):
    name: str = Field(min_length=1)
    email: EmailStr
    slot_start: datetime
    slot_end: datetime
    message: Optional[str] = None


@router.get("/meet/{slug}")
async def meet_get(
    slug: str,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict:
    """Return available booking slots for a tenant by slug — no auth required."""
    from app.core.models import Tenant
    from app.modules.booking import service as booking_service

    tenant = await db.scalar(
        select(Tenant).where(Tenant.slug == slug, Tenant.is_active == True)  # noqa: E712
    )
    if tenant is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found.")

    await set_tenant_context(db, str(tenant.id))
    settings = await booking_service.get_or_create_settings(db, tenant.id)
    if getattr(settings, "booking_direction", "availability") != "availability":
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="This organisation isn't offering slot booking right now.",
        )
    days_ahead = max(getattr(settings, "booking_window_days", 60) or 60, 14)
    slots = await booking_service.get_available_slots(db, tenant.id, settings, days_ahead)
    return {
        "tenant_name": tenant.name,
        "available_slots": [
            {"start": s.start.isoformat(), "end": s.end.isoformat(), "available": s.available}
            for s in slots
        ],
    }


@router.post("/meet/{slug}", status_code=201)
async def meet_book(
    slug: str,
    body: MeetBookRequest,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict:
    """Book a meeting slot directly from the marketing site — no auth, no pre-existing token."""
    import asyncio

    from app.core.models import Tenant, User, UserRole
    from app.modules.booking import service as booking_service
    from app.modules.calendar.models import CalendarEvent
    from app.modules.contacts.models import Contact

    ip = get_client_ip(request)
    await _public_rate_limit(ip, "meet_book", 10)

    tenant = await db.scalar(
        select(Tenant).where(Tenant.slug == slug, Tenant.is_active == True)  # noqa: E712
    )
    if tenant is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found.")

    await set_tenant_context(db, str(tenant.id))

    email = body.email.lower().strip()
    slot_start = body.slot_start.replace(tzinfo=timezone.utc) if body.slot_start.tzinfo is None else body.slot_start
    slot_end = body.slot_end.replace(tzinfo=timezone.utc) if body.slot_end.tzinfo is None else body.slot_end

    if slot_end <= slot_start:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid time slot.")

    settings = await booking_service.get_or_create_settings(db, tenant.id)
    if getattr(settings, "booking_direction", "availability") != "availability":
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="This organisation isn't offering slot booking right now.",
        )
    use_workers = await booking_service._has_active_workers(db, tenant.id)
    assigned_worker_id = None
    assigned_worker = None

    if use_workers:
        # Serialise concurrent bookings of the same slot so worker capacity can't
        # be oversubscribed (this direct flow previously had no lock at all).
        await db.execute(
            text("SELECT pg_advisory_xact_lock(hashtext(:tenant), hashtext(:slot))"),
            {"tenant": str(tenant.id), "slot": slot_start.isoformat()},
        )
        try:
            _used, assigned_worker_id, assigned_worker = (
                await booking_service.resolve_booking_assignment(
                    db, tenant.id, settings, slot_start, slot_end
                )
            )
        except ValueError as e:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(e))
    else:
        conflict = await db.scalar(
            select(CalendarEvent.id).where(
                CalendarEvent.tenant_id == tenant.id,
                CalendarEvent.start_at < slot_end,
                CalendarEvent.end_at > slot_start,
            )
        )
        if conflict is not None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="That time is no longer available. Please pick another slot.",
            )

    contact = await db.scalar(
        select(Contact).where(
            Contact.tenant_id == tenant.id,
            func.lower(Contact.email) == email,
            Contact.deleted_at == None,  # noqa: E711
        )
    )
    if contact is None:
        contact = Contact(
            tenant_id=tenant.id,
            full_name=body.name.strip(),
            email=email,
        )
        db.add(contact)
        await db.flush()

    admin = await db.scalar(
        select(User).where(
            User.tenant_id == tenant.id,
            User.role == UserRole.admin,
            User.is_active == True,  # noqa: E712
        ).limit(1)
    )
    if admin is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Booking not available right now.",
        )

    event = CalendarEvent(
        tenant_id=tenant.id,
        title=f"Meeting with {contact.full_name}",
        start_at=slot_start,
        end_at=slot_end,
        contact_id=contact.id,
        created_by=admin.id,
        assigned_worker_id=assigned_worker_id,
        description=body.message or None,
    )
    db.add(event)

    # [FLOW8] the global post-booking stage move was retired here — it's now a
    # flow on the booking_created trigger. This public booking path does not emit
    # that event, so it no longer moves the contact's pipeline stage.

    await db.commit()
    await db.refresh(event)

    try:
        asyncio.create_task(
            booking_service._notify_customer_confirmed(event, contact, tenant)
        )
        asyncio.create_task(
            booking_service._notify_agent_confirmed(event, contact, admin)
        )
        if assigned_worker is not None and assigned_worker.id != admin.id:
            asyncio.create_task(
                booking_service._notify_agent_confirmed(event, contact, assigned_worker)
            )
    except Exception:
        pass

    from app.core.mailer import notify_owner
    asyncio.create_task(notify_owner(
        subject=f"{contact.full_name} booked a call",
        body=(
            f"{contact.full_name} ({contact.email or 'no email'}) just booked a call.\n\n"
            f"Slot: {booking_service._format_slot(event.start_at, event.end_at)}"
        ),
    ))

    return {
        "event_id": str(event.id),
        "start_at": event.start_at.isoformat(),
        "end_at": event.end_at.isoformat(),
    }


# --------------------------------------------------------------------------- #
# Customer requested bookings — public /request/{slug} (reverse direction)
# --------------------------------------------------------------------------- #
@router.get("/request/{slug}")
async def request_get(
    slug: str,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict:
    """Info for the public 'request a time' page — no auth. Only served when the
    tenant is in the 'requests' booking direction."""
    from app.core.models import Tenant
    from app.modules.booking import service as booking_service

    tenant = await db.scalar(
        select(Tenant).where(Tenant.slug == slug, Tenant.is_active == True)  # noqa: E712
    )
    if tenant is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found.")

    await set_tenant_context(db, str(tenant.id))
    settings = await booking_service.get_or_create_settings(db, tenant.id)
    if getattr(settings, "booking_direction", "availability") != "requests":
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="This organisation isn't accepting appointment requests right now.",
        )
    return {
        "tenant_name": tenant.name,
        "min_notice_days": getattr(settings, "min_notice_days", 0),
        "booking_window_days": getattr(settings, "booking_window_days", 60),
    }


@router.post("/request/{slug}", status_code=201)
async def request_create(
    slug: str,
    body: PublicRequestCreate,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict:
    """Create a customer appointment request — no auth, no pre-existing token."""
    import asyncio

    from app.core.mailer import notify_owner
    from app.core.models import Tenant
    from app.modules.booking import service as booking_service
    from app.modules.contacts.models import Contact

    ip = get_client_ip(request)
    await _public_rate_limit(ip, "request_create", 10)

    tenant = await db.scalar(
        select(Tenant).where(Tenant.slug == slug, Tenant.is_active == True)  # noqa: E712
    )
    if tenant is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found.")

    await set_tenant_context(db, str(tenant.id))
    settings = await booking_service.get_or_create_settings(db, tenant.id)
    if getattr(settings, "booking_direction", "availability") != "requests":
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="This organisation isn't accepting appointment requests right now.",
        )

    email = body.email.lower().strip()
    slots = []
    for s in body.requested_slots:
        st = s.start.replace(tzinfo=timezone.utc) if s.start.tzinfo is None else s.start
        en = s.end.replace(tzinfo=timezone.utc) if s.end.tzinfo is None else s.end
        if en <= st:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid time slot.")
        slots.append({"start": st.isoformat(), "end": en.isoformat()})

    contact = await db.scalar(
        select(Contact).where(
            Contact.tenant_id == tenant.id,
            func.lower(Contact.email) == email,
            Contact.deleted_at == None,  # noqa: E711
        )
    )
    if contact is None:
        contact = Contact(tenant_id=tenant.id, full_name=body.name.strip(), email=email)
        db.add(contact)
        await db.flush()

    req = await booking_service.create_request(
        db, tenant.id, contact.id, slots, body.message or None
    )

    first = slots[0]
    asyncio.create_task(notify_owner(
        subject=f"{contact.full_name} requested an appointment",
        body=(
            f"{contact.full_name} ({contact.email or 'no email'}) requested an appointment.\n\n"
            f"Preferred: {first['start']}\n"
            f"{('Note: ' + body.message) if body.message else ''}"
        ),
    ))
    return {"request_id": str(req.id)}


class AIDemoRequest(BaseModel):
    raw_message: str = Field(min_length=1, max_length=4000)


@router.post("/ai-demo")
async def ai_demo(body: AIDemoRequest, request: Request) -> dict:
    """Live AI demo — no auth. Scans a pasted message and returns structured ticket fields."""
    from app.modules.inbox.ai_scanner import scan_message
    from app.config import get_settings

    ip = get_client_ip(request)
    await _public_rate_limit(ip, "ai_demo", 10)

    settings = get_settings()
    if not settings.anthropic_api_key:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="AI service not configured.",
        )

    result = await scan_message("demo@example.com", body.raw_message.strip(), "email")
    return {
        "subject": result.subject,
        "description": result.description,
        "priority": result.priority,
        "category": result.category,
    }


@router.get("/booking/manage/{manage_token}", response_model=ManageBookingOut)
async def public_get_manage(
    manage_token: uuid.UUID,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> ManageBookingOut:
    from app.core.models import Tenant
    from app.modules.booking import service as booking_service
    from app.modules.calendar.models import CalendarEvent
    from app.modules.contacts.models import Contact

    ip = get_client_ip(request)
    await _public_rate_limit(ip, "booking_view", 30)

    token = await booking_service.get_manage_token(db, manage_token)
    if token is None or token.booked_at is None or token.event_id is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="This manage link is invalid or the booking has been cancelled.",
        )

    await set_tenant_context(db, str(token.tenant_id))

    event = await db.get(CalendarEvent, token.event_id)
    if event is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Calendar event not found.",
        )

    contact = await db.get(Contact, token.contact_id)
    tenant = await db.get(Tenant, token.tenant_id)
    settings = await booking_service.get_or_create_settings(db, token.tenant_id)

    cancel_edit_hours_before = settings.cancel_edit_hours_before
    from datetime import timedelta, timezone as _tz
    start = event.start_at
    if start.tzinfo is None:
        start = start.replace(tzinfo=_tz.utc)
    from datetime import datetime as _dt
    now = _dt.now(_tz.utc)
    locked = (start - now) <= timedelta(hours=cancel_edit_hours_before)

    days_ahead = max(getattr(settings, "booking_window_days", 60) or 60, 14)
    available = await booking_service.get_available_slots(
        db, token.tenant_id, settings, days_ahead, agent_user_id=token.created_by
    )

    first_name = ((contact.full_name if contact else "") or "there").split(" ")[0]

    return ManageBookingOut(
        tenant_name=tenant.name if tenant else "Yippie",
        contact_first_name=first_name,
        start_at=event.start_at,
        end_at=event.end_at,
        locked=locked,
        available_slots=available,
        cancel_edit_hours_before=cancel_edit_hours_before,
    )


@router.post("/booking/manage/{manage_token}/reschedule", status_code=200)
async def public_reschedule(
    manage_token: uuid.UUID,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    body: RescheduleRequest,
) -> dict:
    from app.modules.booking import service as booking_service

    ip = get_client_ip(request)
    await _public_rate_limit(ip, "booking_manage", 10)

    token = await booking_service.get_manage_token(db, manage_token)
    if token is None or token.booked_at is None or token.event_id is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="This manage link is invalid or the booking has been cancelled.",
        )

    await set_tenant_context(db, str(token.tenant_id))

    try:
        event = await booking_service.reschedule_booking(
            db, token, body.slot_start, body.slot_end
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

    return {"event_id": str(event.id), "start_at": event.start_at, "end_at": event.end_at}


@router.post("/booking/manage/{manage_token}/cancel", status_code=200)

async def public_cancel(
    manage_token: uuid.UUID,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict:
    from app.modules.booking import service as booking_service

    ip = get_client_ip(request)
    await _public_rate_limit(ip, "booking_manage", 10)

    token = await booking_service.get_manage_token(db, manage_token)
    if token is None or token.booked_at is None or token.event_id is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="This manage link is invalid or the booking has been cancelled.",
        )

    await set_tenant_context(db, str(token.tenant_id))

    try:
        await booking_service.cancel_booking(db, token)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

    return {"status": "cancelled"}


@router.get("/booking/{token_id}")
async def public_get_booking(
    token_id: uuid.UUID,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    from app.core.models import Tenant
    from app.modules.booking import service as booking_service
    from app.modules.booking.schemas import PublicBookingOut, SlotProposal
    from app.modules.contacts.models import Contact

    ip = get_client_ip(request)
    await _public_rate_limit(ip, "booking_view", 30)

    token = await booking_service.get_token(db, token_id)
    if token is None or booking_service.token_status(token) != "pending":
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="This booking link has expired or has already been used.",
        )

    # Scope the rest of the request to the token's tenant (activates RLS).
    await set_tenant_context(db, str(token.tenant_id))

    tenant = await db.get(Tenant, token.tenant_id)
    contact = await db.get(Contact, token.contact_id)
    settings = await booking_service.get_or_create_settings(db, token.tenant_id)
    days_ahead = max(getattr(settings, "booking_window_days", 60) or 60, 14)
    available = await booking_service.get_available_slots(
        db, token.tenant_id, settings, days_ahead, agent_user_id=token.created_by
    )

    proposed = (
        [SlotProposal(start=s["start"], end=s["end"]) for s in token.proposed_slots]
        if token.proposed_slots
        else None
    )
    first_name = ((contact.full_name if contact else "") or "there").split(" ")[0]

    return PublicBookingOut(
        tenant_name=tenant.name if tenant else "Yippie",
        contact_first_name=first_name,
        mode=token.mode,
        proposed_slots=proposed,
        message=token.message,
        expires_at=token.expires_at,
        available_slots=available,
    )


@router.post("/booking/{token_id}/counter-propose", status_code=201)
async def public_counter_propose(
    token_id: uuid.UUID,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    body: CounterProposeRequest,
):
    from app.modules.booking import service as booking_service

    ip = get_client_ip(request)
    await _public_rate_limit(ip, "booking_manage", 10)

    token = await booking_service.get_token(db, token_id)
    if token is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="This booking link has expired or has already been used.",
        )

    current_status = booking_service.token_status(token)
    if current_status != "pending":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"This booking link cannot accept proposals (status: {current_status}).",
        )

    await set_tenant_context(db, str(token.tenant_id))
    await booking_service.counter_propose(db, token, body.slots)
    return {"status": "counter_proposed"}


@router.post("/booking/{token_id}/confirm")
async def public_confirm_booking(
    token_id: uuid.UUID,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    body: BookingConfirm,
):
    from app.modules.booking import service as booking_service

    ip = get_client_ip(request)
    await _public_rate_limit(ip, "booking_manage", 10)

    token = await booking_service.get_token(db, token_id)
    if token is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="This booking link has expired or has already been used.",
        )

    await set_tenant_context(db, str(token.tenant_id))

    try:
        event = await booking_service.confirm_booking(
            db, token, body.slot_start, body.slot_end
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

    return {"event_id": str(event.id), "start_at": event.start_at, "end_at": event.end_at}


@router.get("/calendar/{feed_token}.ics")
async def export_user_calendar(
    feed_token: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> Response:
    """Personal iCal feed — unauthenticated. Returns the user's Yippie calendar events
    and confirmed bookings as a .ics file for subscription in Apple Calendar / Outlook."""
    import icalendar as _ical

    from app.core.models import User
    from app.modules.booking.models import BookingToken
    from app.modules.calendar.models import CalendarEvent, CalendarEventInvitation

    user = await db.scalar(
        select(User).where(User.calendar_feed_token == feed_token)
    )
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Feed not found.")

    await set_tenant_context(db, str(user.tenant_id))

    cal = _ical.Calendar()
    cal.add("PRODID", "-//Yippie//Calendar//EN")
    cal.add("VERSION", "2.0")
    cal.add("CALSCALE", "GREGORIAN")
    cal.add("X-WR-CALNAME", f"{user.full_name} | Yippie")

    # Own events + accepted invitations
    own_events_result = await db.execute(
        select(CalendarEvent).where(
            CalendarEvent.tenant_id == user.tenant_id,
            CalendarEvent.created_by == user.id,
        )
    )
    own_event_ids = {e.id for e in own_events_result.scalars().all()}

    accepted_result = await db.execute(
        select(CalendarEventInvitation.event_id).where(
            CalendarEventInvitation.tenant_id == user.tenant_id,
            CalendarEventInvitation.invitee_id == user.id,
            CalendarEventInvitation.status == "accepted",
        )
    )
    accepted_ids = {r.event_id for r in accepted_result.all()}

    all_event_ids = own_event_ids | accepted_ids
    if all_event_ids:
        events_result = await db.execute(
            select(CalendarEvent).where(CalendarEvent.id.in_(all_event_ids))
        )
        for event in events_result.scalars().all():
            vevent = _ical.Event()
            vevent.add("UID", f"{event.id}@yippie")
            vevent.add("SUMMARY", event.title or "Meeting")
            vevent.add("DTSTART", event.start_at)
            vevent.add("DTEND", event.end_at)
            if event.description:
                vevent.add("DESCRIPTION", event.description)
            vevent.add("DTSTAMP", event.created_at)
            cal.add_component(vevent)

    # Confirmed bookings where this user is the agent
    tokens_result = await db.execute(
        select(BookingToken).where(
            BookingToken.tenant_id == user.tenant_id,
            BookingToken.created_by == user.id,
            BookingToken.booked_at.isnot(None),
            BookingToken.event_id.isnot(None),
        )
    )
    booked_event_ids = {t.event_id for t in tokens_result.scalars().all() if t.event_id not in all_event_ids}
    if booked_event_ids:
        booked_result = await db.execute(
            select(CalendarEvent).where(CalendarEvent.id.in_(booked_event_ids))
        )
        for event in booked_result.scalars().all():
            vevent = _ical.Event()
            vevent.add("UID", f"{event.id}@yippie")
            vevent.add("SUMMARY", event.title or "Meeting")
            vevent.add("DTSTART", event.start_at)
            vevent.add("DTEND", event.end_at)
            if event.description:
                vevent.add("DESCRIPTION", event.description)
            vevent.add("DTSTAMP", event.created_at)
            cal.add_component(vevent)

    ical_bytes = cal.to_ical()
    return Response(
        content=ical_bytes,
        media_type="text/calendar; charset=utf-8",
        headers={"Content-Disposition": "attachment; filename=yippie.ics"},
    )


class LeadSubmit(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    email: EmailStr
    phone: str | None = Field(default=None, max_length=50)
    message: str | None = Field(default=None, max_length=2000)


@router.post("/lead/{slug}", status_code=201)
async def submit_lead(
    slug: str,
    body: LeadSubmit,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict:
    """Public lead capture endpoint — called by the embeddable lead widget."""
    from app.core.models import Tenant
    from app.modules.contacts.models import Contact
    from app.modules.pipeline.models import PipelineStage
    from app.modules.pipeline.service import _assign_stage

    ip = get_client_ip(request)
    await _public_rate_limit(ip, "lead", 10)

    tenant = await db.scalar(
        select(Tenant).where(Tenant.slug == slug, Tenant.is_active == True)  # noqa: E712
    )
    if tenant is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found.")

    if not tenant.lead_widget_save_contact:
        return {"ok": True}

    await set_tenant_context(db, str(tenant.id))

    email = body.email.lower().strip()
    contact = await db.scalar(
        select(Contact).where(
            Contact.tenant_id == tenant.id,
            func.lower(Contact.email) == email,
            Contact.deleted_at == None,  # noqa: E711
        )
    )
    if contact is None:
        contact = Contact(
            tenant_id=tenant.id,
            full_name=body.name.strip(),
            email=email,
            phone=body.phone.strip() if body.phone else None,
            notes=body.message.strip() if body.message else None,
        )
        db.add(contact)
        await db.flush()

    if tenant.lead_widget_stage_id is not None:
        stage = await db.scalar(
            select(PipelineStage).where(
                PipelineStage.id == tenant.lead_widget_stage_id,
                PipelineStage.tenant_id == tenant.id,
            )
        )
        if stage is not None:
            await _assign_stage(db, tenant.id, contact.id, stage.id)

    await db.commit()
    return {"ok": True}


# ---------------------------------------------------------------------------
# JS snippet ingest — [SALES-MOD1] + [SAAS-MOD1]
# ---------------------------------------------------------------------------

_TRACK_RATE_LIMIT = 200
_TRACK_RATE_WINDOW = 60  # seconds


class TrackingEventIn(BaseModel):
    event_type: str = Field(min_length=1, max_length=100)
    properties: dict = {}
    session_id: str | None = None
    sdk_version: str | None = None


class TrackingBatch(BaseModel):
    token: uuid.UUID
    anonymous_id: str = Field(default="", max_length=200)
    contact_email: str | None = None
    # 'saas' or 'commerce'; the snippet sets this automatically
    event_domain: str = Field(default="saas", pattern="^(saas|commerce)$")
    events: list[TrackingEventIn] = Field(default_factory=list, max_length=50)


@router.post("/track", include_in_schema=False)
async def track_events(
    body: TrackingBatch,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict:
    """Unauthenticated event ingest for sales.js and saas.js snippets.

    Authenticates via Tenant.tracking_token; writes to saas_events; optionally
    links anonymous_id → contact by email via saas_identity.
    """
    from app.modules.saas.models import SaasEvent, SaasIdentity
    from app.modules.contacts.models import Contact

    # Rate limit per IP
    client_ip = get_client_ip(request)
    if await rl_is_blocked(f"track:{client_ip}", _TRACK_RATE_LIMIT, _TRACK_RATE_WINDOW):
        raise HTTPException(status_code=429, detail="Too many requests")
    await rl_hit(f"track:{client_ip}", _TRACK_RATE_WINDOW)

    # Resolve tenant by tracking_token (no RLS needed — token lookup is global)
    from app.core.models import Tenant as TenantModel
    tenant_row = await db.execute(
        select(TenantModel).where(TenantModel.tracking_token == body.token)
    )
    tenant = tenant_row.scalar_one_or_none()
    if tenant is None:
        raise HTTPException(status_code=401, detail="Invalid tracking token")
    if not tenant.is_active:
        raise HTTPException(status_code=403, detail="Tenant inactive")

    # Optionally link anonymous_id → contact by email
    contact_id: uuid.UUID | None = None
    if body.contact_email:
        await set_tenant_context(db, str(tenant.id))
        contact_row = await db.execute(
            select(Contact).where(
                Contact.tenant_id == tenant.id,
                Contact.email == body.contact_email.lower().strip(),
                Contact.deleted_at.is_(None),
            )
        )
        contact = contact_row.scalar_one_or_none()
        if contact and body.anonymous_id:
            # Upsert identity mapping
            existing_identity = await db.execute(
                select(SaasIdentity).where(
                    SaasIdentity.tenant_id == tenant.id,
                    SaasIdentity.anonymous_id == body.anonymous_id,
                )
            )
            if not existing_identity.scalar_one_or_none():
                db.add(SaasIdentity(
                    tenant_id=tenant.id,
                    anonymous_id=body.anonymous_id,
                    contact_id=contact.id,
                ))
            contact_id = contact.id

    # Resolve contact_id from existing identity mapping if not yet known
    if contact_id is None and body.anonymous_id:
        await set_tenant_context(db, str(tenant.id))
        ident_row = await db.execute(
            select(SaasIdentity).where(
                SaasIdentity.tenant_id == tenant.id,
                SaasIdentity.anonymous_id == body.anonymous_id,
            )
        )
        ident = ident_row.scalar_one_or_none()
        if ident:
            contact_id = ident.contact_id

    # Write events
    await set_tenant_context(db, str(tenant.id))
    from app.core.flow_events import emit_flow_event

    for ev in body.events:
        db.add(SaasEvent(
            tenant_id=tenant.id,
            contact_id=contact_id,
            anonymous_id=body.anonymous_id,
            event_domain=body.event_domain,
            event_type=ev.event_type,
            properties=ev.properties,
            session_id=ev.session_id,
            sdk_version=ev.sdk_version,
        ))
        # [FLOW7] a tracked signup fires the saas_signup flow trigger.
        if ev.event_type == "signup":
            await emit_flow_event(
                db, tenant.id, "saas_signup",
                entity_type="saas_event",
                contact_id=contact_id,
                payload={
                    "anonymous_id": body.anonymous_id,
                    "email": body.contact_email,
                    "contact_id": contact_id,
                },
            )

    await db.commit()
    return {"ok": True, "ingested": len(body.events)}


# ── Questionnaire Lead capture ────────────────────────────────────────────────

class QuestionnaireLead(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    email: EmailStr
    company: str = Field(min_length=1, max_length=200)
    questionnaire: Optional[Questionnaire] = None


@router.post("/questionnaire-lead", status_code=201)
async def questionnaire_lead(
    body: QuestionnaireLead,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict:
    """Capture a questionnaire lead from getyippie.com into the root tenant Kanban.

    Called after step 1 of the site questionnaire (before they commit to requesting
    a demo). Creates or updates the contact at 'Questionnaire Lead' stage.
    """
    from app.database import set_tenant_context
    from app.modules.contacts.models import Contact
    from app.modules.pipeline.service import _assign_stage

    ip = get_client_ip(request)
    await _public_rate_limit(ip, "lead", 10)

    root_tenant_id = await _resolve_root_tenant_id(db)
    await set_tenant_context(db, str(root_tenant_id))

    email = body.email.lower().strip()
    contact = await db.scalar(
        select(Contact).where(
            Contact.tenant_id == root_tenant_id,
            Contact.email == email,
            Contact.deleted_at.is_(None),
        )
    )
    if contact is None:
        contact = Contact(
            tenant_id=root_tenant_id,
            full_name=body.name.strip(),
            email=email,
            company=body.company.strip(),
        )
        db.add(contact)
        await db.flush()

    if body.questionnaire:
        contact.custom_fields = {
            "team_size": body.questionnaire.team_size,
            "industry": body.questionnaire.industry,
            "current_tools": body.questionnaire.current_tools,
            "pain_points": body.questionnaire.pain_points,
            "recommended_modules": body.questionnaire.recommended_modules,
        }

    stage = await _ensure_stage_by_name(db, root_tenant_id, "Questionnaire Lead", "#94a3b8")
    await _assign_stage(db, root_tenant_id, contact.id, stage.id)

    await db.commit()
    return {"ok": True}


# ── Self-serve signup ─────────────────────────────────────────────────────────

# [TRIAL30] Length of the free trial every self serve signup starts on.
TRIAL_DAYS = 30


class SignupRequest(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    company_name: str = Field(min_length=1, max_length=200)
    email: EmailStr
    # Optional by design: a password chosen at signup could have been chosen by
    # anyone who typed the email (pre-registration takeover). When absent, a
    # random one is generated (demo pattern) and the user picks their own AFTER
    # entering via the emailed link — i.e. only the inbox owner ever sets it.
    password: Optional[str] = Field(default=None, min_length=8, max_length=128)
    plan: Literal["founder", "starter", "growth", "pro"] = "starter"
    enabled_modules: list[str] = Field(default=[], max_length=20)
    questionnaire: Optional[Questionnaire] = None
    from_demo_token: Optional[str] = None
    # Honeypot — see RequestDemo.website.
    website: Optional[str] = None


# Signed email-verification token lifetime — mirrors the demo_magic pattern.
EMAIL_VERIFY_TTL = timedelta(hours=48)


@router.post("/signup", status_code=201)
async def signup(
    body: SignupRequest,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict:
    """Self-serve account creation — no auth required.

    [TRIAL30] Creates a real (non-demo) tenant immediately on a 30 day free
    trial (trial_ends_at stamped, no payment collected), and moves the contact
    to the 'Live' Kanban stage in the root tenant. Conversion happens later via
    Stripe checkout from Settings → Subscription.

    The admin user is created INACTIVE: a verification email (48h signed JWT)
    must be clicked before the first login. The response carries
    "verification_required": true so the marketing SignupForm shows a
    "check your inbox" state instead of a login link.
    """
    from sqlalchemy.exc import IntegrityError

    from app.auth.invite import send_verification_email
    from app.auth.tokens import create_signed_token, verify_signed_token
    from app.core.mailer import ResendNotConfiguredError
    from app.core.models import Tenant, User
    from app.database import set_tenant_context
    from app.modules.admin.schemas import TenantCreate
    from app.modules.admin.service import create_tenant
    from app.modules.contacts.models import Contact
    from app.modules.pipeline.service import _assign_stage
    from app.config import ALL_MODULES
    from app.core._modules_gen import CORE_MODULES

    # Honeypot: bots fill the hidden `website` field — fake a plausible success
    # response (same shape as the real one) without creating anything.
    if body.website:
        _fake_base = _demo_client_base_url() or ""
        return {
            "tenant_slug": _slugify(body.company_name),
            "login_url": f"{_fake_base}/login",
            "verification_required": True,
            "payment": {
                "type": "trial",
                "trial_days": TRIAL_DAYS,
                "trial_ends_at": (datetime.now(timezone.utc) + timedelta(days=TRIAL_DAYS)).isoformat(),
            },
        }

    ip = get_client_ip(request)
    # Read-only per-IP check; counted only after a successful provision so a
    # few typo'd attempts can't lock a prospect out for an hour.
    await _public_rate_limit_check(ip, "signup", 5)
    await _check_global_provision_cap("signup")

    email = body.email.lower().strip()

    # Block if already a live account; clean up demo accounts so the user can
    # re-register for a real account without hitting an IntegrityError.
    # Generic 409 detail — same string as every other conflict cause, so the
    # endpoint can't be used to enumerate registered addresses.
    existing = await db.scalar(
        select(User).where(func.lower(User.email) == email)
    )
    if existing:
        existing_tenant = await db.get(Tenant, existing.tenant_id)
        if existing_tenant and not existing_tenant.is_demo:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=GENERIC_CONFLICT_DETAIL,
            )
        # Existing account is a demo — purge it so create_tenant won't collide.
        await _purge_stale_demo_for_email(db, email)

    # Decode from_demo_token questionnaire if present
    questionnaire = body.questionnaire
    if body.from_demo_token:
        claims = verify_signed_token(body.from_demo_token, "demo_outreach")
        if claims and not questionnaire:
            import json as _json
            try:
                q_data = _json.loads(claims.get("questionnaire", "{}"))
                questionnaire = Questionnaire(**q_data) if q_data else None
            except Exception:
                pass

    # Core modules (inbox/contacts/activity) are always on; the buyer explicitly
    # picks paid add-ons on the signup form. [TRIAL30] Nothing is billed at
    # signup — the selection is billed at conversion via Stripe checkout.
    # Booking ships bundled with Calendar.
    _all = set(ALL_MODULES)
    selected = [m for m in body.enabled_modules if m in _all]
    enabled_modules = list(dict.fromkeys([*CORE_MODULES, *selected]))
    if "calendar" in enabled_modules and "booking" not in enabled_modules:
        enabled_modules.append("booking")
    base_slug = _slugify(body.company_name)
    slug = await _unique_slug(db, base_slug)

    # No password on the form? Generate a throwaway one (demo pattern). The
    # entry-link token carries pw="auto" so verify_email hands the user a
    # set-password modal once they're inside the workspace.
    import secrets as _secrets
    password_auto = not body.password
    admin_password = body.password or _secrets.token_urlsafe(24)

    try:
        tenant_result = await create_tenant(
            db,
            TenantCreate(
                name=body.company_name.strip(),
                slug=slug,
                admin_email=email,
                admin_full_name=body.name.strip(),
                is_demo=False,
                admin_password=admin_password,
                enabled_modules=enabled_modules,
                plan=body.plan,
                # Email verification: the admin account stays inactive until the
                # verification link is clicked (login rejects inactive users).
                admin_is_active=False,
            ),
        )
    except ValueError:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=GENERIC_CONFLICT_DETAIL)
    except IntegrityError:
        # Concurrent duplicate submission tripped the users.email unique
        # constraint after the pre-check — a conflict, not a 500.
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=GENERIC_CONFLICT_DETAIL)
    except ResendNotConfiguredError:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Account creation email is not configured.",
        )

    await _record_global_provision("signup")
    await _public_rate_limit_record(ip, "signup")

    tenant_id = uuid.UUID(str(tenant_result["id"]))

    # Load the new admin user NOW, while still on the connecting (RLS bypassing)
    # role — needed for the verification token below.
    new_user = await db.scalar(select(User).where(func.lower(User.email) == email))
    if new_user is None:
        await _purge_tenant_after_failed_provision(db, tenant_id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Account could not be created. Please try again.",
        )
    new_user_id = new_user.id

    root_tenant_id = await _resolve_root_tenant_id(db)

    # Everything up to (and including) the verification email must succeed —
    # the user cannot log in until verified, so a failure partway would strand
    # them behind the duplicate 409. On failure: purge the tenant and ask them
    # to try again.
    try:
        # Load the new tenant now, while the session is still on the connecting
        # (RLS-bypassing) role — once we switch into root-tenant context below the
        # tenants RLS policy (id = app_tenant_id()) would hide it.
        signup_tenant = await db.get(Tenant, tenant_id)

        # [TRIAL30] Every self serve signup starts a 30 day free trial — no payment
        # at signup (reciprocity: full product first, ask later). Conversion happens
        # from Settings → Subscription via Stripe checkout; the platform webhook
        # (checkout.session.completed / invoice.paid) clears trial_ends_at. Until the
        # Stripe webhook is configured in production, a superadmin setting go_live_at
        # also clears the trial (admin.service.update_tenant). The hourly
        # trial_expiry_check job deactivates unconverted tenants after expiry.
        # Stamp + flush HERE, before set_tenant_context switches to the RLS enforced
        # role — the tenants policy (id = app_tenant_id()) would block this UPDATE
        # from root-tenant context.
        trial_ends_at = datetime.now(timezone.utc) + timedelta(days=TRIAL_DAYS)
        if signup_tenant is not None:
            signup_tenant.trial_ends_at = trial_ends_at
            await db.flush()

        # [WEB-LOGO-CARRY] Apply branding from the /custom configurator to the new
        # tenant workspace. Must be FLUSHED (not just assigned) before
        # set_tenant_context switches to the RLS enforced role — a lazy autoflush
        # after the switch emits the tenants UPDATE under the root tenant policy,
        # matches 0 rows, and blows up with StaleDataError.
        if questionnaire is not None and signup_tenant is not None:
            if questionnaire.branding_color:
                signup_tenant.primary_color = questionnaire.branding_color
            if questionnaire.branding_logo:
                signup_tenant.logo_url = questionnaire.branding_logo
            await db.flush()

        await set_tenant_context(db, str(root_tenant_id))

        # Find or create contact in root tenant
        contact = await db.scalar(
            select(Contact).where(
                Contact.tenant_id == root_tenant_id,
                Contact.email == email,
                Contact.deleted_at.is_(None),
            )
        )
        if contact is None:
            contact = Contact(
                tenant_id=root_tenant_id,
                full_name=body.name.strip(),
                email=email,
                company=body.company_name.strip(),
            )
            db.add(contact)
            await db.flush()
        else:
            contact.full_name = body.name.strip()
            contact.company = body.company_name.strip()

        if questionnaire:
            contact.custom_fields = {
                "team_size": questionnaire.team_size,
                "industry": questionnaire.industry,
                "current_tools": questionnaire.current_tools,
                "pain_points": questionnaire.pain_points,
                "recommended_modules": questionnaire.recommended_modules,
                "signed_up_plan": body.plan,
                "signed_up_modules": enabled_modules,
            }

        stage = await _ensure_stage_by_name(db, root_tenant_id, "Live", "#22c55e")
        await _assign_stage(db, root_tenant_id, contact.id, stage.id)

        await db.flush()

        # Persist the trial stamp + root tenant contact/stage work. Without this the
        # session rollback on close silently discarded the Kanban 'Live' assignment
        # (create_tenant committed the account itself, which is why signup appeared
        # to work) — latent bug found while adding [TRIAL30].
        await db.commit()
    except HTTPException:
        await _purge_tenant_after_failed_provision(db, tenant_id)
        raise
    except Exception:
        logger.exception("signup: provisioning failed after tenant creation for %s — purging tenant %s", email, tenant_id)
        await _purge_tenant_after_failed_provision(db, tenant_id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Account could not be created. Please try again.",
        )

    base = _demo_client_base_url()
    login_url = f"{base}/login"

    # handle_signup_payment (Stripe checkout at signup / invoice fallback) is
    # deliberately no longer called — the trial replaces payment at signup.
    payment_result = {
        "type": "trial",
        "trial_days": TRIAL_DAYS,
        "trial_ends_at": trial_ends_at.isoformat(),
    }

    # Entry-link email — mirrors the demo_magic signed-JWT pattern, with a
    # distinct purpose so tokens can't be replayed across flows. The link hits
    # the backend directly (same origin as the app), which logs the user in and
    # 302s straight into the workspace.
    verify_token = create_signed_token(
        "email_verify",
        EMAIL_VERIFY_TTL,
        user_id=str(new_user_id),
        email=email,
        **({"pw": "auto"} if password_auto else {}),
    )
    verify_url = f"{base}/api/v1/public/verify-email?token={verify_token}"

    try:
        await send_verification_email(email, body.name.strip(), verify_url, auto_password=password_auto)
    except Exception:
        # Without this email the (inactive) account is unreachable and a retry
        # would 409 — purge so the visitor can simply sign up again.
        logger.exception(
            "signup: failed to send verification email to %s — purging tenant %s so a retry can succeed",
            email, tenant_id,
        )
        await _purge_tenant_after_failed_provision(db, tenant_id)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="We couldn't send your verification email. Please try again in a few minutes.",
        )

    return {
        "tenant_slug": slug,
        "login_url": login_url,
        "verification_required": True,
        "payment": payment_result,
    }


@router.get("/verify-email", include_in_schema=False)
async def verify_email(token: str, db: Annotated[AsyncSession, Depends(get_db)]) -> RedirectResponse:
    """Enter a self-serve trial workspace from the emailed entry link.

    Mirrors the demo magic-link UX: validates the signed "email_verify" JWT
    (48h TTL), flips the user to active on first click, sets the session auth
    cookie and 302-redirects straight into the workspace — verification IS the
    login. Repeat clicks within the TTL just enter again (like demo_magic).
    Invalid/expired tokens redirect to /login?verified=0 (a browser-facing
    endpoint should never dead-end on raw JSON). Demo tenants never receive
    these tokens — their magic-link flow (demo_magic) is unchanged.
    """
    from app.auth.router import _set_auth_cookie, create_access_token
    from app.auth.tokens import verify_signed_token
    from app.core.models import Tenant, User

    base = _demo_client_base_url() or ""
    claims = verify_signed_token(token, "email_verify")
    if not claims:
        logger.warning("verify_email: invalid or expired token (first 20 chars: %s…)", token[:20])
        return RedirectResponse(f"{base}/login?verified=0", status_code=302)

    try:
        user = await db.get(User, uuid.UUID(claims["user_id"]))
    except (KeyError, ValueError):
        return RedirectResponse(f"{base}/login?verified=0", status_code=302)
    if user is None:
        logger.warning("verify_email: user %s not found", claims.get("user_id"))
        return RedirectResponse(f"{base}/login?verified=0", status_code=302)

    token_email = (claims.get("email") or "").lower()
    if token_email and token_email != user.email.lower():
        logger.warning("verify_email: token email %s does not match user email %s", token_email, user.email)
        return RedirectResponse(f"{base}/login?verified=0", status_code=302)

    tenant = await db.get(Tenant, user.tenant_id)
    if tenant is None or not tenant.is_active:
        logger.warning("verify_email: tenant %s inactive or missing for user %s", user.tenant_id, user.id)
        return RedirectResponse(f"{base}/login?verified=0", status_code=302)

    if not user.is_active:
        user.is_active = True
        await db.commit()
        # Deliberately NO welcome email here: the entry click puts the user
        # inside the workspace already, and a second mail right after the entry
        # mail reads as spam (user feedback 2026-07-11).

    # Auto-generated password (no password field on the signup form): hand the
    # workspace a short-lived reset token so the SetPasswordModal can let the
    # user choose their own via the existing POST /auth/reset-password. Only
    # the inbox owner ever holds this link, so only they can set the password.
    landing = f"{base}/"
    if claims.get("pw") == "auto":
        from app.auth.tokens import create_signed_token
        pw_token = create_signed_token("reset", timedelta(hours=1), sub=str(user.id))
        landing = f"{base}/?set_password={pw_token}"

    settings = get_settings()
    access_token = create_access_token(str(user.id), settings)
    response = RedirectResponse(landing, status_code=302)
    _set_auth_cookie(response, access_token, settings)
    return response


class ResendVerificationRequest(BaseModel):
    email: EmailStr


@router.post("/resend-verification")
async def resend_verification(
    body: ResendVerificationRequest,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict:
    """Mail a fresh entry link to a self-serve signup whose 48h link expired
    before first use.

    Without this the funnel dead-ends: the account is created inactive with an
    auto-generated password, so once the entry link lapses login is refused
    ("check your inbox"), forgot-password stays silent for inactive users, and
    the owner has no password to fall back on. The login screen offers this when
    it lands on ?verified=0.

    Always returns {"ok": True} (never reveals whether the email has an account),
    and only ever re-mails a still-pending self-serve signup: an inactive,
    never-logged-in user on a live, non-demo tenant. The new link carries
    pw="auto" so the SetPasswordModal guarantees a known password on entry —
    harmless even if a password was chosen at signup (it is simply reset)."""
    from app.auth.invite import send_verification_email
    from app.auth.tokens import create_signed_token
    from app.core.models import Tenant, User

    ip = get_client_ip(request)
    await _public_rate_limit(ip, "resend_verification", 5)

    email = body.email.lower().strip()
    user = await db.scalar(select(User).where(func.lower(User.email) == email))
    # Only a pending self-serve signup qualifies — active accounts use
    # forgot-password, and demo tenants have their own magic-link flow.
    if user is None or user.is_active or user.last_login_at is not None:
        return {"ok": True}
    tenant = await db.get(Tenant, user.tenant_id)
    if tenant is None or not tenant.is_active or tenant.is_demo:
        return {"ok": True}

    base = _demo_client_base_url()
    verify_token = create_signed_token(
        "email_verify",
        EMAIL_VERIFY_TTL,
        user_id=str(user.id),
        email=email,
        pw="auto",
    )
    verify_url = f"{base}/api/v1/public/verify-email?token={verify_token}"
    try:
        await send_verification_email(email, user.full_name, verify_url, auto_password=True)
    except Exception:
        logger.exception("resend_verification: failed to send entry link to %s", email)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="We couldn't send the link just now. Please try again in a few minutes.",
        )
    return {"ok": True}


# ── Contract e-signing ([CONTRACT3]) — booking-token pattern ──────────────────


@router.get("/contracts/sign/{token}")
async def public_get_contract(
    token: uuid.UUID,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    from app.core.models import Tenant
    from app.modules.contracts import service as contracts_service

    ip = get_client_ip(request)
    await _public_rate_limit(ip, "contract_sign_view", 30)

    contract = await contracts_service.get_by_sign_token(db, token)
    if contract is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="This signing link has expired or has already been used.",
        )

    # Scope the rest of the request to the contract's tenant (activates RLS).
    await set_tenant_context(db, str(contract.tenant_id))
    tenant = await db.get(Tenant, contract.tenant_id)

    return PublicContractOut(
        tenant_name=tenant.name if tenant else "Yippie",
        title=contract.title,
        body=contract.body or "",
        counterparty_name=contract.counterparty_name,
        value_amount=float(contract.value_amount) if contract.value_amount is not None else None,
        value_interval=contract.value_interval,
        currency=contract.currency,
        start_date=contract.start_date,
        end_date=contract.end_date,
        signed_at=contract.signed_at,
        signer_name=contract.signer_name,
    )


@router.post("/contracts/sign/{token}")
async def public_sign_contract(
    token: uuid.UUID,
    body: PublicSignRequest,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    from app.modules.contracts import service as contracts_service

    if not body.agree:
        raise HTTPException(status_code=400, detail="You must agree to the contract terms to sign.")
    if body.signature_image and not body.signature_image.startswith("data:image/png;base64,"):
        raise HTTPException(status_code=400, detail="Invalid signature image.")

    ip = get_client_ip(request)
    await _public_rate_limit(ip, "contract_sign_submit", 10)

    contract = await contracts_service.get_by_sign_token(db, token)
    if contract is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="This signing link has expired or has already been used.",
        )
    if contract.signed_at:
        raise HTTPException(status_code=409, detail="This contract has already been signed.")

    await contracts_service.apply_signature(
        db, contract,
        signer_name=body.signer_name.strip(),
        signer_ip=ip,
        signature_image=body.signature_image,
    )
    return {"signed": True, "signed_at": contract.signed_at}
