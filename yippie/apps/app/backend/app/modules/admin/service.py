from __future__ import annotations

import asyncio
import base64
import os
import uuid
from datetime import datetime, timedelta, timezone

import bcrypt as _bcrypt
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.models import Tenant, User, UserRole
from app.core.plans import PlanTier
from app.modules.admin.schemas import (
    AddAdminRequest,
    BroadcastRequest,
    BroadcastResult,
    SuperAdminStats,
    SuperAdminStatsSummary,
    TenantCreate,
    TenantStatRow,
    TenantUpdate,
)
from app.modules.contacts.models import Contact

DEFAULT_DEMO_DAYS = 7

TENANT_SAFE_FIELDS = {
    "name", "enabled_modules", "plan", "primary_color", "logo_url",
    "is_active", "is_demo", "demo_expires_at", "go_live_at", "trial_ends_at", "inbound_email",
    "kvk_nummer", "btw_nummer",
    "street_address", "postal_code", "city", "country", "iban", "phone",
    "whatsapp_phone_number_id", "whatsapp_access_token", "whatsapp_verify_token",
    "ai_auto_scan",
    "lead_widget_save_contact", "lead_widget_stage_id",
}

# The platform owner's account — same default as promote_superadmin.py / seed.py.
# No one, including other superadmins, may deactivate it.
_admin_email_env = os.getenv("ADMIN_EMAIL", "").lower()
_environment_env = os.getenv("ENVIRONMENT", "development").lower()
if not _admin_email_env:
    if _environment_env not in ("development", "local", "test"):
        raise RuntimeError(
            "ADMIN_EMAIL env var must be set in non-development environments. "
            "This guards the protected superadmin account from deletion/deactivation."
        )
    _admin_email_env = "admin@localhost"
PROTECTED_SUPERADMIN_EMAIL = _admin_email_env


def _tenant_to_dict(tenant: Tenant, user_count: int) -> dict:
    return {**{c.name: getattr(tenant, c.name) for c in Tenant.__table__.columns}, "user_count": user_count}


async def list_tenants(db: AsyncSession) -> list[dict]:
    result = await db.execute(
        select(Tenant, func.count(User.id).label("user_count"))
        .outerjoin(User, User.tenant_id == Tenant.id)
        .group_by(Tenant.id)
        .order_by(Tenant.created_at)
    )
    rows = result.all()
    return [_tenant_to_dict(row.Tenant, row.user_count) for row in rows]


async def create_tenant(db: AsyncSession, data: TenantCreate) -> dict:
    from app.auth.invite import send_invite_email, send_welcome_to_inbox
    from app.core.mailer import ResendNotConfiguredError

    # Never silently overwrite an existing user's credentials
    all_emails = [data.admin_email, *data.extra_admin_emails]
    for email in all_emails:
        existing_user = await db.scalar(select(User).where(User.email == email))
        if existing_user:
            raise ValueError(f"A user with email '{email}' already exists.")

    tenant = Tenant(
        slug=data.slug,
        name=data.name,
        enabled_modules=data.enabled_modules,
        primary_color=data.primary_color,
        logo_url=data.logo_url,
        is_demo=data.is_demo,
        plan=data.plan.value if data.plan else "starter",
        demo_expires_at=(
            datetime.now(timezone.utc) + timedelta(days=DEFAULT_DEMO_DAYS)
            if data.is_demo
            else None
        ),
        inbound_email=data.inbound_email or None,
    )
    db.add(tenant)
    await db.flush()

    user_count = 0
    invites = list(data.extra_admin_emails)
    if data.admin_password:
        db.add(User(
            tenant_id=tenant.id,
            email=data.admin_email.strip().lower(),
            full_name=data.admin_full_name,
            hashed_password=(await asyncio.to_thread(_bcrypt.hashpw, data.admin_password.encode(), _bcrypt.gensalt())).decode(),
            role=UserRole.admin,
        ))
        user_count = 1
    else:
        invites.insert(0, data.admin_email)

    await db.commit()
    await db.refresh(tenant)

    # Seed sensible default Kanban stages so new tenants start with a working board.
    from app.modules.pipeline.service import provision_default_stages
    await provision_default_stages(db, tenant.id)

    # Seed default RBAC roles (Agent + Viewer) for every new tenant.
    from app.modules.rbac.service import provision_default_rbac_roles
    await provision_default_rbac_roles(db, tenant.id)

    for email in invites:
        full_name = data.admin_full_name if email == data.admin_email else "Admin"
        try:
            await send_invite_email(
                to=email, full_name=full_name, tenant_id=tenant.id,
                role=UserRole.admin.value, tenant_name=tenant.name,
            )
        except ResendNotConfiguredError:
            pass  # tenant is created either way; invites can be re-sent later

    # The product introduction lands in the client's own Yippie inbox — the
    # poller picks it up like any customer mail, so it's the first draft they see.
    if tenant.inbound_email:
        try:
            await send_welcome_to_inbox(tenant.inbound_email, tenant.name)
        except Exception:
            pass  # never block tenant creation on the welcome mail

    return _tenant_to_dict(tenant, user_count)


