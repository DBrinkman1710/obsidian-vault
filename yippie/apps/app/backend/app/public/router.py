from __future__ import annotations

import os
import re
import time
import uuid
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, EmailStr
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

# Simple in-memory rate limiter — 5 demo requests per IP per hour. This is not a
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


class RequestDemo(BaseModel):
    name: str
    company_name: str
    email: EmailStr
    slug: Optional[str] = None


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
    from app.auth.invite import send_invite_email
    from app.core.mailer import ResendNotConfiguredError
    from app.core.models import User, UserRole
    from app.modules.admin.schemas import TenantCreate
    from app.modules.admin.service import create_tenant
    from app.modules.contacts.models import Contact, contact_label_links
    from app.modules.tickets.models import MessageSource, Ticket, TicketPriority, TicketStatus

    ip = (request.client.host if request.client else None) or "unknown"
    _check_rate_limit(ip)

    # Reject duplicate accounts before creating anything (create_tenant also guards this).
    existing = await db.scalar(select(User.id).where(func.lower(User.email) == body.email.lower()))
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A user with this email already exists.",
        )

    root_tenant_id = await _resolve_root_tenant_id(db)

    base_slug = _slugify(body.slug or body.company_name)
    slug = await _unique_slug(db, base_slug)

    # create_tenant commits + sends the invite. No admin_password => set-password invite.
    try:
        tenant = await create_tenant(
            db,
            TenantCreate(
                name=body.company_name,
                slug=slug,
                admin_email=body.email,
                admin_full_name=body.name,
                is_demo=True,
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

    # File a follow-up Contact + Ticket in the root owner's own tenant.
    label = await _ensure_demo_label(db, root_tenant_id)
    contact = Contact(
        tenant_id=root_tenant_id,
        full_name=body.name,
        email=body.email,
        company=body.company_name,
    )
    db.add(contact)
    await db.flush()
    await db.execute(
        contact_label_links.insert().values(contact_id=contact.id, label_id=label.id)
    )

    now = datetime.now(timezone.utc)
    db.add(Ticket(
        tenant_id=root_tenant_id,
        contact_id=contact.id,
        subject=f"Follow up: {body.company_name} demo",
        description=(
            f"Demo requested by {body.name} ({body.email}). "
            f"Tenant slug: {slug}. 3-day follow-up."
        ),
        status=TicketStatus.open,
        priority=TicketPriority.medium,
        source=MessageSource.manual,
        # The Ticket model has no follow_up_at column (that field lives on draft_tickets);
        # sla_due_at is the ticket's deadline field, so the 3-day follow-up rides on it.
        sla_due_at=now + timedelta(days=3),
    ))
    await db.commit()

    return {"tenant_id": str(tenant_id), "slug": slug, "invited": True}


# --------------------------------------------------------------------------- #
# Public booking (BK1) — customer-facing, no auth. Tenant context is set from
# the token's own tenant_id once the token is resolved.
# --------------------------------------------------------------------------- #

# BK7 manage endpoints — MUST be declared before /booking/{token_id} so FastAPI
# does not swallow /booking/manage/{x} as if it were a token_id.

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
