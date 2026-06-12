from __future__ import annotations

import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.calendar.models import CalendarEvent
from app.modules.calendar.schemas import (
    CalendarEventCreate,
    CalendarEventOut,
    CalendarEventUpdate,
    CalendarItem,
)
from app.modules.contacts.models import Contact
from app.modules.tickets.models import Ticket, TicketStatus


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


async def create_event(
    db: AsyncSession, tenant_id: uuid.UUID, created_by: uuid.UUID, data: CalendarEventCreate
) -> CalendarEventOut:
    await _validate_event_fks(db, tenant_id, contact_id=data.contact_id, ticket_id=data.ticket_id)
    event = CalendarEvent(tenant_id=tenant_id, created_by=created_by, **data.model_dump())
    db.add(event)
    await db.commit()
    await db.refresh(event)
    return await _to_event_out(db, event)


async def update_event(
    db: AsyncSession, event: CalendarEvent, data: CalendarEventUpdate
) -> CalendarEventOut:
    fields = data.model_dump(exclude_unset=True)
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
    for field, value in fields.items():
        setattr(event, field, value)
    await db.commit()
    await db.refresh(event)
    return await _to_event_out(db, event)


async def delete_event(db: AsyncSession, event: CalendarEvent) -> None:
    await db.delete(event)
    await db.commit()