async def check_email_available(db: AsyncSession, email: str) -> tuple[bool, str | None]:
    """(available, reason) for an address about to be invited/created."""
    from app.core.mailer import is_valid_email

    addr = (email or "").strip().lower()
    if not is_valid_email(addr):
        return False, "Not a valid email address"
    existing = await db.scalar(select(User.id).where(func.lower(User.email) == addr))
    if existing:
        user = await db.scalar(select(User).where(func.lower(User.email) == addr))
        if user and user.is_active:
            return False, "Email address already active, use app.getyippie.com to log in."
        return False, "A user with this email already exists"
    return True, None


async def update_tenant(db: AsyncSession, tenant_id: uuid.UUID, data: TenantUpdate) -> dict | None:
    tenant = await db.get(Tenant, tenant_id)
    if tenant is None:
        return None
    for field, value in data.model_dump(exclude_none=True).items():
        if field not in TENANT_SAFE_FIELDS:
            continue  # explicit safelist — never write unexpected fields to the Tenant model
        # plan arrives as a PlanTier enum; the column stores its string value.
        if field == "plan" and isinstance(value, PlanTier):
            value = value.value
        setattr(tenant, field, value)
    # [TRIAL30] Marking a tenant live is the manual conversion path while the
    # Stripe webhook is not yet configured — it also ends the free trial.
    # (TenantUpdate uses exclude_none, so trial_ends_at can't be nulled directly.)
    if data.go_live_at is not None:
        tenant.trial_ends_at = None
    await db.commit()
    await db.refresh(tenant)
    user_count = await db.scalar(select(func.count(User.id)).where(User.tenant_id == tenant.id))
    return _tenant_to_dict(tenant, user_count or 0)


async def get_tenant_users(db: AsyncSession, tenant_id: uuid.UUID) -> list[User]:
    result = await db.execute(select(User).where(User.tenant_id == tenant_id).order_by(User.created_at))
    return result.scalars().all()


