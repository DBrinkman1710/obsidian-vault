from __future__ import annotations

import asyncio
import base64
import json
import re
import uuid
from datetime import datetime, timedelta, timezone
from typing import Annotated, List, Optional

import httpx

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, Request, UploadFile, status  # noqa: F401
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import CurrentUser, require_module
from app.config import get_settings
from app.core.email_html import render_email_html
from app.core.mailer import ResendNotConfiguredError, email_domain, is_valid_email, send_email
from app.core.models import Tenant
from app.core.tenant import resolve_tenant_by_slug
from app.database import get_db, db_session
from app.modules.activity import service as activity_service
from app.modules.departments import service as dept_service
from app.modules.departments.schemas import DepartmentOut
from app.modules.inbox import service, ai_scanner
from app.modules.inbox.attachments import fetch_attachment_list, fetch_attachment_bytes
from app.modules.inbox.models import DraftStatus
from app.modules.inbox.schemas import (
    AssigneeOut,
    BulkActionRequest,
    BulkAssignRequest,
    ComposeImproveRequest, ComposeSuggestRequest,
    DraftReview, DraftTicketOut, DraftWithContextOut,
    ForwardRequest,
    LinkContactRequest, ImproveReplyRequest,
)


router = APIRouter(prefix="/inbox", tags=["inbox"])
DB = Annotated[AsyncSession, Depends(get_db)]


async def _flush_after(delay_seconds: float) -> None:
    """Fire a one-shot flush once the undo window has expired."""
    await asyncio.sleep(delay_seconds)
    async with db_session() as db:
        await service.flush_pending_sends(db)

# Attachment limits, mirroring typical provider caps.
MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024        # 10 MB per file
MAX_ATTACHMENTS_TOTAL_BYTES = 25 * 1024 * 1024  # 25 MB per message


def _tenant_from_domains(tenant: Optional[Tenant]) -> set[str]:
    """Sender domains this tenant is allowed to send from."""
    domains: set[str] = set()
    if tenant and tenant.inbound_email:
        domains.add(email_domain(tenant.inbound_email))
    settings = get_settings()
    if settings.resend_from:
        domains.add(email_domain(settings.resend_from))
    return {d for d in domains if d}


async def _validate_from_email(
    from_email: Optional[str],
    db: AsyncSession,
    tenant_id: uuid.UUID,
    user_aliases: Optional[list[str]] = None,
) -> None:
    """Reject malformed senders and addresses outside this tenant's verified domains."""
    if not from_email:
        return
    if not is_valid_email(from_email):
        raise HTTPException(status_code=400, detail="Sender address is not a valid email address")
    # EML1: an exact match on an active linked Gmail/Outlook account is always
    # allowed — the mail goes out via that provider, not Resend's domains.
    from app.modules.email_accounts.models import EmailAccount
    from sqlalchemy import func as _func, select

    linked = await db.scalar(
        select(EmailAccount.id).where(
            EmailAccount.tenant_id == tenant_id,
            _func.lower(EmailAccount.email_address) == from_email.lower(),
            EmailAccount.status == "active",
        )
    )
    if linked is not None:
        return
    # Alias transport: a user-configured alias is allowed when the tenant has
    # at least one active linked account to use as the sending transport.
    if user_aliases and from_email.lower() in [a.lower() for a in user_aliases]:
        has_linked = await db.scalar(
            select(EmailAccount.id).where(
                EmailAccount.tenant_id == tenant_id,
                EmailAccount.status == "active",
            ).limit(1)
        )
        if has_linked is not None:
            return
    allowed = _tenant_from_domains(await db.get(Tenant, tenant_id))
    if allowed and email_domain(from_email) not in allowed:
        raise HTTPException(status_code=403, detail="Sender domain is not permitted for this workspace")


