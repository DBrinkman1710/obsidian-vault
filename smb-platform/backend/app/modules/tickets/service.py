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
from app.modules.tickets.schemas import CommentCreate, TemplateCreate, TicketCreate, TicketUpdate

SLA_HOURS = {
    TicketPriority.urgent: 4,
    TicketPriority.high: 8,
    TicketPriority.medium: 24,
    TicketPriority.low: 72,
}


def compute_sla_due(priority: TicketPriority) -> datetime:
    hours = SLA_HOURS[priority]
    return datetime.now(timezone.utc) + timedelta(hours=hours)


async def list_tickets(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    status: Optional[TicketStatus] = None,
    assigned_to: Optional[uuid.UUID] = None,
    contact_id: Optional[uuid.UUID] = None,
    skip: int = 0,
    limit: int = 50,
) -> tuple[list[Ticket], int]:
    q = select(Ticket).where(Ticket.tenant_id == tenant_id)
    if status:
        q = q.where(Ticket.status == status)
    if assigned_to:
        q = q.where(Ticket.assigned_to == assigned_to)
    if contact_id:
        q = q.where(Ticket.contact_id == contact_id)
    total = await db.scalar(select(func.count()).select_from(q.subquery()))
    result = await db.execute(q.order_by(Ticket.created_at.desc()).offset(skip).limit(limit))
    return result.scalars().all(), total or 0


async def get_ticket(db: AsyncSession, tenant_id: uuid.UUID, ticket_id: uuid.UUID) -> Optional[Ticket]:
    result = await db.execute(
        select(Ticket).where(Ticket.tenant_id == tenant_id, Ticket.id == ticket_id)
    )
    return result.scalar_one_or_none()


async def create_ticket(
    db: AsyncSession, tenant_id: uuid.UUID, created_by: Optional[uuid.UUID], data: TicketCreate
) -> Ticket:
    ticket = Ticket(
        tenant_id=tenant_id,
        created_by=created_by,
        sla_due_at=compute_sla_due(data.priority),
        **data.model_dump(),
    )
    db.add(ticket)
    await db.commit()
    await db.refresh(ticket)
    return ticket


async def update_ticket(db: AsyncSession, ticket: Ticket, data: TicketUpdate) -> Ticket:
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(ticket, field, value)
    await db.commit()
    await db.refresh(ticket)
    return ticket


async def change_status(db: AsyncSession, ticket: Ticket, new_status: TicketStatus) -> Ticket:
    ticket.status = new_status
    if new_status in (TicketStatus.resolved, TicketStatus.closed):
        ticket.resolved_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(ticket)
    return ticket


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
