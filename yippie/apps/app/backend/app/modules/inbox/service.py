from __future__ import annotations

import json
import logging
import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional

from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.contacts.models import Contact
from app.modules.billing.models import Invoice, InvoiceStatus, Subscription
from app.modules.tickets.models import Ticket
from app.modules.inbox.ai_scanner import generate_context_summary, generate_reply_draft, generate_reply_improvements, scan_message
from app.modules.inbox.models import DraftStatus, DraftTicket, InboundMessage, MessageSource, PendingSend
from app.modules.inbox.schemas import DraftReview
from app.modules.tickets.models import MessageSource as TicketSource, TicketPriority
from app.modules.tickets.schemas import TicketCreate
from app.modules.tickets import service as ticket_service

log = logging.getLogger(__name__)


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
    ai_scan: bool = True,
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
        if ai_scan:
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
        else:
            draft.ai_suggested_subject = msg.subject or "(no subject)"
            draft.ai_suggested_description = body[:500]

    await db.commit()


async def ingest_email(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    sender: str,
    subject: Optional[str],
    body: str,
    headers: Optional[str] = None,
    resend_email_id: Optional[str] = None,
    inbound_to: Optional[str] = None,
    attachments_json: Optional[str] = None,
    ai_scan: bool = True,
) -> DraftTicket:
    msg = InboundMessage(
        tenant_id=tenant_id,
        source=MessageSource.email,
        sender=sender,
        subject=subject,
        raw_body=body,
        raw_headers=headers,
        resend_email_id=resend_email_id,
        inbound_to=inbound_to.lower() if inbound_to else None,
        attachments_json=attachments_json,
    )
    db.add(msg)
    await db.flush()
    return await _create_draft(db, tenant_id, msg, ai_scan=ai_scan)