async def _resolve_linked_account_for_alias(
    from_email: Optional[str],
    db: AsyncSession,
    tenant_id: uuid.UUID,
    user_aliases: Optional[list[str]] = None,
) -> Optional[uuid.UUID]:
    """Return the linked account ID to use as transport when from_email is a
    user alias. Returns None when from_email matches the account directly (the
    normal EML1 path) or when Resend should be used."""
    if not from_email:
        return None
    from app.modules.email_accounts.models import EmailAccount
    from sqlalchemy import func as _func, select

    # Exact match — queue_send handles this path itself.
    exact = await db.scalar(
        select(EmailAccount.id).where(
            EmailAccount.tenant_id == tenant_id,
            _func.lower(EmailAccount.email_address) == from_email.lower(),
            EmailAccount.status == "active",
        )
    )
    if exact is not None:
        return None  # queue_send will find it via its own lookup
    # Alias case: use the first active linked account as transport.
    if user_aliases and from_email.lower() in [a.lower() for a in user_aliases]:
        return await db.scalar(
            select(EmailAccount.id).where(
                EmailAccount.tenant_id == tenant_id,
                EmailAccount.status == "active",
            ).limit(1)
        )
    return None


async def _encode_attachments(attachments: list[UploadFile]) -> list[dict]:
    """Read + base64-encode uploads, enforcing per-file and total size caps."""
    encoded: list[dict] = []
    total = 0
    for f in attachments:
        content = await f.read()
        total += len(content)
        if len(content) > MAX_ATTACHMENT_BYTES:
            raise HTTPException(status_code=413, detail=f"Attachment '{f.filename}' exceeds 10 MB")
        if total > MAX_ATTACHMENTS_TOTAL_BYTES:
            raise HTTPException(status_code=413, detail="Attachments exceed 25 MB total")
        encoded.append({
            "filename": f.filename or "attachment",
            "content": base64.b64encode(content).decode(),
            "content_type": f.content_type or "application/octet-stream",
        })
    return encoded


async def _live_fetch_attachment_bytes(
    resend_email_id: Optional[str], attachment_id: str
) -> Optional[bytes]:
    """Fetch attachment bytes straight from Resend (pre-signed download_url)."""
    settings = get_settings()
    if not resend_email_id or not settings.resend_api_key:
        return None
    auth = {"Authorization": f"Bearer {settings.resend_api_key}"}
    async with httpx.AsyncClient(timeout=30) as client:
        atts = await fetch_attachment_list(client, auth, resend_email_id)
        match = next((a for a in atts if a.get("id") == attachment_id), None)
        if not match or not match.get("download_url"):
            return None
        return await fetch_attachment_bytes(client, match["download_url"])


def _enrich_drafts(rows: list[tuple]) -> list[DraftTicketOut]:
    result = []
    for draft, inbound_subject, inbound_to in rows:
        item = DraftTicketOut.model_validate(draft)
        item.inbound_subject = inbound_subject
        item.inbound_to = inbound_to
        result.append(item)
    return result


@router.get("/drafts", response_model=list[DraftTicketOut])
async def list_drafts(
    current_user: CurrentUser,
    db: DB,
    status: Optional[DraftStatus] = None,
    mailbox: str = "shared",
    q: Optional[str] = None,
    contact_id: Optional[uuid.UUID] = Query(None),
    department_id: Optional[uuid.UUID] = Query(None),
    personal: bool = Query(False),
):
    if personal:
        # Personal work inbox: drafts explicitly assigned to this user, regardless
        # of department or which inbound address the mail arrived on.
        rows = await service.list_drafts(
            db, current_user.tenant_id, status, search=q, contact_id=contact_id,
            department_id=department_id, assigned_to=current_user.id,
        )
        return _enrich_drafts(rows)
    if mailbox == "personal":
        # Personal mailbox: mail sent to this user's own inbound address or any
        # of their linked Gmail/Outlook accounts (EML1).
        personal_addrs = await service.get_user_inbound_addresses(
            db, current_user.tenant_id, current_user
        )
        if not personal_addrs:
            return []
        rows = await service.list_drafts(
            db, current_user.tenant_id, status, personal_addrs,
            include_legacy=False, search=q, contact_id=contact_id,
            department_id=department_id,
        )
        return _enrich_drafts(rows)
    inbound_email = await service.get_tenant_inbound_addresses(db, current_user.tenant_id)
    # Personal Work Inbox mode: the shared mailbox is narrowed to mail assigned
    # to this user (or sent to any of their personal inbound addresses).
    personal_only_user_id = current_user.id if current_user.shared_inbox_disabled else None
    personal_only_inbound_email = None
    if current_user.shared_inbox_disabled:
        personal_only_inbound_email = await service.get_user_inbound_addresses(
            db, current_user.tenant_id, current_user
        ) or None
    rows = await service.list_drafts(
        db, current_user.tenant_id, status, inbound_email, search=q, contact_id=contact_id,
        department_id=department_id,
        personal_only_user_id=personal_only_user_id,
        personal_only_inbound_email=personal_only_inbound_email,
    )
    return _enrich_drafts(rows)


