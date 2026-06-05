from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional

from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.contacts.models import Contact
from app.modules.billing.models import Invoice, InvoiceStatus, Subscription
from app.modules.tickets.models import Ticket
from app.modules.inbox.ai_scanner import generate_context_summary, generate_reply_draft, generate_reply_improvements, scan_message
from app.modules.inbox.models import DraftStatus, DraftTicket, InboundMessage, MessageSource
from app.modules.inbox.schemas import DraftReview
from app.modules.tickets.models import MessageSource as TicketSource, TicketPriority
from app.modules.tickets.schemas import TicketCreate
from app.modules.tickets import service as ticket_service


async def _match_contact(db: AsyncSession, tenant_id: uuid.UUID, sender: str) -> Optional[Contact]:
    """Try to find an existing contact by sender email or phone number."""
    result = await db.execute(
        select(Contact).where(
            Contact.tenant_id == tenant_id,
            Contact.email == sender.lower().strip(),
        )
    )
    return result.scalar_one_or_none()


async def _build_context(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    contact: Optional[Contact],
    sender: str,
    raw_body: str,
) -> str:
    """Fetch customer data and generate an AI briefing paragraph."""
    recent_tickets: list[dict] = []
    billing: Optional[dict] = None

    if contact:
        tickets_result = await db.execute(
            select(Ticket)
            .where(Ticket.tenant_id == tenant_id, Ticket.contact_id == contact.id)
            .order_by(Ticket.created_at.desc())
            .limit(5)
        )
        recent_tickets = [
            {"subject": t.subject, "status": t.status.value, "priority": t.priority.value}
            for t in tickets_result.scalars().all()
        ]

        sub_result = await db.execute(
            select(Subscription)
            .where(Subscription.tenant_id == tenant_id, Subscription.contact_id == contact.id)
            .order_by(Subscription.started_at.desc())
            .limit(1)
        )
        sub = sub_result.scalar_one_or_none()

        outstanding = 0
        if sub:
            inv_result = await db.execute(
                select(Invoice).where(
                    Invoice.tenant_id == tenant_id,
                    Invoice.contact_id == contact.id,
                    Invoice.status.in_([InvoiceStatus.sent, InvoiceStatus.overdue]),
                )
            )
            outstanding = len(inv_result.scalars().all())
            billing = {
                "plan_name": sub.plan_name,
                "status": sub.status.value,
                "billing_cycle": sub.billing_cycle.value,
                "amount_cents": sub.amount_cents,
                "currency": sub.currency,
                "outstanding_invoices": outstanding,
            }

        contact_dict = {
            "full_name": contact.full_name,
            "company": contact.company,
            "email": contact.email,
            "phone": contact.phone,
            "tags": contact.tags,
            "notes": contact.notes,
        }
    else:
        contact_dict = None

    return await generate_context_summary(
        sender=sender,
        raw_body=raw_body,
        contact=contact_dict,
        recent_tickets=recent_tickets,
        billing=billing,
    )


async def find_by_resend_id(db: AsyncSession, resend_email_id: str) -> Optional[InboundMessage]:
    return await db.scalar(
        select(InboundMessage).where(InboundMessage.resend_email_id == resend_email_id)
    )


async def update_message_body(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    msg: InboundMessage,
    body: str,
) -> None:
    """Update an existing message's body and re-run AI scan on the pending draft."""
    msg.raw_body = body

    draft = await db.scalar(
        select(DraftTicket).where(
            DraftTicket.inbound_message_id == msg.id,
            DraftTicket.status == DraftStatus.pending,
        )
    )
    if draft:
        contact = await _match_contact(db, tenant_id, msg.sender)
        context_summary = await _build_context(db, tenant_id, contact, msg.sender, body)
        try:
            scan = await scan_message(msg.sender, body, msg.source.value)
            draft.ai_suggested_subject = scan.subject or msg.subject or "(no subject)"
            draft.ai_suggested_description = scan.description or body[:500]
            draft.ai_suggested_priority = scan.priority or "medium"
            draft.ai_suggested_category = scan.category
            draft.detected_language = scan.language
        except Exception:
            draft.ai_suggested_subject = msg.subject or "(no subject)"
            draft.ai_suggested_description = body[:500]
        draft.context_summary = context_summary

    await db.commit()


