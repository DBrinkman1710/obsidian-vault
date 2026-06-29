from __future__ import annotations

import base64
import uuid
from typing import Annotated, List, Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import AdminUser, CurrentUser, require_module
from app.database import get_db
from app.modules.activity import service as activity_service
from app.modules.tickets import service
from app.modules.tickets.models import TicketStatus
from app.modules.tickets.schemas import (
    BriefingOut,
    BulkDeleteTicketsRequest,
    CommentCreate,
    CommentOut,
    ContactHistoryItem,
    ImproveReplyOut,
    ImproveReplyRequest,
    SuggestReplyOut,
    TemplateCreate,
    TemplateUpdate,
    TemplateOut,
    TemplateSuggestRequest,
    TicketCreate,
    TicketList,
    TicketMergeRequest,
    TicketOut,
    TicketStatusUpdate,
    TicketUpdate,
)

router = APIRouter(prefix="/tickets", tags=["tickets"])
DB = Annotated[AsyncSession, Depends(get_db)]


async def _detect_language(text: str) -> str:
    """Return ISO 639-1 code for text, defaulting to 'en'."""
    from app.modules.ai.client import ai_completion
    result = await ai_completion(
        [{"role": "user", "content": f"Detect the language of this text and return ONLY its ISO 639-1 code (e.g. en, nl, fr):\n\n{text[:300]}"}],
        max_tokens=5,
    )
    detected = result.strip().lower()[:2]
    return detected if (detected.isalpha() and len(detected) == 2) else "en"


@router.get("", response_model=TicketList)
async def list_tickets(
    current_user: CurrentUser,
    db: DB,
    status: Optional[TicketStatus] = Query(None),
    assigned_to: Optional[uuid.UUID] = Query(None),
    contact_id: Optional[uuid.UUID] = Query(None),
    department_id: Optional[uuid.UUID] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
):
    items, total = await service.list_tickets(
        db, current_user.tenant_id, status, assigned_to, contact_id, department_id, skip, limit
    )
    return TicketList(items=items, total=total)


@router.post("", response_model=TicketOut, status_code=status.HTTP_201_CREATED)
async def create_ticket(body: TicketCreate, current_user: CurrentUser, db: DB):
    try:
        ticket = await service.create_ticket(db, current_user.tenant_id, current_user.id, body)
    except service.TenantScopeError as e:
        raise HTTPException(status_code=400, detail=str(e))
    await activity_service.log_event(
        db, current_user.tenant_id,
        module="tickets", event_type="ticket_created", entity_type="ticket",
        entity_id=ticket.id, contact_id=ticket.contact_id, actor_id=current_user.id,
        payload={"subject": ticket.subject, "priority": ticket.priority.value if hasattr(ticket.priority, "value") else ticket.priority},
    )
    await db.commit()
    return ticket


# NOTE: static /templates routes must be declared BEFORE the dynamic /{ticket_id}
# routes, otherwise "templates" is parsed as a ticket_id UUID and 422s.
@router.get("/templates", response_model=list[TemplateOut])
async def list_templates(current_user: CurrentUser, db: DB):
    return await service.list_templates(db, current_user.tenant_id)


@router.post("/templates", response_model=TemplateOut, status_code=status.HTTP_201_CREATED)
async def create_template(body: TemplateCreate, current_user: CurrentUser, db: DB):
    return await service.create_template(db, current_user.tenant_id, body)


@router.patch("/templates/{template_id}", response_model=TemplateOut)
async def update_template(template_id: uuid.UUID, body: TemplateUpdate, current_user: CurrentUser, db: DB):
    template = await service.update_template(db, current_user.tenant_id, template_id, body)
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    return template