async def add_tenant_user(db: AsyncSession, tenant_id: uuid.UUID, data: AddAdminRequest) -> User | dict | None:
    """Add an admin to a tenant. With a password the account is created directly;
    without one an invite email is sent and the account is created on /register."""
    from app.auth.invite import send_invite_email

    tenant = await db.get(Tenant, tenant_id)
    if tenant is None:
        return None
    email = data.email.strip().lower()
    existing = await db.scalar(select(User).where(func.lower(User.email) == email))
    if existing:
        raise ValueError(f"A user with email '{email}' already exists.")

    if not data.password:
        await send_invite_email(
            to=email, full_name=data.full_name, tenant_id=tenant_id,
            role=UserRole.admin.value, tenant_name=tenant.name,
        )
        return {"invited": True, "email": email}

    user = User(
        tenant_id=tenant_id,
        email=email,
        full_name=data.full_name,
        hashed_password=(await asyncio.to_thread(_bcrypt.hashpw, data.password.encode(), _bcrypt.gensalt())).decode(),
        role=UserRole.admin,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


async def patch_tenant_user(db: AsyncSession, tenant_id: uuid.UUID, user_id: uuid.UUID, is_active: bool) -> User | None:
    user = await db.scalar(select(User).where(User.id == user_id, User.tenant_id == tenant_id))
    if user is None:
        return None
    user.is_active = is_active
    await db.commit()
    await db.refresh(user)
    return user


async def get_impersonation_target(db: AsyncSession, tenant_id: uuid.UUID) -> tuple[Tenant, User] | None:
    """Return (tenant, first active admin user) for impersonation, or None."""
    tenant = await db.get(Tenant, tenant_id)
    if tenant is None:
        return None
    user = await db.scalar(
        select(User)
        .where(User.tenant_id == tenant_id, User.role == UserRole.admin, User.is_active == True)  # noqa: E712
        .order_by(User.created_at)
        .limit(1)
    )
    if user is None:
        return None
    return tenant, user


# Children before parents so plain DELETEs never trip an FK.
async def _require_root_owner(current_user: User, current_password: str) -> None:
    if current_user.email.lower() != PROTECTED_SUPERADMIN_EMAIL:
        raise ValueError("Only the root owner can do this")
    if not await asyncio.to_thread(_bcrypt.checkpw, current_password.encode(), current_user.hashed_password.encode()):
        raise ValueError("Password incorrect")


async def delete_tenant(
    db: AsyncSession, current_user: User, tenant_id: uuid.UUID, current_password: str
) -> dict:
    """Irreversibly wipe a tenant and all its data. Root owner + password only.

    All tenant-scoped tables carry ON DELETE CASCADE FKs to tenants(id)
    (added by migration tenant_cascade_all), so a single db.delete(tenant)
    lets PostgreSQL handle the full cascade — no manual table ordering needed.
    New tables only need REFERENCES tenants(id) ON DELETE CASCADE in their
    migration; nothing else has to change here.
    """
    await _require_root_owner(current_user, current_password)
    tenant = await db.get(Tenant, tenant_id)
    if tenant is None:
        raise LookupError("Tenant not found")
    if tenant.id == current_user.tenant_id:
        raise ValueError("Cannot delete your own tenant")

    name = tenant.name

    # For demo tenants: also remove the corresponding lead contact + ticket
    # from the root owner's pipeline (created by /public/request-demo).
    if tenant.is_demo:
        from sqlalchemy import text
        admin_user = await db.scalar(
            select(User).where(User.tenant_id == tenant_id).limit(1)
        )
        if admin_user:
            root_contact = await db.scalar(
                select(Contact).where(
                    func.lower(Contact.email) == admin_user.email.lower(),
                    Contact.tenant_id == current_user.tenant_id,
                )
            )
            if root_contact:
                await db.execute(
                    text("DELETE FROM tickets WHERE contact_id = :cid"),
                    {"cid": str(root_contact.id)},
                )
                await db.delete(root_contact)

    await db.delete(tenant)
    await db.commit()
    return {"deleted": True, "tenant": name}


async def delete_superadmin(
    db: AsyncSession, current_user: User, user_id: uuid.UUID, current_password: str
) -> dict:
    """Permanently remove a superadmin account. Root owner + password only.
    Use the is_active toggle instead when only suspending."""
    from sqlalchemy import text

    await _require_root_owner(current_user, current_password)
    user = await db.get(User, user_id)
    if user is None or user.role != UserRole.superadmin:
        raise LookupError("Superadmin not found")
    if user.id == current_user.id:
        raise ValueError("Cannot delete yourself")
    if user.email.lower() == PROTECTED_SUPERADMIN_EMAIL:
        raise ValueError("Cannot delete the root owner")

    # Null out nullable references so the row can go
    uid = str(user.id)
    for table, col in [
        ("activity_events", "actor_id"), ("contacts", "created_by"),
        ("tickets", "assigned_to"), ("tickets", "created_by"),
        ("ticket_comments", "author_id"),
        ("draft_tickets", "assigned_to"), ("draft_tickets", "reviewed_by"),
    ]:
        await db.execute(text(f"UPDATE {table} SET {col} = NULL WHERE {col} = :uid"), {"uid": uid})

    email = user.email
    await db.delete(user)
    await db.commit()
    return {"deleted": True, "email": email}


async def invite_superadmin(
    db: AsyncSession, current_user: User, email: str, full_name: str, current_password: str
) -> dict:
    """Invite a new superadmin by email — root owner + password only. The invitee
    sets their own password via /register; no password-less accounts are created."""
    from app.auth.invite import send_invite_email

    await _require_root_owner(current_user, current_password)
    existing = await db.scalar(select(User).where(User.email == email))
    if existing:
        raise ValueError(f"A user with email '{email}' already exists.")

    # Superadmins live in the root owner's own tenant
    tenant = await db.get(Tenant, current_user.tenant_id)
    await send_invite_email(
        to=email, full_name=full_name, tenant_id=current_user.tenant_id,
        role=UserRole.superadmin.value, tenant_name=tenant.name if tenant else "Yippie",
    )
    return {"invited": True, "email": email}


async def list_superadmins(db: AsyncSession) -> list[User]:
    result = await db.execute(
        select(User).where(User.role == UserRole.superadmin).order_by(User.created_at)
    )
    return result.scalars().all()


async def toggle_superadmin_active(
    db: AsyncSession,
    current_user: User,
    target_id: uuid.UUID,
    is_active: bool,
    current_password: str,
) -> User:
    if not await asyncio.to_thread(_bcrypt.checkpw, current_password.encode(), current_user.hashed_password.encode()):
        raise ValueError("Incorrect password.")
    if target_id == current_user.id:
        raise ValueError("You cannot deactivate your own account.")
    target = await db.get(User, target_id)
    if target is None:
        raise LookupError("User not found.")
    if target.role != UserRole.superadmin:
        raise ValueError("User is not a superadmin.")
    if not is_active and target.email.lower() == PROTECTED_SUPERADMIN_EMAIL:
        raise ValueError(f"{target.email} cannot be deactivated.")
    target.is_active = is_active
    await db.commit()
    await db.refresh(target)
    return target


async def bulk_toggle_module(db: AsyncSession, module: str, enabled: bool) -> dict:
    """Add or remove a module from every tenant's enabled_modules list."""
    result = await db.execute(select(Tenant))
    tenants = result.scalars().all()
    for tenant in tenants:
        mods = set(tenant.enabled_modules or [])
        if enabled:
            mods.add(module)
        else:
            mods.discard(module)
        tenant.enabled_modules = list(mods)
    await db.commit()
    return {"module": module, "enabled": enabled, "tenants_updated": len(tenants)}


BROADCAST_BATCH_SIZE = 10


def encode_unsubscribe_token(contact_id: uuid.UUID, tenant_id: uuid.UUID | None = None) -> str:
    from datetime import timedelta
    from app.auth.tokens import create_signed_token
    return create_signed_token("unsubscribe", timedelta(days=30), cid=str(contact_id), tid=str(tenant_id or ""))


def decode_unsubscribe_token(token: str) -> uuid.UUID:
    """Decode an HMAC-signed unsubscribe JWT. Legacy base64 fallback removed — tokens
    without a signature are rejected to prevent forged opt-outs."""
    from app.auth.tokens import verify_signed_token
    payload = verify_signed_token(token, "unsubscribe")
    if payload is not None:
        return uuid.UUID(payload["cid"])
    raise ValueError("Invalid unsubscribe token")


async def broadcast_to_tenant(
    db: AsyncSession, tenant_id: uuid.UUID, data: BroadcastRequest
) -> BroadcastResult:
    """Send a bulk email to every active contact of a tenant via Resend.

    Sends in batches of 10 with a 1s pause between batches to stay under the
    Resend free-tier rate limit (~10 req/s). Each email carries an unsubscribe
    link that flips broadcast_opted_out; opted-out contacts are skipped here.
    """
    from app.config import get_settings
    from app.core.email_html import render_email_html
    from app.core.mailer import is_valid_email, send_email

    tenant = await db.get(Tenant, tenant_id)
    if tenant is None:
        raise LookupError("Tenant not found")
    if tenant.is_demo:
        raise ValueError("Cannot broadcast to a demo tenant")

    result = await db.execute(select(Contact).where(Contact.tenant_id == tenant_id))
    contacts = result.scalars().all()

    skipped_opted_out = sum(1 for c in contacts if c.broadcast_opted_out)
    recipients = [c for c in contacts if not c.broadcast_opted_out]

    skipped_no_email = sum(1 for c in recipients if not (c.email and is_valid_email(c.email)))
    recipients = [c for c in recipients if c.email and is_valid_email(c.email)]

    base_url = get_settings().effective_base_url
    from_email = get_settings().resend_from or None

    sent = 0
    failed = 0
    for i in range(0, len(recipients), BROADCAST_BATCH_SIZE):
        batch = recipients[i : i + BROADCAST_BATCH_SIZE]
        for contact in batch:
            token = encode_unsubscribe_token(contact.id, tenant_id)
            unsubscribe_url = f"{base_url}/api/v1/admin/unsubscribe/{token}"
            text_footer = f"\n\n—\nUnsubscribe from these emails: {unsubscribe_url}"
            html_body = render_email_html(
                data.body + text_footer,
                tenant_name=data.from_name or tenant.name,
                primary_color=tenant.primary_color,
            )
            try:
                await send_email(
                    to=contact.email,
                    subject=data.subject,
                    body=data.body + text_footer,
                    from_email=from_email,
                    html=html_body,
                    # Gmail requires List-Unsubscribe + List-Unsubscribe-Post for bulk mail
                    headers={
                        "List-Unsubscribe": f"<{unsubscribe_url}>",
                        "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
                    },
                )
                sent += 1
            except Exception:
                failed += 1
        # Pause between batches, not after the final one.
        if i + BROADCAST_BATCH_SIZE < len(recipients):
            await asyncio.sleep(1)

    return BroadcastResult(
        sent=sent,
        skipped_no_email=skipped_no_email,
        skipped_opted_out=skipped_opted_out,
        failed=failed,
    )


async def provision_resend_domain(
    db: AsyncSession, tenant_id: uuid.UUID, domain: str
) -> Tenant:
    """Register a custom sending domain in Resend and store the DNS records on the tenant."""
    import httpx

    from app.config import get_settings

    settings = get_settings()
    if not settings.resend_api_key:
        raise ValueError("RESEND_API_KEY is not configured")

    tenant = await db.get(Tenant, tenant_id)
    if tenant is None:
        raise LookupError("Tenant not found")

    domain = domain.strip().lower()

    async with httpx.AsyncClient() as client:
        resp = await client.post(
            "https://api.resend.com/domains",
            headers={"Authorization": f"Bearer {settings.resend_api_key}"},
            json={"name": domain},
            timeout=15,
        )
        resp.raise_for_status()
        data = resp.json()

    tenant.resend_domain_id = data["id"]
    tenant.resend_domain_name = data["name"]
    tenant.resend_domain_status = data.get("status", "not_started")
    tenant.resend_domain_records = data.get("records", [])
    await db.commit()
    await db.refresh(tenant)
    return tenant


async def verify_resend_domain(db: AsyncSession, tenant_id: uuid.UUID) -> Tenant:
    """Ask Resend to re-check the DNS records and update the domain status."""
    import httpx

    from app.config import get_settings

    settings = get_settings()
    if not settings.resend_api_key:
        raise ValueError("RESEND_API_KEY is not configured")

    tenant = await db.get(Tenant, tenant_id)
    if tenant is None:
        raise LookupError("Tenant not found")
    if not tenant.resend_domain_id:
        raise ValueError("No Resend domain provisioned for this tenant")

    async with httpx.AsyncClient() as client:
        # Trigger re-verification
        verify_resp = await client.post(
            f"https://api.resend.com/domains/{tenant.resend_domain_id}/verify",
            headers={"Authorization": f"Bearer {settings.resend_api_key}"},
            timeout=15,
        )
        verify_resp.raise_for_status()

        # Fetch updated status + records
        get_resp = await client.get(
            f"https://api.resend.com/domains/{tenant.resend_domain_id}",
            headers={"Authorization": f"Bearer {settings.resend_api_key}"},
            timeout=15,
        )
        get_resp.raise_for_status()
        data = get_resp.json()

    tenant.resend_domain_status = data.get("status", tenant.resend_domain_status)
    tenant.resend_domain_records = data.get("records", tenant.resend_domain_records)
    await db.commit()
    await db.refresh(tenant)
    return tenant


async def opt_out_contact(db: AsyncSession, token: str) -> bool:
    """Flip broadcast_opted_out for the contact encoded in the unsubscribe token."""
    try:
        contact_id = decode_unsubscribe_token(token)
    except Exception:
        return False
    contact = await db.get(Contact, contact_id)
    if contact is None:
        return False
    contact.broadcast_opted_out = True
    await db.commit()
    return True


async def get_superadmin_stats(
    db: AsyncSession,
    start: datetime,
    end: datetime,
    tenant_id: uuid.UUID | None = None,
) -> SuperAdminStats:
    """Cross-tenant activity snapshot for the superadmin dashboard.

    Read-only analytics. Runs without tenant context (no RLS) so it sees every
    tenant. Date-ranged counts (tickets_closed, contacts_created, inbox_pending)
    use [start, end]; "today" counts use UTC midnight of the current day.
    """
    from sqlalchemy import and_, case

    from app.modules.inbox.models import DraftStatus, DraftTicket
    from app.modules.tickets.models import Ticket, TicketStatus

    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    closed_statuses = (TicketStatus.closed, TicketStatus.resolved)

    # Base tenant set (optionally narrowed to one).
    tenant_q = select(Tenant).order_by(Tenant.name)
    if tenant_id is not None:
        tenant_q = tenant_q.where(Tenant.id == tenant_id)
    tenants = (await db.execute(tenant_q)).scalars().all()
    tenant_ids = [t.id for t in tenants]

    # Initialise an accumulator per tenant so tenants with no rows still appear.
    acc: dict[uuid.UUID, dict] = {
        t.id: {
            "tickets_open": 0, "tickets_closed": 0, "tickets_overdue": 0,
            "inbox_pending": 0, "contacts_created": 0,
            "active_users_today": 0, "ai_usage_today": 0, "ai_usage_period": 0,
            "saas_events_period": 0,
        }
        for t in tenants
    }

    if tenant_ids:
        # Tickets: open (not closed/resolved, not deleted), closed-in-range, overdue.
        ticket_rows = await db.execute(
            select(
                Ticket.tenant_id,
                func.count(case((Ticket.status.notin_(closed_statuses), 1))).label("open"),
                func.count(
                    case((and_(
                        Ticket.status.in_(closed_statuses),
                        Ticket.updated_at >= start,
                        Ticket.updated_at <= end,
                    ), 1))
                ).label("closed"),
                func.count(
                    case((and_(
                        Ticket.status.notin_(closed_statuses),
                        Ticket.sla_due_at.is_not(None),
                        Ticket.sla_due_at < now,
                    ), 1))
                ).label("overdue"),
            )
            .where(Ticket.tenant_id.in_(tenant_ids), Ticket.deleted_at.is_(None))
            .group_by(Ticket.tenant_id)
        )
        for r in ticket_rows:
            acc[r.tenant_id].update(tickets_open=r.open, tickets_closed=r.closed, tickets_overdue=r.overdue)

        # Inbox: pending drafts (in range), and AI-enriched drafts today.
        draft_rows = await db.execute(
            select(
                DraftTicket.tenant_id,
                func.count(
                    case((and_(
                        DraftTicket.status == DraftStatus.pending,
                        DraftTicket.created_at >= start,
                        DraftTicket.created_at <= end,
                    ), 1))
                ).label("pending"),
                func.count(
                    case((and_(
                        DraftTicket.ai_status == "done",
                        DraftTicket.created_at >= today_start,
                    ), 1))
                ).label("ai_today"),
                func.count(
                    case((and_(
                        DraftTicket.ai_status == "done",
                        DraftTicket.created_at >= start,
                        DraftTicket.created_at <= end,
                    ), 1))
                ).label("ai_period"),
            )
            .where(DraftTicket.tenant_id.in_(tenant_ids))
            .group_by(DraftTicket.tenant_id)
        )
        for r in draft_rows:
            acc[r.tenant_id].update(inbox_pending=r.pending, ai_usage_today=r.ai_today, ai_usage_period=r.ai_period)

        # Contacts created in range (excluding soft-deleted).
        contact_rows = await db.execute(
            select(Contact.tenant_id, func.count(Contact.id).label("created"))
            .where(
                Contact.tenant_id.in_(tenant_ids),
                Contact.deleted_at.is_(None),
                Contact.created_at >= start,
                Contact.created_at <= end,
            )
            .group_by(Contact.tenant_id)
        )
        for r in contact_rows:
            acc[r.tenant_id]["contacts_created"] = r.created

        # Active users today (logged in since UTC midnight).
        user_rows = await db.execute(
            select(User.tenant_id, func.count(User.id).label("active"))
            .where(
                User.tenant_id.in_(tenant_ids),
                User.last_login_at.is_not(None),
                User.last_login_at >= today_start,
            )
            .group_by(User.tenant_id)
        )
        for r in user_rows:
            acc[r.tenant_id]["active_users_today"] = r.active

        # SaaS events in range (domain='saas', any tenant that has the module).
        from app.modules.saas.models import SaasEvent

        saas_rows = await db.execute(
            select(SaasEvent.tenant_id, func.count(SaasEvent.id).label("events"))
            .where(
                SaasEvent.tenant_id.in_(tenant_ids),
                SaasEvent.event_domain == "saas",
                SaasEvent.created_at >= start,
                SaasEvent.created_at <= end,
            )
            .group_by(SaasEvent.tenant_id)
        )
        for r in saas_rows:
            acc[r.tenant_id]["saas_events_period"] = r.events

    rows = [
        TenantStatRow(
            tenant_id=t.id, name=t.name, slug=t.slug, plan=t.plan, is_active=t.is_active,
            **acc[t.id],
        )
        for t in tenants
    ]

    summary = SuperAdminStatsSummary(
        total_tenants=len(rows),
        active_tenants=sum(1 for t in tenants if t.is_active),
        total_tickets_open=sum(r.tickets_open for r in rows),
        total_tickets_overdue=sum(r.tickets_overdue for r in rows),
        total_inbox_pending=sum(r.inbox_pending for r in rows),
        total_ai_usage_today=sum(r.ai_usage_today for r in rows),
        total_contacts_created=sum(r.contacts_created for r in rows),
    )

    return SuperAdminStats(summary=summary, tenants=rows, start=start, end=end)


async def promote_superadmin(
    db: AsyncSession,
    current_user: User,
    target_email: str,
    current_password: str,
) -> User | None:
    if not await asyncio.to_thread(_bcrypt.checkpw, current_password.encode(), current_user.hashed_password.encode()):
        raise ValueError("Incorrect password.")
    target = await db.scalar(select(User).where(User.email == target_email))
    if target is None:
        raise LookupError(f"No user found with email '{target_email}'.")
    target.role = UserRole.superadmin
    await db.commit()
    await db.refresh(target)
    return target
