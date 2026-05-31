from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.inbox.ai_scanner import scan_message
from app.modules.inbox.models import DraftStatus, DraftTicket, InboundMessage, MessageSource
from app.modules.inbox.schemas import DraftReview
from app.modules.tickets.models import MessageSource as TicketSource, TicketPriority
from app.modules.tickets.schemas import TicketCreate
from app.modules.tickets import service as ticket_service


async def ingest_email(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    sender: str,
    subject: Optional[str],
    body: str,
    headers: Optional[str] = None,
) -> DraftTicket:
    msg = InboundMessage(
        tenant_id=tenant_id,
        source=MessageSource.email,
        sender=sender,
        subject=subject,
        raw_body=body,
        raw_headers=headers,
    )
    db.add(msg)
    await db.flush()
    return await _create_draft(db, tenant_id, msg)


async def ingest_whatsapp(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    sender: str,
    body: str,
    sender_name: Optional[str] = None,
) -> DraftTicket:
    msg = InboundMessage(
        tenant_id=tenant_id,
        source=MessageSource.whatsapp,
        sender=sender,
        sender_name=sender_name,
        raw_body=body,
    )
    db.add(msg)
    await db.flush()
    return await _create_draft(db, tenant_id, msg)


async def _create_draft(
    db: AsyncSession, tenant_id: uuid.UUID, msg: InboundMessage
) -> DraftTicket:
    scan = await scan_message(msg.sender, msg.raw_body, msg.source.value)

    draft = DraftTicket(
        tenant_id=tenant_id,
        inbound_message_id=msg.id,
        ai_suggested_subject=scan.subject,
        ai_suggested_description=scan.description,
        ai_suggested_priority=scan.priority,
        ai_suggested_category=scan.category,
    )
    db.add(draft)
    await db.commit()
    await db.refresh(draft)
    return draft


async def list_drafts(
    db: AsyncSession, tenant_id: uuid.UUID, status: Optional[DraftStatus] = DraftStatus.pending
) -> list[DraftTicket]:
    q = select(DraftTicket).where(DraftTicket.tenant_id == tenant_id)
    if status:
        q = q.where(DraftTicket.status == status)
    result = await db.execute(q.order_by(DraftTicket.created_at.desc()))
    return result.scalars().all()


async def get_draft(db: AsyncSession, tenant_id: uuid.UUID, draft_id: uuid.UUID) -> Optional[DraftTicket]:
    result = await db.execute(
        select(DraftTicket).where(DraftTicket.tenant_id == tenant_id, DraftTicket.id == draft_id)
    )
    return result.scalar_one_or_none()


async def review_draft(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    draft: DraftTicket,
    reviewer_id: uuid.UUID,
    review: DraftReview,
) -> DraftTicket:
    draft.reviewed_by = reviewer_id
    draft.reviewed_at = datetime.now(timezone.utc)
    draft.final_subject = review.subject
    draft.final_description = review.description
    draft.final_priority = review.priority
    draft.assigned_to = review.assigned_to
    draft.contact_id = review.contact_id

    if review.action == "approve":
        draft.status = DraftStatus.approved
        priority_map = {
            "urgent": TicketPriority.urgent,
            "high": TicketPriority.high,
            "medium": TicketPriority.medium,
            "low": TicketPriority.low,
        }
        priority_str = review.priority or draft.ai_suggested_priority
        priority = priority_map.get(priority_str, TicketPriority.medium)

        ticket_data = TicketCreate(
            subject=review.subject or draft.ai_suggested_subject,
            description=review.description or draft.ai_suggested_description,
            contact_id=review.contact_id,
            priority=priority,
            assigned_to=review.assigned_to,
            source=TicketSource.email,
        )
        ticket = await ticket_service.create_ticket(db, tenant_id, reviewer_id, ticket_data)
        draft.approved_ticket_id = ticket.id
    else:
        draft.status = DraftStatus.rejected

    await db.commit()
    await db.refresh(draft)
    return draft
