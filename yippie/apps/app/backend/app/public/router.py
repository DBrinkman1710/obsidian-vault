from __future__ import annotations

import os
import re
import time
import uuid
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.database import get_db, set_tenant_context
from app.modules.booking.schemas import BookingConfirm, CounterProposeRequest, ManageBookingOut, RescheduleRequest

# Public, unauthenticated endpoints — consumed by the marketing site (getyippie.com).
# Mounted in main.py WITHOUT auth dependencies. Never expose tenant-level data here;
# global aggregates only.
router = APIRouter(prefix="/public", tags=["public"])

# Average agent time saved per automated ticket, in minutes. Tunable later.
AVG_MINUTES_PER_TICKET = 15

# The platform owner — demo follow-up contacts/tickets land in this user's tenant.
ROOT_OWNER_EMAIL = os.getenv("ADMIN_EMAIL", "diederik1710@gmail.com").lower()

# Cached root-owner tenant id (per process); resolved once from the DB.
_root_tenant_id: Optional[uuid.UUID] = None

# Default demo tenant lifetime (days) — overridable per tenant via demo_expires_at.
DEFAULT_DEMO_DAYS = 7

# Kanban stage used for inbound demo requests in the root owner's pipeline.
DEMO_PIPELINE_STAGE = "Demo"
# high-traffic endpoint, so a process-local dict is sufficient.
DEMO_RATE_LIMIT = 5
DEMO_RATE_WINDOW = 3600  # seconds
_demo_requests: dict[str, list[float]] = defaultdict(list)


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


class RequestDemo(BaseModel):
    name: str = Field(min_length=1)
    company_name: str = Field(min_length=1)
    email: EmailStr
    slug: Optional[str] = None
    questionnaire: Optional[Questionnaire] = None


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


async def _reject_active_user_email(db: AsyncSession, email: str) -> None:
    """Block demo provisioning when the address already belongs to an active Yippie user."""
    from app.core.models import User

    user = await db.scalar(select(User).where(func.lower(User.email) == email.lower().strip()))
    if user and user.is_active:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email address already active, use app.getyippie.com to log in.",
        )


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


# Simple in-memory rate limiter — 5 demo requests per IP per hour. This is not a
# high-traffic endpoint, so a process-local dict is sufficient.
def _check_rate_limit(ip: str) -> None:
    now = time.monotonic()
    hits = [t for t in _demo_requests[ip] if now - t < DEMO_RATE_WINDOW]
    if len(hits) >= DEMO_RATE_LIMIT:
        _demo_requests[ip] = hits
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many demo requests. Please try again later.",
        )
    hits.append(now)
    _demo_requests[ip] = hits


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


@router.post("/request-demo")
async def request_demo(
    body: RequestDemo,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict:
    """Self-serve demo provisioning — no auth.

    Creates an is_demo tenant (the requester gets a set-password invite), then
    files a follow-up Contact + Ticket in the root owner's own tenant.
    """
    import secrets

    from app.auth.invite import send_demo_ready_email
    from app.auth.tokens import create_signed_token
    from app.core.mailer import ResendNotConfiguredError
    from app.core.models import Tenant, User
    from app.modules.admin.schemas import TenantCreate
    from app.modules.admin.service import create_tenant
    from app.modules.contacts.models import Contact, contact_label_links
    from app.modules.pipeline.service import _assign_stage
    from app.modules.tickets.models import MessageSource, Ticket, TicketPriority, TicketStatus

    ip = (request.client.host if request.client else None) or "unknown"
    _check_rate_limit(ip)

    email = body.email.lower().strip()
    await _reject_active_user_email(db, email)

    root_tenant_id = await _resolve_root_tenant_id(db)

    base_slug = _slugify(body.slug or body.company_name)
    slug = await _unique_slug(db, base_slug)

    # Random password => create_tenant creates a hashed-password user and
    # suppresses the generic set-password invite email; we send a magic-login
    # demo link instead.
    pwd = secrets.token_urlsafe(32)
    try:
        tenant = await create_tenant(
            db,
            TenantCreate(
                name=body.company_name.strip(),
                slug=slug,
                admin_email=email,
                admin_full_name=body.name.strip(),
                is_demo=True,
                admin_password=pwd,
            ),
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(e))
    except ResendNotConfiguredError:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Demo provisioning email is not configured.",
        )

    tenant_id = tenant["id"]
    demo_tenant = await db.get(Tenant, uuid.UUID(str(tenant_id)))
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
    try:
        await send_demo_ready_email(email, body.name.strip(), magic_link)
    except Exception:
        pass  # demo is created; email failure must not fail the response

    # All remaining writes are in the root tenant — set RLS context so
    # pipeline_stages INSERT/SELECT passes the tenant_isolation policy.
    await set_tenant_context(db, str(root_tenant_id))

    # File a follow-up Contact + Ticket in the root owner's own tenant.
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

    return {"tenant_id": str(tenant_id), "slug": slug, "invited": True}


