from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.tickets.models import (
    MessageSource,
    ResponseTemplate,
    Ticket,
    TicketComment,
    TicketPriority,
    TicketStatus,
)
from app.modules.tickets.schemas import CommentCreate, TemplateCreate, TicketCreate, TicketOut, TicketUpdate

SLA_HOURS = {
    TicketPriority.urgent: 4,
    TicketPriority.high: 8,
    TicketPriority.medium: 24,
    TicketPriority.low: 72,
}


class TenantScopeError(ValueError):
    """Raised when a referenced FK does not belong to the caller's tenant."""


async def _validate_ticket_fks(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    contact_id: Optional[uuid.UUID] = None,
    department_id: Optional[uuid.UUID] = None,
    assigned_to: Optional[uuid.UUID] = None,
) -> None:
    """Ensure any referenced contact/department/user belongs to ``tenant_id`` (prevents IDOR)."""
    from app.core.models import User
    from app.modules.contacts.models import Contact
    from app.modules.departments.models import Department

    checks = [
        (contact_id, Contact, "contact_id"),
        (department_id, Department, "department_id"),
        (assigned_to, User, "assigned_to"),
    ]
    for value, model, label in checks:
        if value is None:
            continue
        exists = await db.scalar(
            select(model.id).where(model.id == value, model.tenant_id == tenant_id)
        )
        if exists is None:
            raise TenantScopeError(f"{label} does not belong to this tenant")


def compute_sla_due(priority: TicketPriority) -> datetime:
    hours = SLA_HOURS[priority]
    return datetime.now(timezone.utc) + timedelta(hours=hours)


def _enrich_tickets(tickets: list[Ticket], dept_names: dict, last_comments: dict) -> list[TicketOut]:
    """Convert ORM tickets to TicketOut with department_name and last_comment."""
    result = []
    for t in tickets:
        out = TicketOut.model_validate(t)
        out.department_name = dept_names.get(str(t.department_id)) if t.department_id else None
        lc = last_comments.get(str(t.id))
        if lc:
            out.last_comment = lc[0][:200] if lc[0] else None
            out.last_comment_at = lc[1]
        result.append(out)
    return result


async def _fetch_dept_names(db: AsyncSession, tickets: list[Ticket]) -> dict:
    dept_ids = {str(t.department_id) for t in tickets if t.department_id}
    if not dept_ids:
        return {}
    from app.modules.departments.models import Department
    rows = await db.execute(
        select(Department.id, Department.name).where(Department.id.in_([uuid.UUID(d) for d in dept_ids]))
    )
    return {str(r.id): r.name for r in rows}


async def _fetch_last_comments(db: AsyncSession, ticket_ids: list[uuid.UUID]) -> dict:
    if not ticket_ids:
        return {}
    # Subquery: latest comment per ticket
    subq = (
        select(
            TicketComment.ticket_id,
            TicketComment.body,
            TicketComment.created_at,
        )
        .where(TicketComment.ticket_id.in_(ticket_ids))
        .order_by(TicketComment.ticket_id, TicketComment.created_at.desc())
        .distinct(TicketComment.ticket_id)
    )
    rows = await db.execute(subq)
    return {str(r.ticket_id): (r.body, r.created_at) for r in rows}


async def list_tickets(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    status: Optional[TicketStatus] = None,
    assigned_to: Optional[uuid.UUID] = None,
    contact_id: Optional[uuid.UUID] = None,
    department_id: Optional[uuid.UUID] = None,
    skip: int = 0,
    limit: int = 50,
) -> tuple[list[TicketOut], int]:
    q = select(Ticket).where(Ticket.tenant_id == tenant_id, Ticket.deleted_at.is_(None))
    if status:
        q = q.where(Ticket.status == status)
    if assigned_to:
        q = q.where(Ticket.assigned_to == assigned_to)
    if contact_id:
        q = q.where(Ticket.contact_id == contact_id)
    if department_id:
        q = q.where(Ticket.department_id == department_id)
    total = await db.scalar(select(func.count()).select_from(q.subquery()))
    result = await db.execute(q.order_by(Ticket.created_at.desc()).offset(skip).limit(limit))
    tickets = list(result.scalars().all())
    dept_names = await _fetch_dept_names(db, tickets)
    last_comments = await _fetch_last_comments(db, [t.id for t in tickets])
    return _enrich_tickets(tickets, dept_names, last_comments), total or 0


