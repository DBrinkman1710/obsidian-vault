from __future__ import annotations

import json
import logging
import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional

from sqlalchemy import and_, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.core.customer_context import build_customer_context
from app.core.flow_events import emit_flow_event
from app.core.models import Tenant, User
from app.core.plans import limits_for_plan
from app.modules.contacts.models import Contact
from app.modules.billing.models import Subscription
from app.modules.tickets.models import Ticket
from app.modules.inbox.ai_scanner import generate_context_summary, generate_reply_draft, generate_reply_improvements, scan_message
from app.modules.inbox.models import DraftStatus, DraftTicket, InboundMessage, MessageSource, PendingSend
from app.modules.inbox.schemas import DraftReview
from app.modules.tickets.models import MessageSource as TicketSource, TicketPriority
from app.modules.tickets.schemas import TicketCreate
from app.modules.tickets import service as ticket_service

log = logging.getLogger(__name__)

# Pending-send dispatch: a claimed row is leased for SEND_RETRY_DELAY (send_at is
# pushed forward), so a crash or send failure retries automatically once the
# lease expires. After MAX_SEND_ATTEMPTS the row stops being selected.
MAX_SEND_ATTEMPTS = 5
SEND_RETRY_DELAY = timedelta(minutes=10)


async def _match_contact(db: AsyncSession, tenant_id: uuid.UUID, sender: str) -> Optional[Contact]:
    """Try to find an existing contact by sender email or phone number."""
    result = await db.execute(
        select(Contact).where(
            Contact.tenant_id == tenant_id,
            func.lower(Contact.email) == sender.lower().strip(),
            Contact.deleted_at.is_(None),
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
    """Fetch the full cross-module customer history and generate an AI briefing."""
    tenant = await db.get(Tenant, tenant_id)
    context = await build_customer_context(db, tenant, contact) if tenant else None
    return await generate_context_summary(
        sender=sender,
        raw_body=raw_body,
        context=context,
        tenant_profile=tenant.ai_profile if tenant else None,
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
    sender_name: Optional[str] = None,
    # Set when ingested from a linked Gmail/Outlook mailbox (EML1)
    email_account_id: Optional[uuid.UUID] = None,
    provider_message_id: Optional[str] = None,
    smtp_message_id: Optional[str] = None,
) -> DraftTicket:
    msg = InboundMessage(
        tenant_id=tenant_id,
        source=MessageSource.email,
        sender=sender,
        sender_name=sender_name,
        subject=subject,
        raw_body=body,
        raw_headers=headers,
        resend_email_id=resend_email_id,
        email_account_id=email_account_id,
        provider_message_id=provider_message_id,
        smtp_message_id=smtp_message_id,
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

    # Auto-route: if inbound_to matches a dept email, set forwarded_to_department_id
    auto_dept_id = None
    if msg.inbound_to:
        from app.modules.departments.models import Department as Dept
        dept_result = await db.execute(
            select(Dept).where(
                Dept.tenant_id == tenant_id,
                Dept.email == msg.inbound_to.lower(),
            )
        )
        found_dept = dept_result.scalar_one_or_none()
        if found_dept:
            auto_dept_id = found_dept.id

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
        forwarded_to_department_id=auto_dept_id,
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
    context: Optional[dict],
    tenant_profile: Optional[dict] = None,
) -> None:
    """The pure-AI half of enrichment — no DB access, so multiple drafts can run
    through this concurrently on one session. Sets ai_status to 'done' on success,
    'failed' on error (raw fallback fields from ingest stay in place)."""
    import asyncio

    try:
        scan, context_summary = await asyncio.wait_for(
            asyncio.gather(
                scan_message(msg.sender, msg.raw_body, msg.source.value, tenant_profile=tenant_profile),
                generate_context_summary(
                    sender=msg.sender,
                    raw_body=msg.raw_body,
                    context=context,
                    tenant_profile=tenant_profile,
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
    from sqlalchemy import update as _update
    contact = await _match_contact(db, tenant_id, msg.sender)
    tenant = await db.get(Tenant, tenant_id)
    context = await build_customer_context(db, tenant, contact) if tenant else None
    tenant_profile = tenant.ai_profile if tenant else None
    await _enrich_ai(draft, msg, context, tenant_profile=tenant_profile)
    if draft.ai_status == "done":
        await db.execute(
            _update(Tenant)
            .where(Tenant.id == tenant_id)
            .values(ai_scans_used_this_period=Tenant.ai_scans_used_this_period + 1)
        )


async def enrich_scan_only(
    db: AsyncSession, tenant_id: uuid.UUID, draft: DraftTicket, msg: InboundMessage
) -> None:
    """Run only the subject/priority/description scan — leave briefing untouched."""
    import asyncio
    from sqlalchemy import update as _update
    tenant = await db.get(Tenant, tenant_id)
    tenant_profile = tenant.ai_profile if tenant else None
    try:
        scan = await asyncio.wait_for(
            scan_message(msg.sender, msg.raw_body, msg.source.value, tenant_profile=tenant_profile),
            timeout=ENRICH_TIMEOUT_SECONDS,
        )
        draft.ai_suggested_subject = scan.subject or msg.subject or "(no subject)"
        draft.ai_suggested_description = scan.description or msg.raw_body[:500]
        draft.ai_suggested_priority = scan.priority or "medium"
        draft.ai_suggested_category = scan.category
        draft.detected_language = scan.language
        draft.ai_status = "done"
        await db.execute(
            _update(Tenant)
            .where(Tenant.id == tenant_id)
            .values(ai_scans_used_this_period=Tenant.ai_scans_used_this_period + 1)
        )
    except Exception:
        log.exception("AI scan failed for draft %s", draft.id)
        draft.ai_status = "failed"


async def enrich_briefing_only(
    db: AsyncSession, tenant_id: uuid.UUID, draft: DraftTicket, msg: InboundMessage
) -> None:
    """Run only the customer briefing — leave scan fields untouched."""
    import asyncio
    contact = await _match_contact(db, tenant_id, msg.sender)
    tenant = await db.get(Tenant, tenant_id)
    context = await build_customer_context(db, tenant, contact) if tenant else None
    tenant_profile = tenant.ai_profile if tenant else None
    try:
        summary = await asyncio.wait_for(
            generate_context_summary(
                sender=msg.sender,
                raw_body=msg.raw_body,
                context=context,
                tenant_profile=tenant_profile,
            ),
            timeout=ENRICH_TIMEOUT_SECONDS,
        )
        draft.context_summary = summary
        if draft.ai_status != "done":
            draft.ai_status = "done"
    except Exception:
        log.exception("AI briefing failed for draft %s", draft.id)
        draft.ai_status = "failed"


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
        tenant = await db.get(Tenant, draft.tenant_id)
        if tenant:
            scan_limit = limits_for_plan(tenant.plan).get("ai_scans")
            if scan_limit is not None and tenant.ai_scans_used_this_period >= scan_limit:
                draft.ai_status = "skipped"
                continue
        contact = await _match_contact(db, draft.tenant_id, msg.sender)
        context = await build_customer_context(db, tenant, contact) if tenant else None
        tenant_profile = tenant.ai_profile if tenant else None
        prepared.append((draft, msg, context, tenant_profile))

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


def _inbound_addr_filter(inbound_email: str | list[str], include_legacy: bool):
    """Mailbox filter for one address or a list (own address + linked accounts)."""
    addrs = [inbound_email] if isinstance(inbound_email, str) else inbound_email
    addrs = [a.lower() for a in addrs if a]
    addr_filter = (
        InboundMessage.inbound_to == addrs[0]
        if len(addrs) == 1
        else InboundMessage.inbound_to.in_(addrs)
    )
    if include_legacy:
        addr_filter = or_(addr_filter, InboundMessage.inbound_to.is_(None))
    return addr_filter


async def count_pending_drafts(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    inbound_email: Optional[str | list[str]] = None,
    include_legacy: bool = True,
    department_id: Optional[uuid.UUID] = None,
    unread_only: bool = False,
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
        q = q.where(_inbound_addr_filter(inbound_email, include_legacy))
    if department_id:
        q = q.where(DraftTicket.forwarded_to_department_id == department_id)
    if unread_only:
        q = q.where(DraftTicket.opened_at.is_(None))
    result = await db.execute(q)
    return result.scalar_one()


async def list_drafts(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    status: Optional[DraftStatus] = DraftStatus.pending,
    inbound_email: Optional[str | list[str]] = None,
    include_legacy: bool = True,
    search: Optional[str] = None,
    contact_id: Optional[uuid.UUID] = None,
    department_id: Optional[uuid.UUID] = None,
    personal_only_user_id: Optional[uuid.UUID] = None,
    personal_only_inbound_email: Optional[str | list[str]] = None,
) -> list[tuple[DraftTicket, Optional[str], Optional[str]]]:
    # Always join InboundMessage to include the original email subject and the
    # address the mail was routed to (mailbox diagnostics).
    q = (
        select(DraftTicket, InboundMessage.subject.label("inbound_subject"), InboundMessage.inbound_to)
        .join(InboundMessage, DraftTicket.inbound_message_id == InboundMessage.id)
        .where(DraftTicket.tenant_id == tenant_id)
    )

    if search and search.strip():
        # Case-insensitive search across subject (AI + original), sender email and
        # body/preview text. ILIKE patterns are trigram-index friendly (pg_trgm).
        term = f"%{search.strip()}%"
        q = q.where(
            or_(
                DraftTicket.ai_suggested_subject.ilike(term),
                DraftTicket.ai_suggested_description.ilike(term),
                DraftTicket.final_subject.ilike(term),
                InboundMessage.subject.ilike(term),
                InboundMessage.sender.ilike(term),
                InboundMessage.raw_body.ilike(term),
            )
        )

    if inbound_email:
        # Filter to this mailbox's inbound address(es) — a user/tenant can have
        # several: own inbound_email + linked Gmail/Outlook accounts (EML1).
        # include_legacy keeps pre-inbound_to rows.
        q = q.where(_inbound_addr_filter(inbound_email, include_legacy))

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

    if contact_id:
        q = q.where(
            or_(DraftTicket.contact_id == contact_id, DraftTicket.matched_contact_id == contact_id)
        )

    if department_id:
        q = q.where(DraftTicket.forwarded_to_department_id == department_id)

    if personal_only_user_id is not None:
        mine = DraftTicket.assigned_to == personal_only_user_id
        if personal_only_inbound_email:
            mine = or_(mine, _inbound_addr_filter(personal_only_inbound_email, include_legacy=False))
        q = q.where(mine)

    result = await db.execute(q.order_by(DraftTicket.created_at.desc()))
    return [(row[0], row[1], row[2]) for row in result.all()]


# Words too common/generic to surface as a "trending topic".
_TRENDING_STOPWORDS = {
    "the", "and", "for", "you", "your", "with", "this", "that", "from", "have",
    "are", "was", "but", "not", "all", "can", "our", "out", "has", "his", "her",
    "they", "their", "would", "could", "should", "about", "there", "what", "when",
    "will", "been", "were", "into", "than", "then", "them", "some", "more", "very",
    "just", "like", "also", "any", "how", "who", "why", "did", "does", "had",
    "re", "fwd", "fw", "hi", "hello", "dear", "regards", "thanks", "thank", "please",
    "no", "subject", "message", "email", "mail", "get", "got", "new", "see", "via",
}


async def trending_topics(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    limit: int = 6,
    sample: int = 200,
) -> list[str]:
    """Derive 'trending topics' from the most frequent words in recent draft
    subjects across the tenant. Cheap in-Python aggregation over a bounded sample
    of recent rows — no extra indexes needed."""
    import re
    from collections import Counter

    result = await db.execute(
        select(DraftTicket.ai_suggested_subject, DraftTicket.final_subject)
        .where(DraftTicket.tenant_id == tenant_id)
        .order_by(DraftTicket.created_at.desc())
        .limit(sample)
    )
    counter: Counter[str] = Counter()
    for ai_subject, final_subject in result.all():
        text = (final_subject or ai_subject or "").lower()
        for word in re.findall(r"[a-z][a-z']{2,}", text):
            if word in _TRENDING_STOPWORDS:
                continue
            counter[word] += 1
    # Only surface words seen more than once so a single email doesn't "trend".
    return [word for word, count in counter.most_common(limit) if count > 1]


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
            department_id=review.department_id or draft.forwarded_to_department_id,
            source=TicketSource.email,
        )
        ticket = await ticket_service.create_ticket(db, tenant_id, reviewer_id, ticket_data)
        draft.approved_ticket_id = ticket.id
        if review.follow_up_days:
            draft.follow_up_at = datetime.now(timezone.utc) + timedelta(days=review.follow_up_days)
        await emit_flow_event(
            db, tenant_id, "draft_approved",
            entity_type="draft_ticket", entity_id=draft.id,
            contact_id=draft.contact_id, actor_id=reviewer_id,
            payload={
                "draft_id": draft.id,
                "ticket_id": ticket.id,
                "subject": ticket.subject,
                "priority": ticket.priority.value if hasattr(ticket.priority, "value") else ticket.priority,
                "contact_id": draft.contact_id,
            },
        )
    else:
        draft.status = DraftStatus.rejected
        if review.reject_reason in ("thank_you", "spam", "duplicate", "no_action"):
            draft.reject_reason = review.reject_reason

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


async def bulk_assign_drafts(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    draft_ids: list[uuid.UUID],
    update_fields: dict,
) -> int:
    """Bulk assign drafts. update_fields maps column names to values (None = clear).
    Returns count of updated rows."""
    from sqlalchemy import update as sa_update
    if not update_fields:
        return 0
    result = await db.execute(
        sa_update(DraftTicket)
        .where(DraftTicket.tenant_id == tenant_id, DraftTicket.id.in_(draft_ids))
        .values(**update_fields)
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
    linked_account_id: Optional[uuid.UUID] = None,
    kind: str = "reply",
    campaign_buttons_json: Optional[str] = None,
    prerendered_html: Optional[str] = None,
    cc_emails: Optional[str] = None,
    bcc_emails: Optional[str] = None,
    commit: bool = True,
) -> PendingSend:
    # Snapshot the effective from-address NOW. devsandbox and sandbox share one DB
    # and both run flush_pending_sends — a NULL from_email would be resolved with
    # the RESEND_FROM of whichever container happens to flush the row.
    # Priority: explicit caller value → tenant's own inbound_email → global RESEND_FROM.
    from app.config import get_settings
    from app.core.models import Tenant as _Tenant

    _cfg = get_settings()
    _tenant: _Tenant | None = None
    if not from_email:
        _tenant = await db.get(_Tenant, tenant_id)
        from_email = (_tenant.inbound_email if _tenant else None) or _cfg.resend_from or None

    # EML1 transport snapshot: when the from-address is a linked Gmail/Outlook
    # account (or an alias routed through one), dispatch goes via that provider
    # instead of Resend. Snapshotted at queue time for the same two-container
    # reason as from_email above.
    email_account_id = linked_account_id  # explicit alias transport takes priority
    if email_account_id is None and from_email:
        from app.modules.email_accounts.models import EmailAccount as _EmailAccount

        email_account_id = await db.scalar(
            select(_EmailAccount.id).where(
                _EmailAccount.tenant_id == tenant_id,
                func.lower(_EmailAccount.email_address) == from_email.lower(),
                _EmailAccount.status == "active",
            )
        )

    # If still no transport, use the active team-level linked account (Gmail/
    # Outlook) when one exists. This makes the "replies go out from your own
    # address" promise true: from_email stays as the display address, the
    # linked account is the actual SMTP carrier.
    if email_account_id is None:
        from app.modules.email_accounts.models import EmailAccount as _EmailAccount

        email_account_id = await db.scalar(
            select(_EmailAccount.id).where(
                _EmailAccount.tenant_id == tenant_id,
                _EmailAccount.user_id.is_(None),
                _EmailAccount.status == "active",
            ).limit(1)
        )

    # Last resort: if from_email domain isn't Resend-sendable and there is no
    # linked account, fall back to the platform default so the message delivers
    # rather than retrying forever and hitting a 403 on flush.
    if email_account_id is None and from_email and "@" in from_email:
        _resend_domain = (_cfg.resend_from or "").rsplit("@", 1)[-1].lower()
        _from_domain = from_email.rsplit("@", 1)[-1].lower()
        if _resend_domain and _from_domain != _resend_domain:
            from_email = _cfg.resend_from or None

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
        email_account_id=email_account_id,
        kind=kind,
        campaign_buttons_json=campaign_buttons_json,
        prerendered_html=prerendered_html,
        cc_emails=cc_emails,
        bcc_emails=bcc_emails,
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
            # attempts > 0 means the row was claimed by the dispatcher (send_at
            # is a retry lease, not the undo window) — too late to cancel.
            PendingSend.attempts == 0,
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
    from app.modules.email_accounts.service import AccountRevokedError

    now = datetime.now(timezone.utc)
    # devsandbox and sandbox share one DB, so two containers run this loop
    # concurrently. Claim rows with SKIP LOCKED and lease them: bump attempts and
    # push send_at into the future, then commit. The row is only deleted after a
    # successful send, so a Resend outage or crash mid-dispatch retries the email
    # once the lease expires instead of silently losing it. Rows that exhaust
    # MAX_SEND_ATTEMPTS are never selected again (dead-letter, kept in the table).
    result = await db.execute(
        select(PendingSend)
        .where(
            PendingSend.send_at <= now,
            PendingSend.attempts < MAX_SEND_ATTEMPTS,
        )
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
            "email_account_id": p.email_account_id,
            "kind": p.kind,
            "campaign_buttons_json": p.campaign_buttons_json,
            "prerendered_html": p.prerendered_html,
            "cc_emails": p.cc_emails,
            "bcc_emails": p.bcc_emails,
            "attempts": p.attempts,
        }
        for p in pending_list
    ]
    for p in pending_list:
        p.attempts += 1
        p.send_at = now + SEND_RETRY_DELAY
    await db.commit()

    rows_by_id = {p.id: p for p in pending_list}

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
                    base_url = _get_settings().effective_base_url
                    token_map: dict[str, str] = {}
                    for btn in buttons:
                        btn_id = str(btn.get("id", ""))
                        action_type = btn.get("action_type", "label")
                        label_id_str = btn.get("label_id")
                        stage_id_str = btn.get("stage_id")
                        if not btn_id:
                            continue
                        # Direct-link actions (website / email / phone) render as
                        # plain <a> links — no tracking token, no DB row.
                        if action_type in ("open_website", "send_mail", "call_phone"):
                            from app.core.email_html import build_direct_action_href
                            href = build_direct_action_href(action_type, btn.get("action_value"))
                            if href:
                                token_map[btn_id] = href
                            continue
                        # Only generate a token when there is a configured action
                        if action_type == "pipeline_stage" and stage_id_str:
                            tok = LabelClickToken(
                                tenant_id=c["tenant_id"],
                                contact_id=c["contact_id"],
                                action_type="pipeline_stage",
                                stage_id=uuid.UUID(stage_id_str),
                                button_id=btn_id,
                            )
                        elif action_type == "label" and label_id_str:
                            tok = LabelClickToken(
                                tenant_id=c["tenant_id"],
                                contact_id=c["contact_id"],
                                action_type="label",
                                label_id=uuid.UUID(label_id_str),
                                button_id=btn_id,
                            )
                        else:
                            continue
                        db.add(tok)
                        await db.flush()
                        token_map[btn_id] = f"{base_url}/api/v1/track/click/{tok.token}"

                    if c.get("prerendered_html"):
                        # Unlayer template: inject tracking URLs into native button hrefs
                        from app.core.email_html import inject_button_tracking
                        c = {**c, "prerendered_html": inject_button_tracking(c["prerendered_html"], buttons, token_map)}
                    else:
                        # Plain text template: append buttons below body as before
                        campaign_buttons_html = render_campaign_buttons_html(buttons, token_map=token_map)

                # Unlayer templates are complete HTML documents — send them directly
                # instead of nesting them inside the Yippie email shell wrapper,
                # which produces invalid double-nested HTML and breaks the template.
                if c["prerendered_html"]:
                    html_body = c["prerendered_html"]
                else:
                    html_body = render_email_html(
                        c["reply_text"],
                        tenant_name=tenant.name if tenant else None,
                        primary_color=tenant.primary_color if tenant else None,
                        logo_url=tenant.logo_url if tenant else None,
                        campaign_buttons_html=campaign_buttons_html,
                    )
                import json as _json
                _cc = _json.loads(c["cc_emails"]) if c.get("cc_emails") else None
                _bcc = _json.loads(c["bcc_emails"]) if c.get("bcc_emails") else None
                if c["email_account_id"]:
                    # EML1: dispatch via the linked Gmail/Outlook account. No
                    # Resend fallback — wrong From identity would fail SPF/DKIM.
                    from app.modules.email_accounts.models import EmailAccount as _EmailAccount
                    from app.modules.email_accounts.outbound import send_via_linked_account

                    acct_addr = None
                    _acct = await db.get(_EmailAccount, c["email_account_id"])
                    if _acct:
                        acct_addr = _acct.email_address
                    _from_override = (
                        c["from_email"]
                        if c.get("from_email") and acct_addr and
                        c["from_email"].lower() != acct_addr.lower()
                        else None
                    )
                    sent_id, sent_provider = await send_via_linked_account(
                        db,
                        account_id=c["email_account_id"],
                        to_email=c["to_email"],
                        subject=c["subject"],
                        text=c["reply_text"],
                        html=html_body,
                        attachments=attachments,
                        cc=_cc,
                        bcc=_bcc,
                        draft_id=c["draft_id"],
                        kind=c["kind"],
                        from_email_override=_from_override,
                    )
                else:
                    sent_id = await send_email(to=c["to_email"], subject=c["subject"], body=c["reply_text"], attachments=attachments, from_email=c["from_email"] or None, html=html_body, cc=_cc, bcc=_bcc)
                    sent_provider = "resend"
                # Record outbound email for tracking
                from app.modules.emailtracking.service import create_outbound_email
                await create_outbound_email(
                    db,
                    tenant_id=c["tenant_id"],
                    resend_email_id=sent_id,
                    to_email=c["to_email"],
                    subject=c["subject"],
                    body=c["reply_text"],
                    actor_id=c["actor_id"],
                    contact_id=c["contact_id"],
                    draft_id=c["draft_id"],
                    kind=c["kind"],
                    provider=sent_provider,
                )
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
            # Sent (or demo-suppressed) — release the lease by deleting the row.
            await db.delete(rows_by_id[c["id"]])
            await db.commit()
        except ResendNotConfiguredError:
            await db.rollback()
            log.warning(
                "Resend not configured — pending send %s left queued for retry (attempt %d/%d)",
                c["id"], c["attempts"] + 1, MAX_SEND_ATTEMPTS,
            )
        except AccountRevokedError as exc:
            # EML1: provider rejected the refresh token mid-send. Roll back the
            # send transaction, then persist the revoked status in a clean one
            # so the settings UI shows Reconnect. Row leases out → dead-letter.
            await db.rollback()
            from app.modules.email_accounts.models import EmailAccount as _EmailAccount

            acct = await db.get(_EmailAccount, c["email_account_id"])
            if acct is not None and acct.status != "revoked":
                acct.status = "revoked"
                acct.last_error = str(exc)
                await db.commit()
            log.error(
                "Pending send %s: linked account %s revoked — reconnect required (attempt %d/%d)",
                c["id"], c["email_account_id"], c["attempts"] + 1, MAX_SEND_ATTEMPTS,
            )
        except Exception:
            await db.rollback()
            if c["attempts"] + 1 >= MAX_SEND_ATTEMPTS:
                log.error(
                    "Pending send %s to %s failed its final attempt (%d/%d) — dead-lettered",
                    c["id"], c["to_email"], c["attempts"] + 1, MAX_SEND_ATTEMPTS, exc_info=True,
                )
            else:
                log.exception(
                    "Failed to dispatch pending send %s (attempt %d/%d) — will retry",
                    c["id"], c["attempts"] + 1, MAX_SEND_ATTEMPTS,
                )


async def get_tenant_inbound_email(db: AsyncSession, tenant_id: uuid.UUID) -> str | None:
    tenant = await db.get(Tenant, tenant_id)
    return (tenant.inbound_email if tenant else None) or get_settings().inbound_email or None


async def get_tenant_inbound_addresses(db: AsyncSession, tenant_id: uuid.UUID) -> list[str]:
    """All shared-mailbox addresses: Tenant.inbound_email + tenant-level linked
    Gmail/Outlook accounts (EML1)."""
    from app.modules.email_accounts.service import get_linked_addresses

    base = await get_tenant_inbound_email(db, tenant_id)
    linked = await get_linked_addresses(db, tenant_id, user_id=None)
    return [a for a in [base, *linked] if a]


async def get_user_inbound_addresses(db: AsyncSession, tenant_id: uuid.UUID, user) -> list[str]:
    """All personal-mailbox addresses for a user: User.inbound_email + their
    linked Gmail/Outlook accounts (EML1)."""
    from app.modules.email_accounts.service import get_linked_addresses

    linked = await get_linked_addresses(db, tenant_id, user_id=user.id)
    return [a for a in [user.inbound_email, *linked] if a]


async def list_assignees(
    db: AsyncSession, tenant_id: uuid.UUID
) -> list[tuple[uuid.UUID, str, str | None]]:
    result = await db.execute(
        select(User.id, User.full_name, User.email).where(
            User.tenant_id == tenant_id,
            User.is_active == True,  # noqa: E712
        ).order_by(User.full_name)
    )
    return list(result.all())


async def find_contact_id_by_email(
    db: AsyncSession, tenant_id: uuid.UUID, email: str
) -> uuid.UUID | None:
    result = await db.execute(
        select(Contact.id).where(
            Contact.tenant_id == tenant_id,
            func.lower(Contact.email) == email.lower(),
        ).limit(1)
    )
    return result.scalar_one_or_none()
