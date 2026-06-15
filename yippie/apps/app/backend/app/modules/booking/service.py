from __future__ import annotations

import asyncio
import html as _html
import logging
import os
import uuid
from datetime import datetime, time, timedelta, timezone
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.email_html import render_email_html
from app.core.mailer import is_valid_email, send_email
from app.core.models import Tenant, User
from app.modules.booking.models import BookingToken, CalendarSettings
from app.modules.booking.schemas import (
    AvailableSlot,
    BookingTokenCreate,
    CalendarSettingsUpdate,
)
from app.modules.calendar.models import CalendarEvent
from app.modules.contacts.models import Contact

logger = logging.getLogger(__name__)

CLIENT_BASE_URL = os.environ.get("CLIENT_BASE_URL", "https://sandbox.getyippie.com")

_WEEKDAYS = ("Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday")
_MONTHS = (
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
)


def _format_slot(start: datetime, end: datetime) -> str:
    """e.g. 'Monday 16 June 2026, 14:00–14:30'."""
    day = f"{_WEEKDAYS[start.weekday()]} {start.day} {_MONTHS[start.month - 1]} {start.year}"
    return f"{day}, {start:%H:%M}–{end:%H:%M}"


def _now() -> datetime:
    return datetime.now(timezone.utc)


# --------------------------------------------------------------------------- #
# Settings
# --------------------------------------------------------------------------- #
async def get_or_create_settings(db: AsyncSession, tenant_id: uuid.UUID) -> CalendarSettings:
    settings = await db.scalar(
        select(CalendarSettings).where(CalendarSettings.tenant_id == tenant_id)
    )
    if settings is None:
        settings = CalendarSettings(tenant_id=tenant_id)
        db.add(settings)
        await db.commit()
        await db.refresh(settings)
    return settings


async def update_settings(
    db: AsyncSession, tenant_id: uuid.UUID, data: CalendarSettingsUpdate
) -> CalendarSettings:
    settings = await get_or_create_settings(db, tenant_id)
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(settings, field, value)
    await db.commit()
    await db.refresh(settings)
    return settings


# --------------------------------------------------------------------------- #
# Availability
# --------------------------------------------------------------------------- #
async def get_available_slots(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    settings: CalendarSettings,
    days_ahead: int,
) -> list[AvailableSlot]:
    """Generate open/closed slots for the next ``days_ahead`` weekdays.

    Only availability (a boolean) is exposed — never event details.
    """
    now = _now()
    today = now.date()
    step = timedelta(minutes=settings.slot_minutes)

    # Build the candidate slot list first, then bulk-check overlap against events.
    slots: list[tuple[datetime, datetime]] = []
    window_start: Optional[datetime] = None
    window_end: Optional[datetime] = None

    for offset in range(1, days_ahead + 1):
        day = today + timedelta(days=offset)
        # Skip weekends (Saturday=5, Sunday=6)
        if day.weekday() >= 5:
            continue
        cursor = datetime.combine(day, time(hour=settings.work_start_hour), tzinfo=timezone.utc)
        day_end = datetime.combine(day, time(hour=0), tzinfo=timezone.utc) + timedelta(
            hours=settings.work_end_hour
        )
        while cursor + step <= day_end:
            slot_start = cursor
            slot_end = cursor + step
            cursor = slot_end
            if slot_start <= now:
                continue  # skip past slots
            slots.append((slot_start, slot_end))
            if window_start is None or slot_start < window_start:
                window_start = slot_start
            if window_end is None or slot_end > window_end:
                window_end = slot_end

    if not slots:
        return []

    # Fetch events overlapping the whole window, then test each slot in memory.
    result = await db.execute(
        select(CalendarEvent.start_at, CalendarEvent.end_at).where(
            CalendarEvent.tenant_id == tenant_id,
            CalendarEvent.start_at < window_end,
            CalendarEvent.end_at > window_start,
        )
    )
    events = [(r.start_at, r.end_at) for r in result.all() if r.end_at is not None]

    out: list[AvailableSlot] = []
    for slot_start, slot_end in slots:
        overlap = any(ev_start < slot_end and ev_end > slot_start for ev_start, ev_end in events)
        out.append(AvailableSlot(start=slot_start, end=slot_end, available=not overlap))
    return out


