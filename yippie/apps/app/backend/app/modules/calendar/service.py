from __future__ import annotations

import html as _html
import logging
import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.email_html import render_email_html
from app.core.mailer import is_valid_email, send_email
from app.core.models import Tenant
from app.modules.calendar.models import CalendarEvent
from app.modules.calendar.schemas import (
    CalendarEventCreate,
    CalendarEventOut,
    CalendarEventUpdate,
    CalendarItem,
)
from app.modules.contacts.models import Contact
from app.modules.tickets.models import Ticket, TicketStatus

logger = logging.getLogger(__name__)


class TenantScopeError(ValueError):
    """Raised when a referenced FK does not belong to the caller's tenant."""


async def _validate_event_fks(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    contact_id: Optional[uuid.UUID] = None,
    ticket_id: Optional[uuid.UUID] = None,
) -> None:
    """Ensure any referenced contact/ticket belongs to ``tenant_id`` (prevents IDOR)."""
    if contact_id is not None:
        exists = await db.scalar(
            select(Contact.id).where(Contact.id == contact_id, Contact.tenant_id == tenant_id)
        )
        if exists is None:
            raise TenantScopeError("contact_id does not belong to this tenant")
    if ticket_id is not None:
        exists = await db.scalar(
            select(Ticket.id).where(
                Ticket.id == ticket_id,
                Ticket.tenant_id == tenant_id,
                Ticket.deleted_at.is_(None),
            )
        )
        if exists is None:
            raise TenantScopeError("ticket_id does not belong to this tenant")


async def _fetch_contact_names(db: AsyncSession, contact_ids: set[uuid.UUID]) -> dict[uuid.UUID, str]:
    if not contact_ids:
        return {}
    rows = await db.execute(select(Contact.id, Contact.full_name).where(Contact.id.in_(contact_ids)))
    return {r.id: r.full_name for r in rows}


async def _fetch_ticket_subjects(db: AsyncSession, ticket_ids: set[uuid.UUID]) -> dict[uuid.UUID, str]:
    if not ticket_ids:
        return {}
    rows = await db.execute(select(Ticket.id, Ticket.subject).where(Ticket.id.in_(ticket_ids)))
    return {r.id: r.subject for r in rows}


async def _to_event_out(db: AsyncSession, event: CalendarEvent) -> CalendarEventOut:
    out = CalendarEventOut.model_validate(event)
    if event.contact_id:
        names = await _fetch_contact_names(db, {event.contact_id})
        out.contact_name = names.get(event.contact_id)
    if event.ticket_id:
        subjects = await _fetch_ticket_subjects(db, {event.ticket_id})
        out.ticket_subject = subjects.get(event.ticket_id)
    return out


async def list_calendar_items(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    start: datetime,
    end: datetime,
) -> list[CalendarItem]:
    """Standalone events plus open-ticket deadlines whose date falls in [start, end)."""
    # 1. Standalone events
    result = await db.execute(
        select(CalendarEvent)
        .where(
            CalendarEvent.tenant_id == tenant_id,
            CalendarEvent.start_at >= start,
            CalendarEvent.start_at < end,
        )
        .order_by(CalendarEvent.start_at)
    )
    events = list(result.scalars().all())

    contact_names = await _fetch_contact_names(db, {e.contact_id for e in events if e.contact_id})
    ticket_subjects = await _fetch_ticket_subjects(db, {e.ticket_id for e in events if e.ticket_id})

    items = [
        CalendarItem(
            kind="event",
            id=e.id,
            title=e.title,
            start_at=e.start_at,
            end_at=e.end_at,
            all_day=e.all_day,
            description=e.description,
            contact_id=e.contact_id,
            contact_name=contact_names.get(e.contact_id) if e.contact_id else None,
            ticket_id=e.ticket_id,
            ticket_subject=ticket_subjects.get(e.ticket_id) if e.ticket_id else None,
        )
        for e in events
    ]

    # 2. Ticket deadlines — read-only markers for open work that is due in range
    result = await db.execute(
        select(Ticket)
        .where(
            Ticket.tenant_id == tenant_id,
            Ticket.deleted_at.is_(None),
            Ticket.status.in_([TicketStatus.open, TicketStatus.in_progress, TicketStatus.waiting]),
            Ticket.sla_due_at.isnot(None),
            Ticket.sla_due_at >= start,
            Ticket.sla_due_at < end,
        )
        .order_by(Ticket.sla_due_at)
    )
    for t in result.scalars().all():
        items.append(
            CalendarItem(
                kind="deadline",
                id=t.id,
                title=t.subject,
                start_at=t.sla_due_at,
                contact_id=t.contact_id,
                ticket_id=t.id,
                ticket_subject=t.subject,
                ticket_status=t.status.value,
                ticket_priority=t.priority.value,
            )
        )

    items.sort(key=lambda i: i.start_at)
    return items


async def get_event_orm(
    db: AsyncSession, tenant_id: uuid.UUID, event_id: uuid.UUID
) -> Optional[CalendarEvent]:
    result = await db.execute(
        select(CalendarEvent).where(
            CalendarEvent.tenant_id == tenant_id, CalendarEvent.id == event_id
        )
    )
    return result.scalar_one_or_none()


