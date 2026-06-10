from __future__ import annotations

import base64
import json
import uuid
from datetime import datetime, timedelta, timezone
from typing import Annotated, List, Optional

import httpx
from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile, status  # noqa: F401
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel

from app.auth.dependencies import CurrentUser, require_module
from app.config import get_settings
from app.core.mailer import ResendNotConfiguredError, email_domain, is_valid_email, send_email
from app.core.models import Tenant
from app.core.tenant import resolve_tenant_by_slug
from app.database import get_db
from app.modules.activity import service as activity_service
from app.modules.departments import service as dept_service
from app.modules.departments.schemas import DepartmentOut
from app.modules.inbox import service, ai_scanner
from app.modules.inbox.models import DraftStatus
from app.modules.inbox.schemas import (
    DraftReview, DraftTicketOut, DraftWithContextOut,
    LinkContactRequest, ImproveReplyRequest,
)


class ForwardRequest(BaseModel):
    department_id: uuid.UUID


router = APIRouter(prefix="/inbox", tags=["inbox"])
DB = Annotated[AsyncSession, Depends(get_db)]

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


async def _validate_from_email(from_email: Optional[str], db: AsyncSession, tenant_id: uuid.UUID) -> None:
    """Reject malformed senders and addresses outside this tenant's verified domains."""
    if not from_email:
        return
    if not is_valid_email(from_email):
        raise HTTPException(status_code=400, detail="from_email is not a valid email address")
    allowed = _tenant_from_domains(await db.get(Tenant, tenant_id))
    if allowed and email_domain(from_email) not in allowed:
        raise HTTPException(status_code=403, detail="from_email domain is not permitted for this tenant")


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
    status: Optional[DraftStatus] = DraftStatus.pending,
    mailbox: str = "shared",
):
    if mailbox == "personal":
        # Personal mailbox: only mail sent to this user's own inbound address.
        if not current_user.inbound_email:
            return []
        rows = await service.list_drafts(
            db, current_user.tenant_id, status, current_user.inbound_email, include_legacy=False
        )
        return _enrich_drafts(rows)
    tenant = await db.get(Tenant, current_user.tenant_id)
    inbound_email = (tenant.inbound_email if tenant else None) or get_settings().inbound_email or None
    rows = await service.list_drafts(db, current_user.tenant_id, status, inbound_email)
    return _enrich_drafts(rows)


@router.get("/drafts/{draft_id}", response_model=DraftWithContextOut)
async def get_draft(draft_id: uuid.UUID, current_user: CurrentUser, db: DB):
    ctx = await service.get_draft_with_context(db, current_user.tenant_id, draft_id)
    if not ctx:
        raise HTTPException(status_code=404, detail="Draft not found")
    return ctx


@router.post("/drafts/{draft_id}/review", response_model=DraftTicketOut)
async def review_draft(draft_id: uuid.UUID, body: DraftReview, current_user: CurrentUser, db: DB):
    if body.action not in ("approve", "reject"):
        raise HTTPException(status_code=400, detail="action must be 'approve' or 'reject'")
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


@router.post("/drafts/{draft_id}/suggest-reply", dependencies=[Depends(require_module("ai"))])
async def suggest_reply(draft_id: uuid.UUID, current_user: CurrentUser, db: DB):
    ctx = await service.get_draft_with_context(db, current_user.tenant_id, draft_id)
    if not ctx:
        raise HTTPException(status_code=404, detail="Draft not found")
    draft = ctx["draft"]
    contact = ctx["contact"]
    suggestion = await ai_scanner.generate_reply_draft(
        subject=draft.ai_suggested_subject,
        description=draft.ai_suggested_description,
        context_summary=draft.context_summary,
        contact_name=contact.full_name if contact else None,
        language=draft.detected_language or "en",
    )
    return {"suggestion": suggestion}


