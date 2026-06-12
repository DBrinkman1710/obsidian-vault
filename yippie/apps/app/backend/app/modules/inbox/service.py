from __future__ import annotations

import json
import logging
import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional

from sqlalchemy import and_, func, or_, select
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


async def _context_inputs(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    contact: Optional[Contact],
) -> tuple[Optional[dict], list[dict], Optional[dict]]:
    """Fetch the contact/tickets/billing data the AI briefing prompt needs."""
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
            "company": contact.company_name,
            "email": contact.email,
            "phone": contact.phone,
            "tags": contact.tags,
            "notes": contact.notes,
        }
    else:
        contact_dict = None

    return contact_dict, recent_tickets, billing


async def _build_context(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    contact: Optional[Contact],
    sender: str,
    raw_body: str,
) -> str:
    """Fetch customer data and generate an AI briefing paragraph."""
    contact_dict, recent_tickets, billing = await _context_inputs(db, tenant_id, contact)
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
    """Update an existing message's body and re-queue the pending draft for AI
    enrichment (the background enrich_queued_drafts job picks it up)."""
    msg.raw_body = body

    draft = await db.scalar(
        select(DraftTicket).where(
            DraftTicket.inbound_message_id == msg.id,
            DraftTicket.status == DraftStatus.pending,
        )
    )
    if draft:
        draft.ai_suggested_subject = msg.subject or "(no subject)"
        draft.ai_suggested_description = body[:500]
        draft.ai_status = "queued" if ai_scan else "done"

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
    # The draft is created instantly from raw message fields so ingest never
    # blocks on the AI. Enrichment (scan + briefing) runs in the background
    # enrich_queued_drafts job, or on demand via POST /drafts/{id}/generate.
    contact = await _match_contact(db, tenant_id, msg.sender)

    draft = DraftTicket(
        tenant_id=tenant_id,
        inbound_message_id=msg.id,
        matched_contact_id=contact.id if contact else None,
        context_summary=None,
        ai_suggested_subject=msg.subject or "(no subject)",
        ai_suggested_description=msg.raw_body[:500],
        ai_suggested_priority="medium",
        ai_suggested_category=None,
        detected_language="en",
        ai_status="queued" if ai_scan else "done",
        # Pre-fill contact_id from match so agent doesn't have to search
        contact_id=contact.id if contact else None,
    )
    db.add(draft)
    await db.commit()
    await db.refresh(draft)
    return draft


# Bound each draft's enrichment so a hung AI call can't pin row locks for long.
ENRICH_TIMEOUT_SECONDS = 30
ENRICH_BATCH_SIZE = 5


async def _enrich_ai(
    draft: DraftTicket,
    msg: InboundMessage,
    contact_dict: Optional[dict],
    recent_tickets: list[dict],
    billing: Optional[dict],
) -> None:
    """The pure-AI half of enrichment — no DB access, so multiple drafts can run
    through this concurrently on one session. Sets ai_status to 'done' on success,
    'failed' on error (raw fallback fields from ingest stay in place)."""
    import asyncio

    try:
        scan, context_summary = await asyncio.wait_for(
            asyncio.gather(
                scan_message(msg.sender, msg.raw_body, msg.source.value),
                generate_context_summary(
                    sender=msg.sender,
                    raw_body=msg.raw_body,
                    contact=contact_dict,
                    recent_tickets=recent_tickets,
                    billing=billing,
                ),
            ),
            timeout=ENRICH_TIMEOUT_SECONDS,
        )
        draft.ai_suggested_subject = scan.subject or msg.subject or "(no subject)"
        draft.ai_suggested_description = scan.description or msg.raw_body[:500]
        draft.ai_suggested_priority = scan.priority or "medium"
        draft.ai_suggested_category = scan.category
        draft.detected_language = scan.language
        draft.context_summary = context_summary
        draft.ai_status = "done"
    except Exception:
        log.exception("AI enrichment failed for draft %s", draft.id)
        draft.ai_status = "failed"


async def enrich_draft(
    db: AsyncSession, tenant_id: uuid.UUID, draft: DraftTicket, msg: InboundMessage
) -> None:
    """Run AI scan + customer briefing for one draft and store the results.
    Does not commit — callers own the transaction."""
    contact = await _match_contact(db, tenant_id, msg.sender)
    contact_dict, recent_tickets, billing = await _context_inputs(db, tenant_id, contact)
    await _enrich_ai(draft, msg, contact_dict, recent_tickets, billing)