@router.get("/trending")
async def trending_topics(current_user: CurrentUser, db: DB):
    """Most frequent subject words across the tenant's recent drafts — shown as
    light-grey 'trending topics' under the inbox search box when it is empty."""
    topics = await service.trending_topics(db, current_user.tenant_id)
    return {"topics": topics}


@router.get("/drafts/count")
async def count_pending_drafts(
    current_user: CurrentUser,
    db: DB,
    department_id: Optional[uuid.UUID] = Query(None),
):
    personal_addrs = await service.get_user_inbound_addresses(
        db, current_user.tenant_id, current_user
    )
    if not personal_addrs:
        shared_count = await service.count_pending_drafts(
            db, current_user.tenant_id, department_id=department_id
        )
        shared_unread = await service.count_pending_drafts(
            db, current_user.tenant_id, department_id=department_id, unread_only=True
        )
        return {"pending": shared_count, "personal": 0, "unread": shared_unread, "unread_personal": 0}
    inbound_email = await service.get_tenant_inbound_addresses(db, current_user.tenant_id)
    shared_count = await service.count_pending_drafts(
        db, current_user.tenant_id, inbound_email, department_id=department_id
    )
    personal_count = await service.count_pending_drafts(
        db, current_user.tenant_id, personal_addrs, include_legacy=False,
        department_id=department_id,
    )
    shared_unread = await service.count_pending_drafts(
        db, current_user.tenant_id, inbound_email, department_id=department_id, unread_only=True
    )
    personal_unread = await service.count_pending_drafts(
        db, current_user.tenant_id, personal_addrs, include_legacy=False,
        department_id=department_id, unread_only=True,
    )
    return {"pending": shared_count, "personal": personal_count, "unread": shared_unread, "unread_personal": personal_unread}


@router.get("/drafts/{draft_id}", response_model=DraftWithContextOut)
async def get_draft(draft_id: uuid.UUID, current_user: CurrentUser, db: DB):
    ctx = await service.get_draft_with_context(db, current_user.tenant_id, draft_id)
    if not ctx:
        raise HTTPException(status_code=404, detail="Draft not found")
    draft = ctx["draft"]
    if draft is not None and draft.opened_at is None:
        draft.opened_at = datetime.now(timezone.utc)
        draft.opened_by = current_user.id
        await db.commit()
    return ctx


@router.patch("/drafts/{draft_id}/assign", response_model=DraftTicketOut)
async def assign_draft(draft_id: uuid.UUID, body: dict, current_user: CurrentUser, db: DB):
    """Assign (or unassign) a draft to a team member without changing review status."""
    draft = await service.get_draft(db, current_user.tenant_id, draft_id)
    if not draft:
        raise HTTPException(status_code=404, detail="Draft not found")
    assigned_to = body.get("assigned_to")
    draft.assigned_to = uuid.UUID(assigned_to) if assigned_to else None
    await db.commit()
    await db.refresh(draft)
    return draft


@router.patch("/drafts/{draft_id}/route", response_model=DraftTicketOut)
async def route_draft_to_department(draft_id: uuid.UUID, body: dict, current_user: CurrentUser, db: DB):
    """Route a pending draft to a department without creating a ticket.

    Sets forwarded_to_department_id so the draft appears in the department's
    shared inbox tab. Status stays 'pending' so department members can still
    approve/reply/reject it.
    """
    draft = await service.get_draft(db, current_user.tenant_id, draft_id)
    if not draft:
        raise HTTPException(status_code=404, detail="Draft not found")
    department_id = body.get("department_id")
    draft.forwarded_to_department_id = uuid.UUID(department_id) if department_id else None
    await db.commit()
    await db.refresh(draft)
    return draft


