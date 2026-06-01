from __future__ import annotations

import uuid
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import CurrentUser
from app.core.tenant import resolve_tenant_uuid
from app.database import get_db
from app.modules.inbox import service, ai_scanner
from app.modules.inbox.models import DraftStatus
from app.modules.departments import service as dept_service
from app.modules.departments.schemas import DepartmentOut
from app.modules.inbox.schemas import (
    DraftReview, DraftTicketOut, DraftWithContextOut,
    LinkContactRequest, ImproveReplyRequest,
)
from pydantic import BaseModel

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
    return await service.list_drafts(db, current_user.tenant_id, status)


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


@router.post("/drafts/{draft_id}/suggest-reply")
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
    )
    return {"suggestion": suggestion}


@router.post("/drafts/{draft_id}/improve-reply")
async def improve_reply(draft_id: uuid.UUID, body: ImproveReplyRequest, current_user: CurrentUser, db: DB):
    ctx = await service.get_draft_with_context(db, current_user.tenant_id, draft_id)
    if not ctx:
        raise HTTPException(status_code=404, detail="Draft not found")
    draft = ctx["draft"]
    suggestions = await ai_scanner.generate_reply_improvements(
        current_text=body.current_text,
        context_summary=draft.context_summary,
        subject=draft.ai_suggested_subject,
    )
    return {"suggestions": suggestions}


@router.post("/drafts/{draft_id}/forward")
async def forward_draft(draft_id: uuid.UUID, body: ForwardRequest, current_user: CurrentUser, db: DB):
    draft = await service.get_draft(db, current_user.tenant_id, draft_id)
    if not draft:
        raise HTTPException(status_code=404, detail="Draft not found")
    dept = await dept_service.get_department(db, current_user.tenant_id, body.department_id)
    if not dept:
        raise HTTPException(status_code=404, detail="Department not found")

    if dept.reply_template:
        suggestion = dept.reply_template.replace("{name}", dept.name).replace("{sla}", str(dept.sla_working_days))
    else:
        suggestion = (
            f"Thank you for your message. I'm sorry to hear about your situation. "
            f"I have informed my colleagues at {dept.name} about your inquiry. "
            f"You can expect a response within {dept.sla_working_days} working days. "
            f"We apologise for any inconvenience this may cause."
        )

    draft.forwarded_to_department_id = dept.id
    draft.status = DraftStatus.forwarded
    await db.commit()
    await db.refresh(draft)
    return {"suggestion": suggestion, "department": DepartmentOut.model_validate(dept)}


@router.post("/drafts/{draft_id}/clear-followup", response_model=DraftTicketOut)
async def clear_followup(draft_id: uuid.UUID, current_user: CurrentUser, db: DB):
    draft = await service.get_draft(db, current_user.tenant_id, draft_id)
    if not draft:
        raise HTTPException(status_code=404, detail="Draft not found")
    draft.follow_up_at = None
    await db.commit()
    await db.refresh(draft)
    return draft


# --- Webhook endpoints (called by Mailgun / Twilio, no auth token) ---

@router.post("/webhooks/email", status_code=status.HTTP_200_OK)
async def mailgun_webhook(request: Request, db: DB):
    """Mailgun inbound email webhook."""
    form = await request.form()
    tenant_id = await resolve_tenant_uuid(db)
    await service.ingest_email(
        db=db,
        tenant_id=tenant_id,
        sender=str(form.get("sender", "")),
        subject=str(form.get("subject", "")) or None,
        body=str(form.get("body-plain", form.get("body-html", ""))),
        headers=str(form.get("message-headers", "")) or None,
    )
    return {"status": "ok"}


@router.post("/webhooks/whatsapp", status_code=status.HTTP_200_OK)
async def twilio_webhook(request: Request, db: DB):
    """Twilio WhatsApp inbound webhook."""
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