@router.delete("/templates/{template_id}", status_code=204)
async def delete_template(template_id: uuid.UUID, current_user: AdminUser, db: DB):
    ok = await service.delete_template(db, current_user.tenant_id, template_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Template not found")


@router.post("/templates/ai-suggest", response_model=list[TemplateOut], dependencies=[Depends(require_module("ai"))])
async def ai_suggest_templates(body: TemplateSuggestRequest, current_user: CurrentUser, db: DB):
    return await service.suggest_templates(db, current_user.tenant_id, body.context)


@router.get("/deadline-count")
async def deadline_count(current_user: CurrentUser, db: DB):
    """Return the deadline indicator for the Tickets nav: a severity bucket
    (red = overdue/today/tomorrow, orange = due within the orange window) plus
    counts. Thresholds are per-tenant (Settings → Departments)."""
    from app.core.models import Tenant

    tenant = await db.get(Tenant, current_user.tenant_id)
    red_days = tenant.deadline_red_days if tenant else 1
    orange_days = tenant.deadline_orange_days if tenant else 2
    return await service.deadline_severity(db, current_user.tenant_id, red_days, orange_days)


@router.get("/{ticket_id}", response_model=TicketOut)
async def get_ticket(ticket_id: uuid.UUID, current_user: CurrentUser, db: DB):
    ticket = await service.get_ticket(db, current_user.tenant_id, ticket_id)
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    return ticket


@router.patch("/{ticket_id}", response_model=TicketOut)
async def update_ticket(ticket_id: uuid.UUID, body: TicketUpdate, current_user: CurrentUser, db: DB):
    ticket = await service.get_ticket_orm(db, current_user.tenant_id, ticket_id)
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    try:
        updated = await service.update_ticket(db, ticket, body)
    except service.TenantScopeError as e:
        raise HTTPException(status_code=400, detail=str(e))
    fields = body.model_dump(exclude_unset=True)
    if "assigned_to" in fields:
        await activity_service.log_event(
            db, current_user.tenant_id,
            module="tickets", event_type="ticket_assigned", entity_type="ticket",
            entity_id=updated.id, contact_id=updated.contact_id, actor_id=current_user.id,
            payload={"assigned_to": str(fields["assigned_to"]) if fields["assigned_to"] else None},
        )
        await db.commit()
    return updated


@router.patch("/{ticket_id}/status", response_model=TicketOut)
async def change_status(ticket_id: uuid.UUID, body: TicketStatusUpdate, current_user: CurrentUser, db: DB):
    ticket = await service.get_ticket_orm(db, current_user.tenant_id, ticket_id)
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    updated = await service.change_status(db, ticket, body.status)
    await activity_service.log_event(
        db, current_user.tenant_id,
        module="tickets", event_type="ticket_status_changed", entity_type="ticket",
        entity_id=updated.id, contact_id=updated.contact_id, actor_id=current_user.id,
        payload={"status": body.status.value},
    )
    await db.commit()
    return updated


@router.post("/{ticket_id}/merge", response_model=TicketOut)
async def merge_ticket(
    ticket_id: uuid.UUID, body: TicketMergeRequest, current_user: CurrentUser, db: DB
):
    """Merge the secondary ticket INTO this (primary) ticket. Both must belong
    to the caller's tenant and the same contact."""
    primary = await service.get_ticket_orm(db, current_user.tenant_id, ticket_id)
    if not primary:
        raise HTTPException(status_code=404, detail="Ticket not found")
    try:
        merged = await service.merge_tickets(
            db, current_user.tenant_id, primary, body.secondary_ticket_id, current_user.id
        )
    except service.MergeError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return merged


@router.post("/{ticket_id}/snooze", response_model=TicketOut)
async def snooze_ticket(ticket_id: uuid.UUID, current_user: CurrentUser, db: DB):
    ticket = await service.get_ticket_orm(db, current_user.tenant_id, ticket_id)
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    return await service.snooze_ticket(db, ticket)


@router.delete("/bulk", status_code=status.HTTP_200_OK)
async def bulk_delete_tickets(body: BulkDeleteTicketsRequest, current_user: AdminUser, db: DB):
    deleted = 0
    for ticket_id in body.ids:
        ticket = await service.get_ticket_orm(db, current_user.tenant_id, ticket_id)
        if ticket:
            await service.soft_delete_ticket(db, ticket)
            deleted += 1
    return {"deleted": deleted}


@router.post("/{ticket_id}/delete", status_code=status.HTTP_200_OK)
async def delete_ticket(ticket_id: uuid.UUID, current_user: AdminUser, db: DB):
    """Soft-delete a ticket (admin+ only) — history is preserved but it
    disappears from all views."""
    ticket = await service.get_ticket_orm(db, current_user.tenant_id, ticket_id)
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    await service.soft_delete_ticket(db, ticket)
    return {"deleted": True}


@router.get("/{ticket_id}/comments", response_model=list[CommentOut])
async def list_comments(ticket_id: uuid.UUID, current_user: CurrentUser, db: DB):
    ticket = await service.get_ticket_orm(db, current_user.tenant_id, ticket_id)
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    return await service.list_comments(db, current_user.tenant_id, ticket_id)


@router.post("/{ticket_id}/comments", response_model=CommentOut, status_code=status.HTTP_201_CREATED)
async def add_comment(ticket_id: uuid.UUID, body: CommentCreate, current_user: CurrentUser, db: DB):
    ticket = await service.get_ticket_orm(db, current_user.tenant_id, ticket_id)
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    comment = await service.add_comment(db, current_user.tenant_id, ticket, current_user.id, body)
    await activity_service.log_event(
        db, current_user.tenant_id,
        module="tickets", event_type="ticket_commented", entity_type="ticket",
        entity_id=ticket.id, contact_id=ticket.contact_id, actor_id=current_user.id,
        payload={"preview": body.body[:100]},
    )
    await db.commit()
    return comment


@router.post("/{ticket_id}/send-reply", status_code=status.HTTP_200_OK)
async def send_ticket_reply(
    ticket_id: uuid.UUID,
    current_user: CurrentUser,
    db: DB,
    subject: Optional[str] = Form(None),
    body: str = Form(...),
    html_body: Optional[str] = Form(None),
    attachments: List[UploadFile] = File(default=[]),
):
    """Send an email reply to the ticket's linked contact and save it as a comment."""
    from app.modules.contacts.models import Contact
    from app.core.mailer import send_email, ResendNotConfiguredError
    from app.core.email_html import render_email_html
    from app.config import get_settings
    from app.modules.tickets.models import MessageSource

    ticket = await service.get_ticket_orm(db, current_user.tenant_id, ticket_id)
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    if not ticket.contact_id:
        raise HTTPException(status_code=400, detail="Ticket has no linked contact")

    contact = await db.get(Contact, ticket.contact_id)
    if not contact or not contact.email:
        raise HTTPException(status_code=400, detail="Contact has no email address")

    settings = get_settings()
    from_email = current_user.reply_from_email or settings.resend_from or None
    final_subject = (subject or f"Re: {ticket.subject}").strip()
    plain_body = body.strip()

    # Encode attachments
    encoded_attachments: list[dict] = []
    total_bytes = 0
    MAX_FILE = 10 * 1024 * 1024
    MAX_TOTAL = 25 * 1024 * 1024
    for f in attachments:
        content = await f.read()
        total_bytes += len(content)
        if len(content) > MAX_FILE:
            raise HTTPException(status_code=413, detail=f"Attachment '{f.filename}' exceeds 10 MB")
        if total_bytes > MAX_TOTAL:
            raise HTTPException(status_code=413, detail="Attachments exceed 25 MB total")
        encoded_attachments.append({
            "filename": f.filename or "attachment",
            "content": base64.b64encode(content).decode(),
            "content_type": f.content_type or "application/octet-stream",
        })

    rendered_html = render_email_html(html_body or plain_body)

    try:
        resend_id = await send_email(
            to=contact.email,
            subject=final_subject,
            body=plain_body,
            html=rendered_html,
            from_email=from_email,
            reply_to=from_email,
            attachments=encoded_attachments or None,
        )
    except ResendNotConfiguredError:
        raise HTTPException(status_code=503, detail="Email sending is not configured (RESEND_API_KEY missing)")
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Email provider error: {exc}")

    from app.modules.emailtracking.service import create_outbound_email
    await create_outbound_email(
        db,
        tenant_id=current_user.tenant_id,
        resend_email_id=resend_id,
        to_email=contact.email,
        subject=final_subject,
        body=plain_body,
        actor_id=current_user.id,
        contact_id=ticket.contact_id,
        kind="ticket_reply",
    )

    comment_data = CommentCreate(body=plain_body, is_internal=False)
    comment = await service.add_comment(
        db, current_user.tenant_id, ticket, current_user.id, comment_data,
        source=MessageSource.email,
    )
    await activity_service.log_event(
        db, current_user.tenant_id,
        module="tickets", event_type="ticket_replied", entity_type="ticket",
        entity_id=ticket.id, contact_id=ticket.contact_id, actor_id=current_user.id,
        payload={"to": contact.email, "subject": final_subject},
    )
    await db.commit()

    return {"sent": True, "to": contact.email, "comment_id": str(comment.id)}


@router.post("/{ticket_id}/briefing", response_model=BriefingOut, dependencies=[Depends(require_module("ai"))])
async def get_ticket_briefing(ticket_id: uuid.UUID, current_user: CurrentUser, db: DB):
    """AI customer briefing card: summary + 2-3 suggested actions."""
    from sqlalchemy import select
    from app.modules.contacts.models import Contact
    from app.modules.tickets.models import Ticket, TicketComment
    from app.modules.departments.models import Department
    from app.modules.pipeline.models import PipelineStage
    from app.modules.inbox.ai_scanner import generate_context_summary, _parse_json
    from app.modules.ai.client import ai_completion

    ticket = await service.get_ticket_orm(db, current_user.tenant_id, ticket_id)
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")

    contact = await db.get(Contact, ticket.contact_id) if ticket.contact_id else None
    contact_dict: Optional[dict] = None
    if contact:
        contact_dict = {
            "full_name": contact.full_name,
            "company": getattr(contact, "company", None),
            "email": getattr(contact, "email", None),
            "phone": getattr(contact, "phone", None),
            "tags": getattr(contact, "tags", []) or [],
            "notes": getattr(contact, "notes", None),
        }

    # Last 5 tickets for this contact (excluding current)
    recent_tickets: list[dict] = []
    if ticket.contact_id:
        q = (
            select(Ticket)
            .where(Ticket.tenant_id == current_user.tenant_id)
            .where(Ticket.contact_id == ticket.contact_id)
            .where(Ticket.id != ticket.id)
            .where(Ticket.deleted_at.is_(None))
            .order_by(Ticket.created_at.desc())
            .limit(5)
        )
        result = await db.execute(q)
        for t in result.scalars().all():
            recent_tickets.append({
                "status": t.status.value if hasattr(t.status, "value") else t.status,
                "subject": t.subject,
                "priority": t.priority.value if hasattr(t.priority, "value") else t.priority,
            })

    # Build raw body from description + most recent non-internal email comment
    raw_body = ticket.description or ""
    q_comment = (
        select(TicketComment)
        .where(TicketComment.ticket_id == ticket.id)
        .where(TicketComment.is_internal.is_(False))
        .order_by(TicketComment.created_at.desc())
        .limit(1)
    )
    result_comment = await db.execute(q_comment)
    last_comment = result_comment.scalars().first()
    if last_comment:
        raw_body = last_comment.body

    sender = contact.email if contact and getattr(contact, "email", None) else (contact.full_name if contact else "Unknown")
    summary = await generate_context_summary(sender, raw_body, contact_dict, recent_tickets, None)

    # Load departments and pipeline stages for suggested action validation
    dept_result = await db.execute(
        select(Department).where(Department.tenant_id == current_user.tenant_id)
    )
    departments = dept_result.scalars().all()
    dept_names = [d.name for d in departments]

    stage_result = await db.execute(
        select(PipelineStage).where(PipelineStage.tenant_id == current_user.tenant_id)
    )
    pipeline_stages = stage_result.scalars().all()
    stage_names = [s.name for s in pipeline_stages]

    current_status = ticket.status.value if hasattr(ticket.status, "value") else ticket.status
    status_options = [s.value for s in TicketStatus]

    action_prompt = f"""You are a customer service workflow assistant. Based on the ticket context below, suggest 2-3 concrete next actions an agent should take. Choose ONLY from the allowed action types and values.

Ticket subject: {ticket.subject}
Current status: {current_status}
Customer summary: {summary}

Allowed action types and values:
- set_status: one of {status_options}
- assign_department: one of {dept_names or ['(none available)']}
- move_pipeline_stage: one of {stage_names or ['(none available)']}

Return ONLY a JSON array of 2-3 objects (no text before or after):
[{{"action": "set_status"|"assign_department"|"move_pipeline_stage", "value": "<exact value from the allowed list>", "label": "<short human-readable chip label, e.g. Mark as resolved>"}}]

Only suggest actions that make sense given the current state. Skip set_status if already resolved. Only include assign_department or move_pipeline_stage if there are available options."""

    action_text = await ai_completion([{"role": "user", "content": action_prompt}], max_tokens=400)
    actions_raw = _parse_json(action_text, fallback=[])
    suggested_actions = []
    if isinstance(actions_raw, list):
        for a in actions_raw[:3]:
            if isinstance(a, dict) and a.get("action") and a.get("value") and a.get("label"):
                suggested_actions.append({"action": a["action"], "value": a["value"], "label": a["label"]})

    return BriefingOut(summary=summary, suggested_actions=suggested_actions)


@router.post("/{ticket_id}/suggest-reply", response_model=SuggestReplyOut, dependencies=[Depends(require_module("ai"))])
async def suggest_ticket_reply(ticket_id: uuid.UUID, current_user: CurrentUser, db: DB):
    """AI-generate a full reply draft for this ticket."""
    from sqlalchemy import select
    from app.modules.contacts.models import Contact
    from app.modules.tickets.models import TicketComment, MessageSource
    from app.modules.inbox.ai_scanner import generate_context_summary, generate_reply_draft

    ticket = await service.get_ticket_orm(db, current_user.tenant_id, ticket_id)
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")

    contact = await db.get(Contact, ticket.contact_id) if ticket.contact_id else None
    contact_name = contact.full_name if contact else None

    # Detect language from most recent email comment
    q = (
        select(TicketComment)
        .where(TicketComment.ticket_id == ticket.id)
        .where(TicketComment.is_internal.is_(False))
        .where(TicketComment.source == MessageSource.email)
        .order_by(TicketComment.created_at.desc())
        .limit(1)
    )
    result = await db.execute(q)
    last_email = result.scalars().first()

    # Build context summary inline
    contact_dict = None
    if contact:
        contact_dict = {
            "full_name": contact.full_name,
            "company": getattr(contact, "company", None),
            "email": getattr(contact, "email", None),
            "phone": getattr(contact, "phone", None),
            "tags": getattr(contact, "tags", []) or [],
            "notes": getattr(contact, "notes", None),
        }
    raw_body = (last_email.body if last_email else None) or ticket.description or ""
    sender = getattr(contact, "email", None) or (contact.full_name if contact else "Unknown") if contact else "Unknown"
    context_summary = await generate_context_summary(sender, raw_body, contact_dict, [], None)

    language = await _detect_language(last_email.body) if last_email else "en"

    suggestion = await generate_reply_draft(
        subject=ticket.subject,
        description=ticket.description or "",
        context_summary=context_summary,
        contact_name=contact_name,
        language=language,
    )
    return {"suggestion": suggestion}


@router.post("/{ticket_id}/improve-reply", response_model=ImproveReplyOut, dependencies=[Depends(require_module("ai"))])
async def improve_ticket_reply(ticket_id: uuid.UUID, body: ImproveReplyRequest, current_user: CurrentUser, db: DB):
    """AI-rewrite the agent's current reply with labelled variants."""
    from sqlalchemy import select
    from app.modules.contacts.models import Contact
    from app.modules.tickets.models import TicketComment, MessageSource
    from app.modules.inbox.ai_scanner import generate_context_summary, generate_reply_improvements

    ticket = await service.get_ticket_orm(db, current_user.tenant_id, ticket_id)
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")

    contact = await db.get(Contact, ticket.contact_id) if ticket.contact_id else None

    q = (
        select(TicketComment)
        .where(TicketComment.ticket_id == ticket.id)
        .where(TicketComment.is_internal.is_(False))
        .where(TicketComment.source == MessageSource.email)
        .order_by(TicketComment.created_at.desc())
        .limit(1)
    )
    result = await db.execute(q)
    last_email = result.scalars().first()

    contact_dict = None
    if contact:
        contact_dict = {
            "full_name": contact.full_name,
            "company": getattr(contact, "company", None),
            "email": getattr(contact, "email", None),
            "phone": getattr(contact, "phone", None),
            "tags": getattr(contact, "tags", []) or [],
            "notes": getattr(contact, "notes", None),
        }
    raw_body = (last_email.body if last_email else None) or ticket.description or ""
    sender = getattr(contact, "email", None) or (contact.full_name if contact else "Unknown") if contact else "Unknown"
    context_summary = await generate_context_summary(sender, raw_body, contact_dict, [], None)

    language = await _detect_language(last_email.body) if last_email else "en"

    suggestions = await generate_reply_improvements(
        current_text=body.current_text,
        context_summary=context_summary,
        subject=ticket.subject,
        language=language,
    )
    return {"suggestions": suggestions}


@router.get("/{ticket_id}/contact-history", response_model=list[ContactHistoryItem])
async def get_contact_history(
    ticket_id: uuid.UUID,
    current_user: CurrentUser,
    db: DB,
    limit: int = Query(5, ge=1, le=20),
):
    """Last N touchpoints with this ticket's contact across all history."""
    from sqlalchemy import select, union_all, literal, String, cast
    from app.modules.tickets.models import Ticket, TicketComment
    from app.modules.emailtracking.models import OutboundEmail
    from app.modules.chat.models import ChatSession, ChatMessage

    ticket = await service.get_ticket_orm(db, current_user.tenant_id, ticket_id)
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")

    if not ticket.contact_id:
        return []

    contact_id = ticket.contact_id
    items: list[dict] = []

    # 1. Comments on other tickets for this contact
    q_comments = (
        select(TicketComment, Ticket.subject.label("ticket_subject"))
        .join(Ticket, Ticket.id == TicketComment.ticket_id)
        .where(Ticket.tenant_id == current_user.tenant_id)
        .where(Ticket.contact_id == contact_id)
        .where(TicketComment.ticket_id != ticket.id)
        .where(Ticket.deleted_at.is_(None))
        .order_by(TicketComment.created_at.desc())
        .limit(limit * 2)
    )
    res = await db.execute(q_comments)
    for row in res.all():
        comment = row[0]
        ticket_subject = row[1]
        kind = "internal_note" if comment.is_internal else "email"
        items.append({
            "kind": kind,
            "id": comment.id,
            "subject": ticket_subject,
            "preview": comment.body[:300],
            "created_at": comment.created_at,
            "ticket_id": comment.ticket_id,
            "session_id": None,
        })

    # 2. Outbound emails to this contact
    q_outbound = (
        select(OutboundEmail)
        .where(OutboundEmail.tenant_id == current_user.tenant_id)
        .where(OutboundEmail.contact_id == contact_id)
        .order_by(OutboundEmail.created_at.desc())
        .limit(limit)
    )
    res = await db.execute(q_outbound)
    for email in res.scalars().all():
        items.append({
            "kind": "outbound_email",
            "id": email.id,
            "subject": email.subject,
            "preview": (email.body or "")[:300],
            "created_at": email.created_at,
            "ticket_id": None,
            "session_id": None,
        })

    # 3. Resolved chat sessions
    q_sessions = (
        select(ChatSession)
        .where(ChatSession.tenant_id == current_user.tenant_id)
        .where(ChatSession.contact_id == contact_id)
        .where(ChatSession.status != "open")
        .order_by(ChatSession.started_at.desc())
        .limit(limit)
    )
    res = await db.execute(q_sessions)
    sessions = res.scalars().all()

    # Batch-fetch last message per session (fixes N+1)
    session_ids = [sess.id for sess in sessions]
    if session_ids:
        from sqlalchemy import func
        latest_msg_subq = (
            select(
                ChatMessage.session_id,
                func.max(ChatMessage.created_at).label("max_ts"),
            )
            .where(ChatMessage.session_id.in_(session_ids))
            .where(ChatMessage.tenant_id == current_user.tenant_id)
            .group_by(ChatMessage.session_id)
            .subquery()
        )
        last_msgs_q = (
            select(ChatMessage)
            .join(
                latest_msg_subq,
                (ChatMessage.session_id == latest_msg_subq.c.session_id)
                & (ChatMessage.created_at == latest_msg_subq.c.max_ts),
            )
        )
        last_msgs_res = await db.execute(last_msgs_q)
        last_msg_by_session: dict = {m.session_id: m for m in last_msgs_res.scalars().all()}
    else:
        last_msg_by_session = {}

    for sess in sessions:
        last_msg = last_msg_by_session.get(sess.id)
        items.append({
            "kind": "chat",
            "id": sess.id,
            "subject": None,
            "preview": last_msg.body[:300] if last_msg else "",
            "created_at": sess.started_at,
            "ticket_id": None,
            "session_id": sess.id,
        })

    # Sort merged list by created_at desc, return top N
    items.sort(key=lambda x: x["created_at"], reverse=True)
    return [ContactHistoryItem(**item) for item in items[:limit]]