@router.get("/demo-enter")
async def demo_enter(token: str, db: Annotated[AsyncSession, Depends(get_db)]):
    from app.auth.tokens import verify_signed_token
    from app.auth.router import create_access_token, TokenResponse
    from app.core.models import Tenant, User
    from app.core.schemas import UserOut
    from app.config import get_settings

    claims = verify_signed_token(token, "demo_magic")
    if not claims:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired demo link.")

    user = await db.get(User, uuid.UUID(claims["user_id"]))
    if not user or not user.is_active:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Demo account not found.")

    token_email = (claims.get("email") or "").lower()
    if token_email and token_email != user.email.lower():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired demo link.")

    tenant = await db.get(Tenant, user.tenant_id)
    if not tenant or not tenant.is_active:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Demo account not found.")
    if tenant.is_demo and tenant.demo_expires_at:
        expires = tenant.demo_expires_at
        if expires.tzinfo is None:
            expires = expires.replace(tzinfo=timezone.utc)
        if expires < datetime.now(timezone.utc):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="This demo has expired.")

    settings = get_settings()
    access_token = create_access_token(str(user.id), settings)
    return TokenResponse(access_token=access_token, user=UserOut.model_validate(user))


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
    days_ahead = max(settings.booking_expiry_days, 14)
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
    from app.modules.pipeline.service import _assign_stage

    ip = (request.client.host if request.client else None) or "unknown"
    _check_rate_limit(ip)

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
        description=body.message or None,
    )
    db.add(event)

    settings = await booking_service.get_or_create_settings(db, tenant.id)
    if settings.post_booking_stage_id is not None:
        await _assign_stage(db, tenant.id, contact.id, settings.post_booking_stage_id)

    await db.commit()
    await db.refresh(event)

    try:
        asyncio.create_task(
            booking_service._notify_customer_confirmed(event, contact, tenant)
        )
        asyncio.create_task(
            booking_service._notify_agent_confirmed(event, contact, admin)
        )
    except Exception:
        pass

    return {
        "event_id": str(event.id),
        "start_at": event.start_at.isoformat(),
        "end_at": event.end_at.isoformat(),
    }


class AIDemoRequest(BaseModel):
    raw_message: str = Field(min_length=1, max_length=4000)


@router.post("/ai-demo")
async def ai_demo(body: AIDemoRequest, request: Request) -> dict:
    """Live AI demo — no auth. Scans a pasted message and returns structured ticket fields."""
    from app.modules.inbox.ai_scanner import scan_message
    from app.config import get_settings

    ip = (request.client.host if request.client else None) or "unknown"
    _check_rate_limit(ip)

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

    ip = (request.client.host if request.client else None) or "unknown"
    _check_rate_limit(ip)

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

    days_ahead = max(settings.booking_expiry_days, 14)
    available = await booking_service.get_available_slots(
        db, token.tenant_id, settings, days_ahead
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

    ip = (request.client.host if request.client else None) or "unknown"
    _check_rate_limit(ip)

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

    ip = (request.client.host if request.client else None) or "unknown"
    _check_rate_limit(ip)

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

    ip = (request.client.host if request.client else None) or "unknown"
    _check_rate_limit(ip)

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
    days_ahead = max(settings.booking_expiry_days, 14)
    available = await booking_service.get_available_slots(
        db, token.tenant_id, settings, days_ahead
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

    ip = (request.client.host if request.client else None) or "unknown"
    _check_rate_limit(ip)

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

    ip = (request.client.host if request.client else None) or "unknown"
    _check_rate_limit(ip)

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