@router.post("/drafts/{draft_id}/review", response_model=DraftTicketOut)
async def review_draft(draft_id: uuid.UUID, body: DraftReview, current_user: CurrentUser, db: DB):
    if body.action not in ("approve", "reject"):
        raise HTTPException(status_code=400, detail="Invalid action, must be 'approve' or 'reject'")
    draft = await service.get_draft(db, current_user.tenant_id, draft_id)
    if not draft:
        raise HTTPException(status_code=404, detail="Draft not found")
    if draft.status != DraftStatus.pending:
        raise HTTPException(status_code=409, detail="Draft already reviewed")
    return await service.review_draft(db, current_user.tenant_id, draft, current_user.id, body)


@router.post("/drafts/{draft_id}/undo-review", response_model=DraftTicketOut)
async def undo_review(draft_id: uuid.UUID, current_user: CurrentUser, db: DB):
    """Revert an approved/rejected draft back to pending; an approved draft's
    created ticket is soft-deleted."""
    draft = await service.get_draft(db, current_user.tenant_id, draft_id)
    if not draft:
        raise HTTPException(status_code=404, detail="Draft not found")
    try:
        return await service.undo_review(db, current_user.tenant_id, draft)
    except ValueError as e:
        raise HTTPException(status_code=409, detail=str(e))


@router.post("/drafts/{draft_id}/link-contact", response_model=DraftWithContextOut)
async def link_contact(draft_id: uuid.UUID, body: LinkContactRequest, current_user: CurrentUser, db: DB):
    result = await service.link_contact_to_draft(db, current_user.tenant_id, draft_id, body.contact_id)
    if not result:
        raise HTTPException(status_code=404, detail="Draft or contact not found")
    return result


@router.post("/drafts/{draft_id}/generate", response_model=DraftWithContextOut, dependencies=[Depends(require_module("ai"))])
async def generate_draft_ai(
    draft_id: uuid.UUID,
    current_user: CurrentUser,
    db: DB,
    mode: Optional[str] = None,
):
    """Run AI enrichment for this draft on demand.

    mode=scan     — subject/priority/description only (leaves briefing untouched)
    mode=briefing — customer briefing only (leaves scan fields untouched)
    (no mode)     — both scan + briefing (original behaviour)
    """
    ctx = await service.get_draft_with_context(db, current_user.tenant_id, draft_id)
    if not ctx:
        raise HTTPException(status_code=404, detail="Draft not found")
    draft = ctx["draft"]
    msg = ctx["inbound_message"]
    if not msg:
        raise HTTPException(status_code=409, detail="Draft has no inbound message to analyze")
    if mode == "scan":
        await service.enrich_scan_only(db, current_user.tenant_id, draft, msg)
    elif mode == "briefing":
        await service.enrich_briefing_only(db, current_user.tenant_id, draft, msg)
    else:
        await service.enrich_draft(db, current_user.tenant_id, draft, msg)
    await db.commit()
    if draft.ai_status == "failed":
        raise HTTPException(status_code=502, detail="AI generation failed. Please try again.")
    return await service.get_draft_with_context(db, current_user.tenant_id, draft_id)


@router.post("/drafts/{draft_id}/suggest-reply", dependencies=[Depends(require_module("ai"))])
async def suggest_reply(draft_id: uuid.UUID, current_user: CurrentUser, db: DB):
    ctx = await service.get_draft_with_context(db, current_user.tenant_id, draft_id)
    if not ctx:
        raise HTTPException(status_code=404, detail="Draft not found")
    draft = ctx["draft"]
    contact = ctx["contact"]
    tenant = await db.get(Tenant, current_user.tenant_id)
    suggestion = await ai_scanner.generate_reply_draft(
        subject=draft.ai_suggested_subject,
        description=draft.ai_suggested_description,
        context_summary=draft.context_summary,
        contact_name=contact.full_name if contact else None,
        language=draft.detected_language or "en",
        tenant_profile=tenant.ai_profile if tenant else None,
        db=db,
        tenant_id=current_user.tenant_id,
    )
    return {"suggestion": suggestion}


@router.post("/drafts/{draft_id}/improve-reply", dependencies=[Depends(require_module("ai"))])
async def improve_reply(draft_id: uuid.UUID, body: ImproveReplyRequest, current_user: CurrentUser, db: DB):
    ctx = await service.get_draft_with_context(db, current_user.tenant_id, draft_id)
    if not ctx:
        raise HTTPException(status_code=404, detail="Draft not found")
    draft = ctx["draft"]
    tenant = await db.get(Tenant, current_user.tenant_id)
    suggestions = await ai_scanner.generate_reply_improvements(
        current_text=body.current_text,
        context_summary=draft.context_summary,
        subject=draft.ai_suggested_subject,
        language=draft.detected_language or "en",
        tenant_profile=tenant.ai_profile if tenant else None,
    )
    return {"suggestions": suggestions}


