from __future__ import annotations

import uuid
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import AdminUser, CurrentUser
from app.database import get_db
from app.modules.activity import service as activity_service
from app.modules.tickets import service
from app.modules.tickets.models import TicketStatus
from app.modules.tickets.schemas import (
    BulkDeleteTicketsRequest,
    CommentCreate,
    CommentOut,
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
async def delete_template(template_id: uuid.UUID, current_user: CurrentUser, db: DB):
    ok = await service.delete_template(db, current_user.tenant_id, template_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Template not found")


@router.post("/templates/ai-suggest", response_model=list[TemplateOut])
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