@router.post("/drafts/{draft_id}/improve-reply", dependencies=[Depends(require_module("ai"))])
async def improve_reply(draft_id: uuid.UUID, body: ImproveReplyRequest, current_user: CurrentUser, db: DB):
    ctx = await service.get_draft_with_context(db, current_user.tenant_id, draft_id)
    if not ctx:
        raise HTTPException(status_code=404, detail="Draft not found")
    draft = ctx["draft"]
    suggestions = await ai_scanner.generate_reply_improvements(
        current_text=body.current_text,
        context_summary=draft.context_summary,
        subject=draft.ai_suggested_subject,
        language=draft.detected_language or "en",
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
    await _validate_from_email(from_email, db, current_user.tenant_id)
    subject = f"Re: {draft.final_subject or draft.ai_suggested_subject}"

    if await service.tenant_is_demo(db, current_user.tenant_id):
        return {"queued": False, "demo": True, "to": msg.sender, "subject": subject}

    # Encode any attached files so the background job can send them
    encoded_attachments = await _encode_attachments(attachments)
    attachments_json = json.dumps(encoded_attachments) if encoded_attachments else None

    # Server window is 8s but the UI counts down 5s on its own clock — the 3s
    # margin absorbs network latency and browser/server clock skew so Undo
    # clicked during the bar always lands before the flush.
    send_at = datetime.now(timezone.utc) + timedelta(seconds=8)
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
    )
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
    if not msg or not msg.resend_email_id:
        raise HTTPException(status_code=404, detail="No Resend ID for this message")

    settings = get_settings()
    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.get(
            f"https://api.resend.com/emails/receiving/{msg.resend_email_id}/attachments/{attachment_id}",
            headers={"Authorization": f"Bearer {settings.resend_api_key}"},
        )
    if resp.status_code != 200:
        raise HTTPException(status_code=404, detail="Attachment not found")

    att = resp.json()
    raw = att.get("content", "")
    content = base64.b64decode(raw) if raw else b""
    filename = att.get("filename", "attachment")
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
    if not await service.tenant_is_demo(db, current_user.tenant_id):
        try:
            await send_email(
                to=dept.email,
                subject=f"FWD: {original_subject}",
                body=dept_body,
                reply_to=msg.sender,
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

class BulkActionRequest(BaseModel):
    ids: list[uuid.UUID]
    action: str  # "bin" | "spam"


@router.post("/drafts/bulk-action")
async def bulk_action_drafts(body: BulkActionRequest, current_user: CurrentUser, db: DB):
    """Move multiple drafts to bin or spam."""
    if body.action not in ("bin", "spam"):
        raise HTTPException(status_code=400, detail="action must be 'bin' or 'spam'")
    if not body.ids:
        raise HTTPException(status_code=400, detail="ids must not be empty")
    new_status = DraftStatus.bin if body.action == "bin" else DraftStatus.spam
    count = await service.bulk_update_drafts(db, current_user.tenant_id, body.ids, new_status)
    return {"updated": count}


# --- Compose (outbound, direct send) ---

class ComposeRequest(BaseModel):
    to: list[str]          # list of email addresses
    subject: str
    body: str


class ComposeSuggestRequest(BaseModel):
    prompt: str            # agent's brief describing the email to write


@router.post("/compose", status_code=status.HTTP_200_OK)
async def compose_send(
    current_user: CurrentUser,
    db: DB,
    to: str = Form(...),
    subject: str = Form(...),
    body: str = Form(...),
    attachments: List[UploadFile] = File(default=[]),
    from_email: Optional[str] = Form(None),
):
    """Queue a new outbound email to one or more recipients (sent individually,
    BCC-style) after a 5s undo window. Supports optional file attachments."""
    await _validate_from_email(from_email, db, current_user.tenant_id)
    try:
        recipients = json.loads(to)
    except (json.JSONDecodeError, TypeError):
        raise HTTPException(status_code=400, detail="'to' must be a JSON array of email addresses")
    if not isinstance(recipients, list) or not recipients:
        raise HTTPException(status_code=400, detail="At least one recipient is required")
    invalid = [r for r in recipients if not is_valid_email(str(r))]
    if invalid:
        raise HTTPException(status_code=400, detail=f"Invalid recipient address(es): {', '.join(map(str, invalid))}")
    if not subject.strip() or not body.strip():
        raise HTTPException(status_code=400, detail="Subject and body are required")

    if await service.tenant_is_demo(db, current_user.tenant_id):
        return {"sent": 0, "failed": [], "demo": True}

    encoded_attachments = await _encode_attachments(attachments)
    attachments_json = json.dumps(encoded_attachments) if encoded_attachments else None

    # One queue row per recipient sharing one batch id, so a single undo call
    # (POST /drafts/{compose_id}/undo-send) cancels the whole batch. Same 8s
    # server hold vs 5s UI countdown margin as send-reply.
    compose_id = uuid.uuid4()
    send_at = datetime.now(timezone.utc) + timedelta(seconds=8)
    for recipient in recipients:
        await service.queue_send(
            db=db,
            draft_id=compose_id,
            tenant_id=current_user.tenant_id,
            to_email=recipient,
            subject=subject,
            reply_text=body,
            send_at=send_at,
            actor_id=current_user.id,
            attachments_json=attachments_json,
            from_email=from_email or None,
            kind="compose",
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


# --- Webhook endpoints — public router, no auth, mounted separately in main.py ---
# Must NOT be inside the module-gated router or Resend/Twilio calls will get 403.

webhook_router = APIRouter(prefix="/inbox", tags=["inbox-webhooks"])
WDB = Annotated[AsyncSession, Depends(get_db)]


@webhook_router.post("/webhooks/email", status_code=status.HTTP_200_OK)
async def email_webhook(request: Request):
    """Legacy shared Resend webhook — kept for backward compat. Poller handles ingestion."""
    return {"status": "ok"}


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
    tenant_id = await resolve_tenant_by_slug(db, tenant_slug)
    await service.ingest_whatsapp(
        db=db,
        tenant_id=tenant_id,
        sender=str(form.get("From", "")),
        body=str(form.get("Body", "")),
        sender_name=str(form.get("ProfileName", "")) or None,
    )
    return {"status": "ok"}