async def get_event(
    db: AsyncSession, tenant_id: uuid.UUID, event_id: uuid.UUID
) -> Optional[CalendarEventOut]:
    event = await get_event_orm(db, tenant_id, event_id)
    if not event:
        return None
    return await _to_event_out(db, event)


_WEEKDAYS = ("Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday")
_MONTHS = (
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
)


def _format_when(start_at: datetime, end_at: Optional[datetime], all_day: bool) -> str:
    """Human-friendly date/time line, e.g. 'Monday 16 June 2026, 14:00–15:00'."""
    day = f"{_WEEKDAYS[start_at.weekday()]} {start_at.day} {_MONTHS[start_at.month - 1]} {start_at.year}"
    if all_day:
        return f"{day} (all day)"
    line = f"{day}, {start_at:%H:%M}"
    if end_at is not None:
        # Same-day events only show the end time; multi-day spell out the end date.
        if end_at.date() == start_at.date():
            line += f"–{end_at:%H:%M}"
        else:
            end_day = (
                f"{_WEEKDAYS[end_at.weekday()]} {end_at.day} "
                f"{_MONTHS[end_at.month - 1]} {end_at.year}"
            )
            line += f" – {end_day}, {end_at:%H:%M}"
    return line


async def _notify_contact(db: AsyncSession, event: CalendarEvent) -> None:
    """Email the linked contact about ``event``. Never raises — failures are logged.

    Caller is responsible for deciding *whether* to notify (contact_id set,
    notify_contact flag, change detection); this just builds and sends.
    """
    try:
        contact = await db.get(Contact, event.contact_id)
        if contact is None or not contact.email or not is_valid_email(contact.email):
            return

        tenant = await db.get(Tenant, event.tenant_id)
        tenant_name = tenant.name if tenant else "Yippie"
        primary_color = tenant.primary_color if tenant else None
        logo_url = tenant.logo_url if tenant else None

        when = _format_when(event.start_at, event.end_at, event.all_day)
        subject = f"You're invited: {event.title}"

        text_lines = [event.title, "", when]
        if event.description:
            text_lines += ["", event.description]
        text_lines += ["", f"This invitation was sent by {tenant_name} via Yippie."]
        body_text = "\n".join(text_lines)

        desc_html = (
            f'<p style="margin:0 0 14px 0;line-height:1.55;">'
            f"{_html.escape(event.description).replace(chr(10), '<br>')}</p>"
            if event.description
            else ""
        )
        content = (
            f'<h2 style="margin:0 0 12px 0;font-size:20px;">{_html.escape(event.title)}</h2>'
            f'<p style="margin:0 0 14px 0;font-weight:600;color:#374151;">{_html.escape(when)}</p>'
            f"{desc_html}"
            f'<p style="margin:18px 0 0 0;font-size:13px;color:#6b7280;">'
            f"This invitation was sent by {_html.escape(tenant_name)} via Yippie.</p>"
        )
        html_body = render_email_html(
            body_text,
            tenant_name=tenant_name,
            primary_color=primary_color,
            logo_url=logo_url,
            prerendered_html=content,
        )

        await send_email(to=contact.email, subject=subject, body=body_text, html=html_body)
    except Exception:  # noqa: BLE001 — notification must never break the request
        logger.exception("Failed to send calendar invitation email for event %s", event.id)


async def create_event(
    db: AsyncSession, tenant_id: uuid.UUID, created_by: uuid.UUID, data: CalendarEventCreate
) -> CalendarEventOut:
    await _validate_event_fks(db, tenant_id, contact_id=data.contact_id, ticket_id=data.ticket_id)
    notify = data.notify_contact
    payload = data.model_dump(exclude={"notify_contact"})
    event = CalendarEvent(tenant_id=tenant_id, created_by=created_by, **payload)
    db.add(event)
    await db.commit()
    await db.refresh(event)
    if event.contact_id is not None and notify:
        await _notify_contact(db, event)
    return await _to_event_out(db, event)


async def update_event(
    db: AsyncSession, event: CalendarEvent, data: CalendarEventUpdate
) -> CalendarEventOut:
    fields = data.model_dump(exclude_unset=True)
    notify = fields.pop("notify_contact", True)
    await _validate_event_fks(
        db,
        event.tenant_id,
        contact_id=fields.get("contact_id"),
        ticket_id=fields.get("ticket_id"),
    )
    new_start = fields.get("start_at", event.start_at)
    new_end = fields.get("end_at", event.end_at)
    if new_end is not None and new_end < new_start:
        raise ValueError("end_at must be after start_at")

    prev_contact_id = event.contact_id
    prev_start = event.start_at
    for field, value in fields.items():
        setattr(event, field, value)
    await db.commit()
    await db.refresh(event)

    # Only notify when there's a linked contact, notify is on, and something the
    # contact cares about changed: the contact link itself, or the start time.
    contact_changed = "contact_id" in fields and event.contact_id != prev_contact_id
    start_changed = "start_at" in fields and event.start_at != prev_start
    if event.contact_id is not None and notify and (contact_changed or start_changed):
        await _notify_contact(db, event)
    return await _to_event_out(db, event)


async def delete_event(db: AsyncSession, event: CalendarEvent) -> None:
    await db.delete(event)
    await db.commit()