# --------------------------------------------------------------------------- #
# Token creation
# --------------------------------------------------------------------------- #
async def create_booking_token(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    created_by_id: uuid.UUID,
    data: BookingTokenCreate,
) -> BookingToken:
    contact = await db.scalar(
        select(Contact).where(Contact.id == data.contact_id, Contact.tenant_id == tenant_id)
    )
    if contact is None:
        raise ValueError("contact_id does not belong to this tenant")

    settings = await get_or_create_settings(db, tenant_id)

    proposed = (
        [{"start": s.start.isoformat(), "end": s.end.isoformat()} for s in data.proposed_slots]
        if data.proposed_slots
        else None
    )

    token = BookingToken(
        tenant_id=tenant_id,
        contact_id=data.contact_id,
        created_by=created_by_id,
        mode=data.mode,
        proposed_slots=proposed,
        message=data.message,
        expires_at=_now() + timedelta(days=settings.booking_expiry_days),
    )
    db.add(token)
    await db.commit()
    await db.refresh(token)

    agent = await db.get(User, created_by_id)
    tenant = await db.get(Tenant, tenant_id)
    asyncio.create_task(_send_booking_invitation(token, contact, tenant, agent))
    return token


# --------------------------------------------------------------------------- #
# Listing / revoke
# --------------------------------------------------------------------------- #
def token_status(token: BookingToken) -> str:
    if token.booked_at is not None:
        return "booked"
    expires = token.expires_at
    if expires.tzinfo is None:
        expires = expires.replace(tzinfo=timezone.utc)
    if expires <= _now():
        return "expired"
    return "pending"


async def list_tokens(db: AsyncSession, tenant_id: uuid.UUID) -> list[dict]:
    result = await db.execute(
        select(BookingToken)
        .where(BookingToken.tenant_id == tenant_id)
        .order_by(BookingToken.created_at.desc())
    )
    tokens = list(result.scalars().all())

    contact_ids = {t.contact_id for t in tokens}
    user_ids = {t.created_by for t in tokens}
    contact_names: dict[uuid.UUID, str] = {}
    user_names: dict[uuid.UUID, str] = {}
    if contact_ids:
        rows = await db.execute(
            select(Contact.id, Contact.full_name).where(Contact.id.in_(contact_ids))
        )
        contact_names = {r.id: r.full_name for r in rows}
    if user_ids:
        rows = await db.execute(select(User.id, User.full_name).where(User.id.in_(user_ids)))
        user_names = {r.id: r.full_name for r in rows}

    out = []
    for t in tokens:
        out.append(
            {
                "id": t.id,
                "contact_id": t.contact_id,
                "contact_name": contact_names.get(t.contact_id),
                "created_by": t.created_by,
                "created_by_name": user_names.get(t.created_by),
                "mode": t.mode,
                "proposed_slots": t.proposed_slots,
                "message": t.message,
                "expires_at": t.expires_at,
                "booked_at": t.booked_at,
                "event_id": t.event_id,
                "created_at": t.created_at,
                "status": token_status(t),
            }
        )
    return out


async def revoke_token(db: AsyncSession, tenant_id: uuid.UUID, token_id: uuid.UUID) -> bool:
    token = await db.scalar(
        select(BookingToken).where(
            BookingToken.id == token_id, BookingToken.tenant_id == tenant_id
        )
    )
    if token is None:
        return False
    token.expires_at = _now()
    await db.commit()
    return True


# --------------------------------------------------------------------------- #
# Public: fetch + confirm
# --------------------------------------------------------------------------- #
async def get_token(db: AsyncSession, token_id: uuid.UUID) -> Optional[BookingToken]:
    return await db.scalar(select(BookingToken).where(BookingToken.id == token_id))