async def ingest_whatsapp(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    sender: str,
    body: str,
    sender_name: Optional[str] = None,
    ai_scan: bool = True,
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
    return await _create_draft(db, tenant_id, msg, ai_scan=ai_scan)


async def _create_draft(
    db: AsyncSession, tenant_id: uuid.UUID, msg: InboundMessage, ai_scan: bool = True
) -> DraftTicket:
    if ai_scan:
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
    else:
        suggested_subject = msg.subject or "(no subject)"
        suggested_description = msg.raw_body[:500]
        suggested_priority = "medium"
        suggested_category = None
        detected_language = "en"

    contact = await _match_contact(db, tenant_id, msg.sender)
    context_summary = await _build_context(db, tenant_id, contact, msg.sender, msg.raw_body) if ai_scan else None

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

    attachments: list[dict] = []
    if msg and msg.attachments_json:
        try:
            attachments = json.loads(msg.attachments_json)
        except Exception:
            pass

    return {
        "draft": draft,
        "inbound_message": msg,
        "attachments": attachments,
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
        select(InboundMessage).where(
            InboundMessage.tenant_id == tenant_id,
            InboundMessage.id == draft.inbound_message_id,
        )
    )
    msg = msg_result.scalar_one_or_none()
    if not msg:
        return None

    context_summary = await _build_context(db, tenant_id, contact, msg.sender, msg.raw_body)
    draft.matched_contact_id = contact_id
    draft.contact_id = contact_id
    draft.context_summary = context_summary
    await db.commit()
    await db.refresh(draft)

    return await get_draft_with_context(db, tenant_id, draft_id)


async def list_drafts(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    status: Optional[DraftStatus] = DraftStatus.pending,
    inbound_email: Optional[str] = None,
    include_legacy: bool = True,
) -> list[tuple[DraftTicket, Optional[str]]]:
    # Always join InboundMessage to include the original email subject.
    q = (
        select(DraftTicket, InboundMessage.subject.label("inbound_subject"))
        .join(InboundMessage, DraftTicket.inbound_message_id == InboundMessage.id)
        .where(DraftTicket.tenant_id == tenant_id)
    )

    if inbound_email:
        # Filter to this mailbox's inbound address; include_legacy keeps pre-inbound_to rows.
        addr_filter = InboundMessage.inbound_to == inbound_email.lower()
        if include_legacy:
            addr_filter = or_(addr_filter, InboundMessage.inbound_to.is_(None))
        q = q.where(addr_filter)

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
    return [(row[0], row[1]) for row in result.all()]


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


async def undo_review(db: AsyncSession, tenant_id: uuid.UUID, draft: DraftTicket) -> DraftTicket:
    """Revert an approve/reject back to pending. The ticket created by an
    approval is soft-deleted so no orphan remains."""
    if draft.status not in (DraftStatus.approved, DraftStatus.rejected):
        raise ValueError("Only approved or rejected drafts can be undone")
    if draft.approved_ticket_id:
        ticket = await ticket_service.get_ticket_orm(db, tenant_id, draft.approved_ticket_id)
        if ticket:
            ticket.deleted_at = datetime.now(timezone.utc)
        draft.approved_ticket_id = None
    draft.status = DraftStatus.pending
    draft.reviewed_by = None
    draft.reviewed_at = None
    draft.follow_up_at = None
    await db.commit()
    await db.refresh(draft)
    return draft


async def bulk_update_drafts(
    db: AsyncSession, tenant_id: uuid.UUID, draft_ids: list[uuid.UUID], new_status: DraftStatus
) -> int:
    """Move multiple drafts to bin or spam. Returns count of updated rows."""
    from sqlalchemy import update as sa_update
    result = await db.execute(
        sa_update(DraftTicket)
        .where(DraftTicket.tenant_id == tenant_id, DraftTicket.id.in_(draft_ids))
        .values(status=new_status)
    )
    await db.commit()
    return result.rowcount


async def tenant_is_demo(db: AsyncSession, tenant_id: uuid.UUID) -> bool:
    """Demo tenants never send real outbound email — callers show 'demo mode' instead."""
    from app.core.models import Tenant

    tenant = await db.get(Tenant, tenant_id)
    return bool(tenant and tenant.is_demo)


# --- Undo-send queue ---

async def queue_send(
    db: AsyncSession,
    draft_id: uuid.UUID,
    tenant_id: uuid.UUID,
    to_email: str,
    subject: str,
    reply_text: str,
    send_at: datetime,
    actor_id: Optional[uuid.UUID] = None,
    contact_id: Optional[uuid.UUID] = None,
    attachments_json: Optional[str] = None,
    from_email: Optional[str] = None,
    kind: str = "reply",
    commit: bool = True,
) -> PendingSend:
    # Snapshot the effective from-address NOW. devsandbox and sandbox share one DB
    # and both run flush_pending_sends — a NULL from_email would be resolved with
    # the RESEND_FROM of whichever container happens to flush the row.
    from app.config import get_settings

    from_email = from_email or get_settings().resend_from or None
    pending = PendingSend(
        draft_id=draft_id,
        tenant_id=tenant_id,
        to_email=to_email,
        subject=subject,
        reply_text=reply_text,
        send_at=send_at,
        actor_id=actor_id,
        contact_id=contact_id,
        attachments_json=attachments_json,
        from_email=from_email,
        kind=kind,
    )
    db.add(pending)
    if commit:
        await db.commit()
    return pending


async def cancel_send(db: AsyncSession, draft_id: uuid.UUID, tenant_id: uuid.UUID) -> bool:
    """Cancel queued sends still within the undo window. A compose batch has one
    row per recipient sharing the same draft_id — one undo cancels them all.
    Returns True if anything was cancelled."""
    now = datetime.now(timezone.utc)
    result = await db.execute(
        select(PendingSend).where(
            PendingSend.draft_id == draft_id,
            PendingSend.tenant_id == tenant_id,
            PendingSend.send_at > now,
        )
    )
    pending_rows = result.scalars().all()
    if not pending_rows:
        return False
    for pending in pending_rows:
        await db.delete(pending)
    await db.commit()
    return True


async def flush_pending_sends(db: AsyncSession) -> None:
    """Dispatch all queued sends whose send_at has passed. Called by background scheduler."""
    from app.core.mailer import send_email, ResendNotConfiguredError
    from app.modules.activity import service as activity_service

    now = datetime.now(timezone.utc)
    # devsandbox and sandbox share one DB, so two containers run this loop
    # concurrently. Claim rows with SKIP LOCKED and delete them before sending,
    # so each pending send is dispatched at most once.
    result = await db.execute(
        select(PendingSend)
        .where(PendingSend.send_at <= now)
        .with_for_update(skip_locked=True)
    )
    pending_list = result.scalars().all()
    if not pending_list:
        return

    claimed = [
        {
            "id": p.id,
            "tenant_id": p.tenant_id,
            "draft_id": p.draft_id,
            "to_email": p.to_email,
            "subject": p.subject,
            "reply_text": p.reply_text,
            "actor_id": p.actor_id,
            "contact_id": p.contact_id,
            "attachments_json": p.attachments_json,
            "from_email": p.from_email,
            "kind": p.kind,
        }
        for p in pending_list
    ]
    for p in pending_list:
        await db.delete(p)
    await db.commit()

    demo_cache: dict = {}
    for c in claimed:
        try:
            if c["tenant_id"] not in demo_cache:
                demo_cache[c["tenant_id"]] = await tenant_is_demo(db, c["tenant_id"])
            suppressed = demo_cache[c["tenant_id"]]
            if not suppressed:
                attachments = json.loads(c["attachments_json"]) if c["attachments_json"] else None
                await send_email(to=c["to_email"], subject=c["subject"], body=c["reply_text"], attachments=attachments, from_email=c["from_email"] or None)
            payload = {"subject": c["subject"], "to": c["to_email"], "preview": c["reply_text"][:120]}
            if suppressed:
                payload["demo_suppressed"] = True
            is_compose = c["kind"] == "compose"
            await activity_service.log_event(
                db=db,
                tenant_id=c["tenant_id"],
                module="inbox",
                event_type="email.composed" if is_compose else "email.replied",
                entity_type="outbound_email" if is_compose else "draft_ticket",
                entity_id=None if is_compose else c["draft_id"],
                contact_id=c["contact_id"],
                actor_id=c["actor_id"],
                payload=payload,
            )
        except ResendNotConfiguredError:
            log.warning("Resend not configured — skipping pending send %s", c["id"])
        except Exception:
            log.exception("Failed to dispatch pending send %s", c["id"])

    await db.commit()
