from __future__ import annotations

import asyncio
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
from app.core.mailer import ResendNotConfiguredError, send_email
from app.core.tenant import resolve_tenant_uuid
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


@router.get("/drafts", response_model=list[DraftTicketOut])
async def list_drafts(
    current_user: CurrentUser,
    db: DB,
    status: Optional[DraftStatus] = DraftStatus.pending,
):
    inbound_email = get_settings().inbound_email or None
    return await service.list_drafts(db, current_user.tenant_id, status, inbound_email)


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
):
    """Queue a reply for sending after a 5s undo window. Attachments are optional."""
    ctx = await service.get_draft_with_context(db, current_user.tenant_id, draft_id)
    if not ctx:
        raise HTTPException(status_code=404, detail="Draft not found")

    draft = ctx["draft"]
    msg = ctx["inbound_message"]
    contact = ctx["contact"]
    subject = f"Re: {draft.final_subject or draft.ai_suggested_subject}"

    # Encode any attached files so the background job can send them
    encoded_attachments: list[dict] = []
    for f in attachments:
        content = await f.read()
        encoded_attachments.append({
            "filename": f.filename or "attachment",
            "content": base64.b64encode(content).decode(),
            "content_type": f.content_type or "application/octet-stream",
        })

    attachments_json = json.dumps(encoded_attachments) if encoded_attachments else None

    send_at = datetime.now(timezone.utc) + timedelta(seconds=5)
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
    )
    return {"queued": True, "to": msg.sender, "subject": subject, "undo_until": send_at.isoformat()}


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
):
    """Send a new outbound email to one or more recipients (BCC when multiple). Supports optional file attachments."""
    recipients: list[str] = json.loads(to)
    if not recipients:
        raise HTTPException(status_code=400, detail="At least one recipient is required")
    if not subject.strip() or not body.strip():
        raise HTTPException(status_code=400, detail="Subject and body are required")

    encoded_attachments: list[dict] = []
    for f in attachments:
        content = await f.read()
        encoded_attachments.append({
            "filename": f.filename or "attachment",
            "content": base64.b64encode(content).decode(),
            "content_type": f.content_type or "application/octet-stream",
        })
    att_arg = encoded_attachments if encoded_attachments else None

    results = await asyncio.gather(
        *[send_email(to=r, subject=subject, body=body, attachments=att_arg) for r in recipients],
        return_exceptions=True,
    )
    for exc in results:
        if isinstance(exc, ResendNotConfiguredError):
            raise HTTPException(status_code=503, detail=str(exc))
    failed = [recipients[i] for i, r in enumerate(results) if isinstance(r, Exception)]

    await activity_service.log_event(
        db=db,
        tenant_id=current_user.tenant_id,
        module="inbox",
        event_type="email.composed",
        entity_type="outbound_email",
        entity_id=None,
        contact_id=None,
        actor_id=current_user.id,
        payload={"subject": subject, "recipients": len(recipients), "failed": failed},
    )
    await db.commit()
    return {"sent": len(recipients) - len(failed), "failed": failed}


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
    """Acknowledge Resend webhook — the email poller (10 s) owns all ingestion.
    Just returning 200 prevents Resend from retrying the delivery.
    """
    return {"status": "ok"}


@webhook_router.post("/webhooks/whatsapp", status_code=status.HTTP_200_OK)
async def twilio_webhook(request: Request, db: WDB):
    """Twilio WhatsApp inbound webhook — no auth required."""
    form = await request.form()
    tenant_id = await resolve_tenant_uuid(db)
    await service.ingest_whatsapp(
        db=db,
        tenant_id=tenant_id,
        sender=str(form.get("From", "")),
        body=str(form.get("Body", "")),
        sender_name=str(form.get("ProfileName", "")) or None,
    )
    return {"status": "ok"}