async def confirm_booking(
    db: AsyncSession,
    token: BookingToken,
    slot_start: datetime,
    slot_end: datetime,
) -> CalendarEvent:
    if slot_start.tzinfo is None:
        slot_start = slot_start.replace(tzinfo=timezone.utc)
    if slot_end.tzinfo is None:
        slot_end = slot_end.replace(tzinfo=timezone.utc)

    # Row-lock the token for the rest of this transaction so two concurrent
    # confirmations of the same link can't both pass the "already used" check
    # and double-book the slot.
    token = await db.scalar(
        select(BookingToken).where(BookingToken.id == token.id).with_for_update()
    )
    if token is None:
        raise ValueError("This booking link has expired or has already been used.")

    expires = token.expires_at
    if expires.tzinfo is None:
        expires = expires.replace(tzinfo=timezone.utc)
    if expires <= _now():
        raise ValueError("This booking link has expired.")
    if token.booked_at is not None:
        raise ValueError("This booking link has already been used.")
    if slot_end <= slot_start:
        raise ValueError("Invalid time slot.")

    # Re-check availability against current events (race-safe at confirm time).
    conflict = await db.scalar(
        select(CalendarEvent.id).where(
            CalendarEvent.tenant_id == token.tenant_id,
            CalendarEvent.start_at < slot_end,
            CalendarEvent.end_at > slot_start,
        )
    )
    if conflict is not None:
        raise ValueError("That time is no longer available. Please pick another slot.")

    contact = await db.get(Contact, token.contact_id)
    if contact is None:
        raise ValueError("Contact not found.")

    event = CalendarEvent(
        tenant_id=token.tenant_id,
        title=f"Meeting with {contact.full_name}",
        start_at=slot_start,
        end_at=slot_end,
        contact_id=token.contact_id,
        created_by=token.created_by,
    )
    db.add(event)
    await db.flush()

    token.booked_at = _now()
    token.event_id = event.id

    # Move contact to the configured post-booking pipeline stage, if any.
    settings = await db.scalar(
        select(CalendarSettings).where(CalendarSettings.tenant_id == token.tenant_id)
    )
    if settings is not None and settings.post_booking_stage_id is not None:
        from app.modules.pipeline.service import _assign_stage

        await _assign_stage(
            db, token.tenant_id, token.contact_id, settings.post_booking_stage_id
        )

    await db.commit()
    await db.refresh(event)

    tenant = await db.get(Tenant, token.tenant_id)
    agent = await db.get(User, token.created_by)
    asyncio.create_task(_notify_customer_confirmed(event, contact, tenant))
    asyncio.create_task(_notify_agent_confirmed(event, contact, agent))
    return event


# --------------------------------------------------------------------------- #
# Emails — each opens its own session and never raises.
# --------------------------------------------------------------------------- #
async def _send_booking_invitation(
    token: BookingToken, contact: Contact, tenant: Optional[Tenant], agent: Optional[User]
) -> None:
    try:
        if contact is None or not contact.email or not is_valid_email(contact.email):
            return
        tenant_name = tenant.name if tenant else "Yippie"
        primary_color = tenant.primary_color if tenant else None
        agent_name = agent.full_name if agent else tenant_name
        booking_url = f"{CLIENT_BASE_URL}/book/{token.id}"

        first_name = (contact.full_name or "there").split(" ")[0]
        subject = f"{agent_name} would like to book a meeting with you"

        lines = [f"Hi {first_name},", ""]
        if token.message:
            lines += [token.message, ""]
        if token.mode == "propose" and token.proposed_slots:
            lines.append("Proposed times:")
            for s in token.proposed_slots:
                start = datetime.fromisoformat(s["start"])
                end = datetime.fromisoformat(s["end"])
                lines.append(f"  • {_format_slot(start, end)}")
            lines.append("")
            lines.append("Pick a time that works for you here:")
        else:
            lines.append("Choose a time that works for you here:")
        lines += [booking_url, "", f"Sent by {tenant_name} via Yippie."]
        body_text = "\n".join(lines)

        msg_html = (
            f'<p style="margin:0 0 14px 0;line-height:1.55;">'
            f"{_html.escape(token.message).replace(chr(10), '<br>')}</p>"
            if token.message
            else ""
        )
        slots_html = ""
        if token.mode == "propose" and token.proposed_slots:
            items = "".join(
                f'<li style="margin:0 0 6px 0;">'
                f"{_html.escape(_format_slot(datetime.fromisoformat(s['start']), datetime.fromisoformat(s['end'])))}"
                f"</li>"
                for s in token.proposed_slots
            )
            slots_html = (
                '<p style="margin:0 0 8px 0;font-weight:600;">Proposed times:</p>'
                f'<ul style="margin:0 0 14px 0;padding-left:20px;">{items}</ul>'
            )
        content = (
            f'<h2 style="margin:0 0 12px 0;font-size:20px;">Hi {_html.escape(first_name)},</h2>'
            f"{msg_html}{slots_html}"
            f'<p style="margin:18px 0;">'
            f'<a href="{_html.escape(booking_url, quote=True)}" '
            f'style="display:inline-block;padding:12px 24px;background:'
            f'{primary_color or "#5BB8E8"};color:#ffffff;border-radius:6px;'
            f'text-decoration:none;font-weight:600;">Book a time</a></p>'
            f'<p style="margin:18px 0 0 0;font-size:13px;color:#6b7280;">'
            f"Sent by {_html.escape(tenant_name)} via Yippie.</p>"
        )
        html_body = render_email_html(
            body_text,
            tenant_name=tenant_name,
            primary_color=primary_color,
            prerendered_html=content,
        )
        await send_email(to=contact.email, subject=subject, body=body_text, html=html_body)
    except Exception:  # noqa: BLE001 — notification must never break the request
        logger.exception("Failed to send booking invitation for token %s", getattr(token, "id", "?"))