async def count_deadline_badges(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    red_hours: int = 24,
    orange_hours: int = 48,
) -> dict:
    """Return red/orange badge counts for the Tickets nav item.

    Red: overdue OR due within red_hours (default ≤ 1 day).
    Orange: due within orange_hours but NOT already red.
    Red tickets are excluded from the orange count.
    """
    now = datetime.now(timezone.utc)
    red_cutoff = now + timedelta(hours=red_hours)
    orange_cutoff = now + timedelta(hours=orange_hours)

    base = and_(
        Ticket.tenant_id == tenant_id,
        Ticket.deleted_at.is_(None),
        Ticket.status.in_([TicketStatus.open, TicketStatus.in_progress]),
        Ticket.sla_due_at.isnot(None),
    )

    red_result = await db.scalar(
        select(func.count()).where(base, Ticket.sla_due_at <= red_cutoff)
    )
    orange_result = await db.scalar(
        select(func.count()).where(
            base,
            Ticket.sla_due_at > red_cutoff,
            Ticket.sla_due_at <= orange_cutoff,
        )
    )
    return {"red": red_result or 0, "orange": orange_result or 0}


async def deadline_severity(
    db: AsyncSession, tenant_id: uuid.UUID, red_days: int, orange_days: int
) -> dict:
    """Bucket open/in-progress tickets by deadline urgency for the Sidebar indicator.

    - red:    overdue OR due within `red_days` days (today/tomorrow)
    - orange: due within `orange_days` days, beyond the red window
    The severity returned is the most urgent bucket that has any tickets.
    """
    now = datetime.now(timezone.utc)
    red_cutoff = now + timedelta(days=max(red_days, 0))
    orange_cutoff = now + timedelta(days=max(orange_days, red_days, 0))

    base = (
        Ticket.tenant_id == tenant_id,
        Ticket.deleted_at.is_(None),
        Ticket.status.in_([TicketStatus.open, TicketStatus.in_progress]),
        Ticket.sla_due_at.isnot(None),
    )
    red = await db.scalar(
        select(func.count()).where(*base, Ticket.sla_due_at <= red_cutoff)
    ) or 0
    orange = await db.scalar(
        select(func.count()).where(
            *base,
            Ticket.sla_due_at > red_cutoff,
            Ticket.sla_due_at <= orange_cutoff,
        )
    ) or 0

    if red:
        severity = "red"
    elif orange:
        severity = "orange"
    else:
        severity = None
    return {
        "severity": severity,
        "count": red + orange,
        "red": red,
        "orange": orange,
    }


async def get_ticket_orm(db: AsyncSession, tenant_id: uuid.UUID, ticket_id: uuid.UUID) -> Optional[Ticket]:
    """Return the raw ORM Ticket — needed for update/status/comment mutations."""
    result = await db.execute(
        select(Ticket).where(
            Ticket.tenant_id == tenant_id, Ticket.id == ticket_id, Ticket.deleted_at.is_(None)
        )
    )
    return result.scalar_one_or_none()


async def soft_delete_ticket(db: AsyncSession, ticket: Ticket) -> None:
    ticket.deleted_at = datetime.now(timezone.utc)
    await db.commit()


async def get_ticket(db: AsyncSession, tenant_id: uuid.UUID, ticket_id: uuid.UUID) -> Optional[TicketOut]:
    ticket = await get_ticket_orm(db, tenant_id, ticket_id)
    if not ticket:
        return None
    dept_names = await _fetch_dept_names(db, [ticket])
    last_comments = await _fetch_last_comments(db, [ticket.id])
    return _enrich_tickets([ticket], dept_names, last_comments)[0]