async def enrich_queued_drafts(db: AsyncSession) -> int:
    """Enrich a batch of queued drafts. Called by the background scheduler.

    devsandbox and sandbox share one DB, so two containers run this loop
    concurrently: rows are claimed with SKIP LOCKED and the locks are held
    until the status flips to done/failed — if a container dies mid-batch the
    transaction rolls back and the rows stay 'queued' for the next tick.
    The DB reads run sequentially (a session can't run concurrent queries);
    the AI calls — the slow part — run concurrently across the batch.
    Returns the number of drafts processed."""
    import asyncio

    result = await db.execute(
        select(DraftTicket, InboundMessage)
        .join(InboundMessage, DraftTicket.inbound_message_id == InboundMessage.id)
        .where(DraftTicket.ai_status == "queued", DraftTicket.status == DraftStatus.pending)
        .order_by(DraftTicket.created_at)
        .limit(ENRICH_BATCH_SIZE)
        .with_for_update(skip_locked=True, of=DraftTicket)
    )
    rows = result.all()
    if not rows:
        return 0

    prepared = []
    for draft, msg in rows:
        contact = await _match_contact(db, draft.tenant_id, msg.sender)
        contact_dict, recent_tickets, billing = await _context_inputs(db, draft.tenant_id, contact)
        prepared.append((draft, msg, contact_dict, recent_tickets, billing))

    await asyncio.gather(*[_enrich_ai(*p) for p in prepared])
    await db.commit()
    return len(rows)


async def get_draft_with_context(
    db: AsyncSession, tenant_id: uuid.UUID, draft_id: uuid.UUID
) -> Optional[dict]:
    """Returns draft + enriched context (inbound message, contact, recent tickets, billing).

    Draft, inbound message and contact come back in ONE round-trip (outer joins);
    a single AsyncSession can't run queries concurrently, so fewer round-trips is
    the lever here, not asyncio.gather.
    """
    row_result = await db.execute(
        select(DraftTicket, InboundMessage, Contact)
        .outerjoin(InboundMessage, DraftTicket.inbound_message_id == InboundMessage.id)
        .outerjoin(
            Contact,
            and_(
                Contact.tenant_id == DraftTicket.tenant_id,
                Contact.id == func.coalesce(DraftTicket.matched_contact_id, DraftTicket.contact_id),
            ),
        )
        .where(DraftTicket.tenant_id == tenant_id, DraftTicket.id == draft_id)
    )
    row = row_result.first()
    if not row:
        return None
    draft, msg, contact = row

    recent_tickets = []
    billing = None

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


async def count_pending_drafts(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    inbound_email: Optional[str] = None,
    include_legacy: bool = True,
) -> int:
    now = datetime.now(timezone.utc)
    q = (
        select(func.count())
        .select_from(DraftTicket)
        .join(InboundMessage, DraftTicket.inbound_message_id == InboundMessage.id)
        .where(
            DraftTicket.tenant_id == tenant_id,
            or_(
                DraftTicket.status == DraftStatus.pending,
                (DraftTicket.status == DraftStatus.approved)
                & DraftTicket.follow_up_at.isnot(None)
                & (DraftTicket.follow_up_at <= now),
            ),
        )
    )
    if inbound_email:
        addr_filter = InboundMessage.inbound_to == inbound_email.lower()
        if include_legacy:
            addr_filter = or_(addr_filter, InboundMessage.inbound_to.is_(None))
        q = q.where(addr_filter)
    result = await db.execute(q)
    return result.scalar_one()


async def list_drafts(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    status: Optional[DraftStatus] = DraftStatus.pending,
    inbound_email: Optional[str] = None,
    include_legacy: bool = True,
) -> list[tuple[DraftTicket, Optional[str], Optional[str]]]:
    # Always join InboundMessage to include the original email subject and the
    # address the mail was routed to (mailbox diagnostics).
    q = (
        select(DraftTicket, InboundMessage.subject.label("inbound_subject"), InboundMessage.inbound_to)
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
    return [(row[0], row[1], row[2]) for row in result.all()]


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
    # The agent reviewed the raw draft before the AI got to it — drop it from
    # the enrichment queue so the suggestions aren't overwritten after the fact.
    if draft.ai_status == "queued":
        draft.ai_status = "done"
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
            department_id=review.department_id,
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
        .values(status=new_status, status_changed_at=func.now())
    )
    await db.commit()
    return result.rowcount


# --- Spam/Bin retention (item 42) ---

SPAM_TO_BIN_WORKING_DAYS = 10
BIN_PURGE_WORKING_DAYS = 20


def _working_days_ago(n: int) -> datetime:
    """The moment n working days (Mon–Fri) before now, walking back calendar days."""
    cutoff = datetime.now(timezone.utc)
    remaining = n
    while remaining > 0:
        cutoff -= timedelta(days=1)
        if cutoff.weekday() < 5:
            remaining -= 1
    return cutoff