@router.post("/drafts/{draft_id}/send-reply")
async def send_reply(
    draft_id: uuid.UUID,
    current_user: CurrentUser,
    db: DB,
    reply_text: str = Form(...),
    attachments: List[UploadFile] = File(default=[]),
    from_email: Optional[str] = Form(None),
    cc: Optional[str] = Form(None),
    bcc: Optional[str] = Form(None),
):
    """Queue a reply for sending after a 5s undo window. Attachments are optional."""
    ctx = await service.get_draft_with_context(db, current_user.tenant_id, draft_id)
    if not ctx:
        raise HTTPException(status_code=404, detail="Draft not found")

    draft = ctx["draft"]
    msg = ctx["inbound_message"]
    contact = ctx["contact"]
    if not msg or not msg.sender:
        raise HTTPException(status_code=409, detail="Original message has no sender to reply to")
    user_aliases = list(current_user.send_from_aliases or [])
    if current_user.reply_from_email and current_user.reply_from_email not in user_aliases:
        user_aliases.append(current_user.reply_from_email)
    await _validate_from_email(from_email, db, current_user.tenant_id, user_aliases)
    alias_account_id = await _resolve_linked_account_for_alias(from_email, db, current_user.tenant_id, user_aliases)
    subject = f"Re: {msg.subject or draft.final_subject or draft.ai_suggested_subject}"

    if await service.tenant_is_demo(db, current_user.tenant_id):
        return {"queued": False, "demo": True, "to": msg.sender, "subject": subject}

    # Encode any attached files so the background job can send them
    encoded_attachments = await _encode_attachments(attachments)
    attachments_json = json.dumps(encoded_attachments) if encoded_attachments else None

    # Server window is 8s but the UI counts down 5s on its own clock — the 3s
    # margin absorbs network latency and browser/server clock skew so Undo
    # clicked during the bar always lands before the flush.
    send_at = datetime.now(timezone.utc) + timedelta(seconds=8)
    import json as _json
    cc_json = _json.dumps([e.strip() for e in cc.split(",") if e.strip()]) if cc and cc.strip() else None
    bcc_json = _json.dumps([e.strip() for e in bcc.split(",") if e.strip()]) if bcc and bcc.strip() else None
    await service.queue_send(
        db=db,
        draft_id=draft.id,
        tenant_id=current_user.tenant_id,
        to_email=msg.sender,
        subject=subject,
        reply_text=reply_text,
        send_at=send_at,
        actor_id=current_user.id,
        contact_id=contact.id if contact else None,
        attachments_json=attachments_json,
        from_email=from_email or None,
        linked_account_id=alias_account_id,
        cc_emails=cc_json,
        bcc_emails=bcc_json,
    )
    # Kick off a one-shot flush ~0.5s after the undo window closes so the email
    # goes out promptly instead of waiting up to 5s for the scheduler tick.
    asyncio.create_task(_flush_after((send_at - datetime.now(timezone.utc)).total_seconds() + 0.5))
    return {"queued": True, "to": msg.sender, "subject": subject, "undo_until": send_at.isoformat(), "undo_seconds": 5}


@router.post("/drafts/{draft_id}/undo-send")
async def undo_send(draft_id: uuid.UUID, current_user: CurrentUser, db: DB):
    cancelled = await service.cancel_send(db, draft_id, current_user.tenant_id)
    if not cancelled:
        raise HTTPException(status_code=409, detail="Email already sent or not found")
    return {"cancelled": True}