async def create_ticket(
    db: AsyncSession, tenant_id: uuid.UUID, created_by: Optional[uuid.UUID], data: TicketCreate
) -> TicketOut:
    await _validate_ticket_fks(
        db, tenant_id,
        contact_id=data.contact_id,
        department_id=data.department_id,
        assigned_to=data.assigned_to,
    )
    ticket = Ticket(
        tenant_id=tenant_id,
        created_by=created_by,
        sla_due_at=compute_sla_due(data.priority),
        **data.model_dump(),
    )
    db.add(ticket)
    await db.commit()
    await db.refresh(ticket)
    dept_names = await _fetch_dept_names(db, [ticket])
    return _enrich_tickets([ticket], dept_names, {})[0]


async def update_ticket(db: AsyncSession, ticket: Ticket, data: TicketUpdate) -> TicketOut:
    fields = data.model_dump(exclude_unset=True)
    await _validate_ticket_fks(
        db, ticket.tenant_id,
        contact_id=fields.get("contact_id"),
        department_id=fields.get("department_id"),
        assigned_to=fields.get("assigned_to"),
    )
    for field, value in fields.items():
        setattr(ticket, field, value)
    await db.commit()
    await db.refresh(ticket)
    dept_names = await _fetch_dept_names(db, [ticket])
    last_comments = await _fetch_last_comments(db, [ticket.id])
    return _enrich_tickets([ticket], dept_names, last_comments)[0]


async def change_status(db: AsyncSession, ticket: Ticket, new_status: TicketStatus) -> TicketOut:
    ticket.status = new_status
    if new_status in (TicketStatus.resolved, TicketStatus.closed):
        ticket.resolved_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(ticket)
    dept_names = await _fetch_dept_names(db, [ticket])
    last_comments = await _fetch_last_comments(db, [ticket.id])
    return _enrich_tickets([ticket], dept_names, last_comments)[0]


async def add_comment(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    ticket: Ticket,
    author_id: Optional[uuid.UUID],
    data: CommentCreate,
    source: MessageSource = MessageSource.manual,
) -> TicketComment:
    comment = TicketComment(
        tenant_id=tenant_id,
        ticket_id=ticket.id,
        author_id=author_id,
        body=data.body,
        is_internal=data.is_internal,
        source=source,
    )
    db.add(comment)
    await db.commit()
    await db.refresh(comment)
    return comment


async def list_comments(db: AsyncSession, tenant_id: uuid.UUID, ticket_id: uuid.UUID) -> list[TicketComment]:
    result = await db.execute(
        select(TicketComment)
        .where(TicketComment.tenant_id == tenant_id, TicketComment.ticket_id == ticket_id)
        .order_by(TicketComment.created_at)
    )
    return result.scalars().all()


async def list_templates(db: AsyncSession, tenant_id: uuid.UUID) -> list[ResponseTemplate]:
    result = await db.execute(
        select(ResponseTemplate).where(ResponseTemplate.tenant_id == tenant_id)
    )
    return result.scalars().all()


async def create_template(db: AsyncSession, tenant_id: uuid.UUID, data: TemplateCreate) -> ResponseTemplate:
    template = ResponseTemplate(tenant_id=tenant_id, **data.model_dump())
    db.add(template)
    await db.commit()
    await db.refresh(template)
    return template


async def get_ticket_stats(db: AsyncSession, tenant_id: uuid.UUID) -> dict:
    rows = await db.execute(
        select(Ticket.status, func.count().label("cnt"))
        .where(Ticket.tenant_id == tenant_id)
        .group_by(Ticket.status)
    )
    counts = {r.status.value: r.cnt for r in rows}
    return {
        "open": counts.get("open", 0),
        "in_progress": counts.get("in_progress", 0),
        "waiting": counts.get("waiting", 0),
        "resolved": counts.get("resolved", 0),
        "closed": counts.get("closed", 0),
    }