async def _notify_customer_confirmed(
    event: CalendarEvent, contact: Contact, tenant: Optional[Tenant]
) -> None:
    try:
        if contact is None or not contact.email or not is_valid_email(contact.email):
            return
        tenant_name = tenant.name if tenant else "Yippie"
        primary_color = tenant.primary_color if tenant else None
        when = _format_slot(event.start_at, event.end_at)
        subject = f"Your meeting with {tenant_name} is confirmed"

        body_text = "\n".join(
            [
                f"Your meeting with {tenant_name} is confirmed.",
                "",
                when,
                "",
                f"Confirmed via {tenant_name} on Yippie.",
            ]
        )
        content = (
            f'<h2 style="margin:0 0 12px 0;font-size:20px;">You\'re booked!</h2>'
            f'<p style="margin:0 0 14px 0;">Your meeting with '
            f"{_html.escape(tenant_name)} is confirmed.</p>"
            f'<p style="margin:0 0 14px 0;font-weight:600;color:#374151;">{_html.escape(when)}</p>'
            f'<p style="margin:18px 0 0 0;font-size:13px;color:#6b7280;">'
            f"Confirmed via {_html.escape(tenant_name)} on Yippie.</p>"
        )
        html_body = render_email_html(
            body_text,
            tenant_name=tenant_name,
            primary_color=primary_color,
            prerendered_html=content,
        )
        await send_email(to=contact.email, subject=subject, body=body_text, html=html_body)
    except Exception:  # noqa: BLE001
        logger.exception("Failed to send customer confirmation for event %s", getattr(event, "id", "?"))


async def _notify_agent_confirmed(
    event: CalendarEvent, contact: Contact, agent_user: Optional[User]
) -> None:
    try:
        if agent_user is None:
            return
        to_addr = agent_user.inbound_email or agent_user.email
        if not to_addr or not is_valid_email(to_addr):
            return
        when = _format_slot(event.start_at, event.end_at)
        contact_name = contact.full_name if contact else "A contact"
        subject = f"{contact_name} booked a meeting — {when}"

        lines = [f"{contact_name} booked a meeting.", "", when]
        if contact and contact.email:
            lines += ["", f"Contact email: {contact.email}"]
        body_text = "\n".join(lines)

        contact_html = (
            f'<p style="margin:0 0 14px 0;">Contact: {_html.escape(contact.email)}</p>'
            if contact and contact.email
            else ""
        )
        content = (
            f'<h2 style="margin:0 0 12px 0;font-size:20px;">'
            f"{_html.escape(contact_name)} booked a meeting</h2>"
            f'<p style="margin:0 0 14px 0;font-weight:600;color:#374151;">{_html.escape(when)}</p>'
            f"{contact_html}"
        )
        html_body = render_email_html(body_text, prerendered_html=content)
        await send_email(to=to_addr, subject=subject, body=body_text, html=html_body)
    except Exception:  # noqa: BLE001
        logger.exception("Failed to send agent confirmation for event %s", getattr(event, "id", "?"))