async def ingest_email(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    sender: str,
    subject: Optional[str],
    body: str,
    headers: Optional[str] = None,
    resend_email_id: Optional[str] = None,
) -> DraftTicket:
    msg = InboundMessage(
        tenant_id=tenant_id,
        source=MessageSource.email,
        sender=sender,
        subject=subject,
        raw_body=body,
        raw_headers=headers,
        resend_email_id=resend_email_id,
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
    # Run AI scan — fall back to raw message fields if scan fails (e.g. no API key)
    try:
        scan = await scan_message(msg.sender, msg.raw_body, msg.source.value)
        suggested_subject = scan.subject or msg.subject or "(no subject)"
        suggested_description = scan.description or msg.raw_body[:500]
        suggested_priority = scan.priority or "medium"
        suggested_category = scan.category
        detected_language = scan.language
    except Exception:
        suggested_subject = msg.subject or "(no subject)"
        suggested_description = msg.raw_body[:500]
        suggested_priority = "medium"
        suggested_category = None
        detected_language = "en"

    contact = await _match_contact(db, tenant_id, msg.sender)
    context_summary = await _build_context(db, tenant_id, contact, msg.sender, msg.raw_body)

    draft = DraftTicket(
        tenant_id=tenant_id,
        inbound_message_id=msg.id,
        matched_contact_id=contact.id if contact else None,
        context_summary=context_summary,
        ai_suggested_subject=suggested_subject,
        ai_suggested_description=suggested_description,
        ai_suggested_priority=suggested_priority,
        ai_suggested_category=suggested_category,
        detected_language=detected_language,
        # Pre-fill contact_id from match so agent doesn't have to search
        contact_id=contact.id if contact else None,
    )
    db.add(draft)
    await db.commit()
    await db.refresh(draft)
    return draft


async def get_draft_with_context(
    db: AsyncSession, tenant_id: uuid.UUID, draft_id: uuid.UUID
) -> Optional[dict]:
    """Returns draft + enriched context (inbound message, contact, recent tickets, billing)."""
    draft_result = await db.execute(
        select(DraftTicket).where(DraftTicket.tenant_id == tenant_id, DraftTicket.id == draft_id)
    )
    draft = draft_result.scalar_one_or_none()
    if not draft:
        return None

    msg_result = await db.execute(
        select(InboundMessage).where(InboundMessage.id == draft.inbound_message_id)
    )
    msg = msg_result.scalar_one_or_none()

    contact = None
    recent_tickets = []
    billing = None

    contact_id = draft.matched_contact_id or draft.contact_id
    if contact_id:
        contact_result = await db.execute(
            select(Contact).where(Contact.tenant_id == tenant_id, Contact.id == contact_id)
        )
        contact = contact_result.scalar_one_or_none()

        if contact:
            tickets_result = await db.execute(
                select(Ticket)
                .where(Ticket.tenant_id == tenant_id, Ticket.contact_id == contact.id)
                .order_by(Ticket.created_at.desc())
                .limit(5)
            )
            recent_tickets = tickets_result.scalars().all()

            sub_result = await db.execute(
                select(Subscription)
                .where(Subscription.tenant_id == tenant_id, Subscription.contact_id == contact.id)
                .order_by(Subscription.started_at.desc())
                .limit(1)
            )
            billing = sub_result.scalar_one_or_none()

    return {
        "draft": draft,
        "inbound_message": msg,
        "contact": contact,
        "recent_tickets": recent_tickets,
        "billing": billing,
    }


async def link_contact_to_draft(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    draft_id: uuid.UUID,
    contact_id: uuid.UUID,
) -> Optional[dict]:
    draft = await get_draft(db, tenant_id, draft_id)
    if not draft:
        return None

    contact_result = await db.execute(
        select(Contact).where(Contact.tenant_id == tenant_id, Contact.id == contact_id)
    )
    contact = contact_result.scalar_one_or_none()
    if not contact:
        return None

    msg_result = await db.execute(
        select(InboundMessage).where(InboundMessage.id == draft.inbound_message_id)
    )
    msg = msg_result.scalar_one_or_none()

    context_summary = await _build_context(db, tenant_id, contact, msg.sender, msg.raw_body)
    draft.matched_contact_id = contact_id
    draft.contact_id = contact_id
    draft.context_summary = context_summary
    await db.commit()
    await db.refresh(draft)

    return await get_draft_with_context(db, tenant_id, draft_id)


async def list_drafts(
    db: AsyncSession, tenant_id: uuid.UUID, status: Optional[DraftStatus] = DraftStatus.pending
) -> list[DraftTicket]:
    q = select(DraftTicket).where(DraftTicket.tenant_id == tenant_id)
    if status == DraftStatus.pending:
        now = datetime.now(timezone.utc)
        q = q.where(
            or_(
                DraftTicket.status == DraftStatus.pending,
                (DraftTicket.status == DraftStatus.approved)
                & DraftTicket.follow_up_at.isnot(None)
                & (DraftTicket.follow_up_at <= now),
            )
        )
    elif status:
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
        priority = priority_map.get(review.priority or draft.ai_suggested_priority, TicketPriority.medium)
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
        if review.follow_up_days:
            draft.follow_up_at = datetime.now(timezone.utc) + timedelta(days=review.follow_up_days)
    else:
        draft.status = DraftStatus.rejected

    await db.commit()
    await db.refresh(draft)
    return draft