async def apply_retention(db: AsyncSession) -> None:
    """Spam → Bin after 10 working days; Bin emptied after 20 working days.
    Plain idempotent UPDATE/DELETE, so safe with two containers on one DB."""
    from sqlalchemy import delete as sa_delete, update as sa_update

    retention_ts = func.coalesce(
        DraftTicket.status_changed_at, DraftTicket.reviewed_at, DraftTicket.created_at
    )

    # Move stale spam to the bin; reset the clock so it gets the full bin window
    moved = await db.execute(
        sa_update(DraftTicket)
        .where(
            DraftTicket.status == DraftStatus.spam,
            retention_ts <= _working_days_ago(SPAM_TO_BIN_WORKING_DAYS),
        )
        .values(status=DraftStatus.bin, status_changed_at=func.now())
    )

    # Permanently delete stale bin items, then their now-orphaned inbound messages
    stale = await db.execute(
        select(DraftTicket.id, DraftTicket.inbound_message_id).where(
            DraftTicket.status == DraftStatus.bin,
            retention_ts <= _working_days_ago(BIN_PURGE_WORKING_DAYS),
        )
    )
    rows = stale.all()
    purged = 0
    if rows:
        draft_ids = [r[0] for r in rows]
        msg_ids = [r[1] for r in rows]
        result = await db.execute(sa_delete(DraftTicket).where(DraftTicket.id.in_(draft_ids)))
        purged = result.rowcount
        await db.execute(
            sa_delete(InboundMessage).where(
                InboundMessage.id.in_(msg_ids),
                ~select(DraftTicket.id)
                .where(DraftTicket.inbound_message_id == InboundMessage.id)
                .exists(),
            )
        )

    await db.commit()
    if moved.rowcount or purged:
        log.info("retention: %d spam → bin, %d bin item(s) purged", moved.rowcount, purged)


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
    campaign_buttons_json: Optional[str] = None,
    prerendered_html: Optional[str] = None,
    commit: bool = True,
) -> PendingSend:
    # Snapshot the effective from-address NOW. devsandbox and sandbox share one DB
    # and both run flush_pending_sends — a NULL from_email would be resolved with
    # the RESEND_FROM of whichever container happens to flush the row.
    # Priority: explicit caller value → tenant's own inbound_email → global RESEND_FROM.
    from app.config import get_settings
    from app.core.models import Tenant as _Tenant

    if not from_email:
        _tenant = await db.get(_Tenant, tenant_id)
        from_email = (_tenant.inbound_email if _tenant else None) or get_settings().resend_from or None
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
        campaign_buttons_json=campaign_buttons_json,
        prerendered_html=prerendered_html,
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
    from app.core.email_html import render_email_html
    from app.core.mailer import send_email, ResendNotConfiguredError
    from app.core.models import Tenant
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
            "campaign_buttons_json": p.campaign_buttons_json,
            "prerendered_html": p.prerendered_html,
        }
        for p in pending_list
    ]
    for p in pending_list:
        await db.delete(p)
    await db.commit()

    # One tenant fetch per tenant: demo flag (suppression) + name/color (HTML layout)
    tenant_cache: dict = {}
    for c in claimed:
        try:
            if c["tenant_id"] not in tenant_cache:
                tenant_cache[c["tenant_id"]] = await db.get(Tenant, c["tenant_id"])
            tenant = tenant_cache[c["tenant_id"]]
            suppressed = bool(tenant and tenant.is_demo)
            if not suppressed:
                from app.core.email_html import render_campaign_buttons_html
                from app.config import get_settings as _get_settings
                from app.modules.tracking.models import LabelClickToken

                attachments = json.loads(c["attachments_json"]) if c["attachments_json"] else None

                # Phase 9C: generate per-button tokens when the send has campaign buttons
                # and a known recipient contact.
                campaign_buttons_html = ""
                if c["campaign_buttons_json"] and c["contact_id"]:
                    buttons = json.loads(c["campaign_buttons_json"])
                    base_url = _get_settings().app_base_url
                    token_map: dict[str, str] = {}
                    for btn in buttons:
                        label_id_str = btn.get("label_id")
                        btn_id = str(btn.get("id", ""))
                        if not label_id_str or not btn_id:
                            continue
                        tok = LabelClickToken(
                            tenant_id=c["tenant_id"],
                            contact_id=c["contact_id"],
                            label_id=uuid.UUID(label_id_str),
                            button_id=btn_id,
                        )
                        db.add(tok)
                        await db.flush()
                        token_map[btn_id] = f"{base_url}/api/v1/track/click/{tok.token}"
                    campaign_buttons_html = render_campaign_buttons_html(buttons, token_map=token_map)

                html_body = render_email_html(
                    c["reply_text"],
                    tenant_name=tenant.name if tenant else None,
                    primary_color=tenant.primary_color if tenant else None,
                    prerendered_html=c["prerendered_html"],
                    campaign_buttons_html=campaign_buttons_html,
                )
                await send_email(to=c["to_email"], subject=c["subject"], body=c["reply_text"], attachments=attachments, from_email=c["from_email"] or None, html=html_body)
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