@router.get("/drafts/{draft_id}/attachments/{attachment_id}/download")
async def download_attachment(
    draft_id: uuid.UUID, attachment_id: str, current_user: CurrentUser, db: DB
):
    ctx = await service.get_draft_with_context(db, current_user.tenant_id, draft_id)
    if not ctx:
        raise HTTPException(status_code=404, detail="Draft not found")
    msg = ctx["inbound_message"]
    if not msg or not msg.attachments_json:
        raise HTTPException(status_code=404, detail="No attachments for this message")

    attachments = json.loads(msg.attachments_json)
    att = next((a for a in attachments if a.get("id") == attachment_id), None)
    if not att:
        raise HTTPException(status_code=404, detail="Attachment not found")

    raw = att.get("content", "")
    content = base64.b64decode(raw) if raw else b""
    if not content:
        # Legacy rows (ingested before content was stored) or over-cap files:
        # fetch fresh bytes from Resend via a pre-signed download_url.
        content = await _live_fetch_attachment_bytes(msg.resend_email_id, attachment_id)
        if content is None:
            raise HTTPException(status_code=404, detail="Attachment no longer available")
    filename = att.get("filename", "attachment")
    filename = re.sub(r'[^\w\-. ]', '_', filename)[:200] or "attachment"
    content_type = att.get("content_type", "application/octet-stream")
    return Response(
        content=content,
        media_type=content_type,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.post("/drafts/{draft_id}/forward")
async def forward_draft(draft_id: uuid.UUID, body: ForwardRequest, current_user: CurrentUser, db: DB):
    ctx = await service.get_draft_with_context(db, current_user.tenant_id, draft_id)
    if not ctx:
        raise HTTPException(status_code=404, detail="Draft not found")

    draft = ctx["draft"]
    msg = ctx["inbound_message"]
    contact = ctx["contact"]

    dept = await dept_service.get_department(db, current_user.tenant_id, body.department_id)
    if not dept:
        raise HTTPException(status_code=404, detail="Department not found")

    # Build customer auto-reply text
    if dept.reply_template:
        customer_reply = dept.reply_template.replace("{name}", dept.name).replace("{sla}", str(dept.sla_working_days))
    else:
        customer_reply = (
            f"Thank you for your message. I'm sorry to hear about your situation. "
            f"I have informed my colleagues at {dept.name} about your inquiry. "
            f"You can expect a response within {dept.sla_working_days} working days. "
            f"We apologise for any inconvenience this may cause."
        )

    original_subject = draft.final_subject or draft.ai_suggested_subject

    # Send forwarding email to department
    dept_body = (
        f"A customer inquiry has been forwarded to {dept.name}.\n\n"
        f"From: {msg.sender}\n"
        f"Subject: {original_subject}\n\n"
        f"--- Original message ---\n{msg.raw_body}"
    )
    # Include the customer's original attachments; a file we can't recover
    # degrades to forwarding without it rather than blocking the forward.
    fwd_attachments: list[dict] = []
    if msg.attachments_json:
        for att in json.loads(msg.attachments_json):
            content = att.get("content", "")
            if not content:
                raw_bytes = await _live_fetch_attachment_bytes(msg.resend_email_id, att.get("id", ""))
                if raw_bytes is None:
                    continue
                content = base64.b64encode(raw_bytes).decode()
            fwd_attachments.append({
                "filename": att.get("filename", "attachment"),
                "content": content,
            })

    if not await service.tenant_is_demo(db, current_user.tenant_id):
        try:
            tenant = await db.get(Tenant, current_user.tenant_id)
            await send_email(
                to=dept.email,
                subject=f"FWD: {original_subject}",
                body=dept_body,
                reply_to=msg.sender,
                attachments=fwd_attachments or None,
                html=render_email_html(
                    dept_body,
                    tenant_name=tenant.name if tenant else None,
                    primary_color=tenant.primary_color if tenant else None,
                    logo_url=tenant.logo_url if tenant else None,
                ),
            )
        except ResendNotConfiguredError:
            pass  # Email not configured — still mark as forwarded

    draft.forwarded_to_department_id = dept.id
    draft.status = DraftStatus.forwarded

    await activity_service.log_event(
        db=db,
        tenant_id=current_user.tenant_id,
        module="inbox",
        event_type="email.forwarded",
        entity_type="draft_ticket",
        entity_id=draft.id,
        contact_id=contact.id if contact else None,
        actor_id=current_user.id,
        payload={
            "department": dept.name,
            "dept_email": dept.email,
            "subject": original_subject,
        },
    )
    await db.commit()
    await db.refresh(draft)

    return {"suggestion": customer_reply, "department": DepartmentOut.model_validate(dept)}


@router.post("/drafts/{draft_id}/clear-followup", response_model=DraftTicketOut)
async def clear_followup(draft_id: uuid.UUID, current_user: CurrentUser, db: DB):
    draft = await service.get_draft(db, current_user.tenant_id, draft_id)
    if not draft:
        raise HTTPException(status_code=404, detail="Draft not found")
    draft.follow_up_at = None
    await db.commit()
    await db.refresh(draft)
    return draft


# --- Bulk actions ---

@router.post("/drafts/bulk-action")
async def bulk_action_drafts(body: BulkActionRequest, current_user: CurrentUser, db: DB):
    """Move multiple drafts to bin or spam."""
    if body.action not in ("bin", "spam"):
        raise HTTPException(status_code=400, detail="Invalid action, must be 'bin' or 'spam'")
    if not body.ids:
        raise HTTPException(status_code=400, detail="No messages selected")
    new_status = DraftStatus.bin if body.action == "bin" else DraftStatus.spam
    count = await service.bulk_update_drafts(db, current_user.tenant_id, body.ids, new_status)
    return {"updated": count}


@router.get("/drafts/assignees", response_model=list[AssigneeOut])
async def list_draft_assignees(current_user: CurrentUser, db: DB):
    """List active users available for assignment in this tenant."""
    rows = await service.list_assignees(db, current_user.tenant_id)
    return [AssigneeOut(id=row[0], full_name=row[1], email=row[2]) for row in rows]


@router.post("/drafts/bulk-assign")
async def bulk_assign_drafts(body: BulkAssignRequest, current_user: CurrentUser, db: DB):
    """Bulk assign drafts to a user and/or forward to a department."""
    if not body.ids:
        raise HTTPException(status_code=400, detail="No messages selected")
    update_fields: dict = {}
    if "assigned_to_user_id" in body.model_fields_set:
        update_fields["assigned_to"] = body.assigned_to_user_id
    if "department_id" in body.model_fields_set:
        update_fields["forwarded_to_department_id"] = body.department_id
    if not update_fields:
        return {"updated": 0}
    count = await service.bulk_assign_drafts(db, current_user.tenant_id, body.ids, update_fields)
    return {"updated": count}


# --- Compose (outbound, direct send) ---

@router.post("/compose", status_code=status.HTTP_200_OK)
async def compose_send(
    current_user: CurrentUser,
    db: DB,
    to: str = Form(...),
    subject: str = Form(...),
    body: str = Form(...),
    attachments: List[UploadFile] = File(default=[]),
    from_email: Optional[str] = Form(None),
    template_id: Optional[str] = Form(None),
    campaign_buttons_json: Optional[str] = Form(None),
    html_body: Optional[str] = Form(None),
):
    """Queue a new outbound email to one or more recipients (sent individually,
    BCC-style) after a 5s undo window. Supports optional file attachments."""
    user_aliases = list(current_user.send_from_aliases or [])
    if current_user.reply_from_email and current_user.reply_from_email not in user_aliases:
        user_aliases.append(current_user.reply_from_email)
    await _validate_from_email(from_email, db, current_user.tenant_id, user_aliases)
    alias_account_id = await _resolve_linked_account_for_alias(from_email, db, current_user.tenant_id, user_aliases)
    try:
        recipients = json.loads(to)
    except (json.JSONDecodeError, TypeError):
        raise HTTPException(status_code=400, detail="Recipients must be a list of email addresses")
    if not isinstance(recipients, list) or not recipients:
        raise HTTPException(status_code=400, detail="At least one recipient is required")
    invalid = [r for r in recipients if not is_valid_email(str(r))]
    if invalid:
        raise HTTPException(status_code=400, detail=f"Invalid recipient address(es): {', '.join(map(str, invalid))}")
    if not subject.strip() or not body.strip():
        raise HTTPException(status_code=400, detail="Subject and message body are required")

    if await service.tenant_is_demo(db, current_user.tenant_id):
        return {"sent": 0, "failed": [], "demo": True}

    encoded_attachments = await _encode_attachments(attachments)
    attachments_json = json.dumps(encoded_attachments) if encoded_attachments else None

    # One queue row per recipient sharing one batch id, so a single undo call
    # (POST /drafts/{compose_id}/undo-send) cancels the whole batch. Same 8s
    # server hold vs 5s UI countdown margin as send-reply.
    compose_id = uuid.uuid4()
    send_at = datetime.now(timezone.utc) + timedelta(seconds=8)
    asyncio.create_task(_flush_after((send_at - datetime.now(timezone.utc)).total_seconds() + 0.5))
    for recipient in recipients:
        # Phase 9C: tracked campaign buttons need a contact to apply the label
        # to, so resolve each recipient to a contact by email (best effort).
        recipient_contact_id = None
        if campaign_buttons_json:
            recipient_contact_id = await service.find_contact_id_by_email(
                db, current_user.tenant_id, str(recipient)
            )
        await service.queue_send(
            db=db,
            draft_id=compose_id,
            tenant_id=current_user.tenant_id,
            to_email=recipient,
            subject=subject,
            reply_text=body,
            send_at=send_at,
            actor_id=current_user.id,
            contact_id=recipient_contact_id,
            attachments_json=attachments_json,
            from_email=from_email or None,
            linked_account_id=alias_account_id,
            kind="compose",
            campaign_buttons_json=campaign_buttons_json or None,
            prerendered_html=html_body or None,
            commit=False,
        )
    await db.commit()
    return {
        "queued": True,
        "compose_id": str(compose_id),
        "recipients": len(recipients),
        "undo_until": send_at.isoformat(),
        "undo_seconds": 5,
    }


@router.post("/compose/suggest", status_code=status.HTTP_200_OK, dependencies=[Depends(require_module("ai"))])
async def compose_suggest(body: ComposeSuggestRequest, current_user: CurrentUser):
    """Use AI to suggest a subject and body for a new outbound email."""
    return await ai_scanner.generate_compose_suggestion(body.prompt)


@router.post("/compose/improve", status_code=status.HTTP_200_OK, dependencies=[Depends(require_module("ai"))])
async def compose_improve(body: ComposeImproveRequest, current_user: CurrentUser):
    """Use AI to improve an existing compose email."""
    return await ai_scanner.improve_compose_email(body.subject, body.body)


# --- Webhook endpoints — public router, no auth, mounted separately in main.py ---
# Must NOT be inside the module-gated router or Resend/Twilio calls will get 403.

webhook_router = APIRouter(prefix="/inbox", tags=["inbox-webhooks"])
WDB = Annotated[AsyncSession, Depends(get_db)]


@webhook_router.post("/webhooks/{tenant_slug}/email", status_code=status.HTTP_200_OK)
async def tenant_email_webhook(tenant_slug: str, request: Request, db: WDB):
    """Per-tenant Resend inbound webhook. Configure one route per client in Resend,
    pointing to https://{env}.getyippie.com/api/v1/inbox/webhooks/{slug}/email.
    The email poller owns ingestion — this just validates the slug and returns 200
    so Resend doesn't retry.
    """
    await resolve_tenant_by_slug(db, tenant_slug)
    return {"status": "ok"}


@webhook_router.post("/webhooks/{tenant_slug}/whatsapp", status_code=status.HTTP_200_OK)
async def twilio_webhook(tenant_slug: str, request: Request, db: WDB):
    """Twilio WhatsApp inbound webhook — no auth required. Configure one URL per
    client in Twilio: https://{env}.getyippie.com/api/v1/inbox/webhooks/{slug}/whatsapp"""
    form = await request.form()
    from app.config import get_settings as _gs
    _settings = _gs()
    if not _settings.twilio_auth_token:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Twilio not configured")
    from twilio.request_validator import RequestValidator
    validator = RequestValidator(_settings.twilio_auth_token)
    sig = request.headers.get("X-Twilio-Signature", "")
    if not validator.validate(str(request.url), dict(form), sig):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Invalid Twilio signature")
    tenant_id = await resolve_tenant_by_slug(db, tenant_slug)
    tenant = await db.get(Tenant, tenant_id)
    # Only auto-scan when the tenant has the AI module AND opted into auto-scan;
    # otherwise the draft arrives un-scanned and the agent clicks Generate.
    ai_scan = (
        tenant is not None
        and "ai" in (tenant.enabled_modules or [])
        and bool(tenant.ai_auto_scan)
    )
    await service.ingest_whatsapp(
        db=db,
        tenant_id=tenant_id,
        sender=str(form.get("From", "")),
        body=str(form.get("Body", "")),
        sender_name=str(form.get("ProfileName", "")) or None,
        ai_scan=ai_scan,
    )
    return {"status": "ok"}
