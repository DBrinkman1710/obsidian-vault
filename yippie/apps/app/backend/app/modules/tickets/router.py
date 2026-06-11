from __future__ import annotations

import uuid
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import AdminUser, CurrentUser
from app.database import get_db
from app.modules.tickets import service
from app.modules.tickets.models import TicketStatus
from app.modules.tickets.schemas import (
    CommentCreate,
    CommentOut,
    TemplateCreate,
    TemplateOut,
    TicketCreate,
    TicketList,
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
        return await service.create_ticket(db, current_user.tenant_id, current_user.id, body)
    except service.TenantScopeError as e:
        raise HTTPException(status_code=400, detail=str(e))


# NOTE: static /templates routes must be declared BEFORE the dynamic /{ticket_id}
# routes, otherwise "templates" is parsed as a ticket_id UUID and 422s.
@router.get("/templates", response_model=list[TemplateOut])
async def list_templates(current_user: CurrentUser, db: DB):
    return await service.list_templates(db, current_user.tenant_id)


@router.post("/templates", response_model=TemplateOut, status_code=status.HTTP_201_CREATED)
async def create_template(body: TemplateCreate, current_user: CurrentUser, db: DB):
    return await service.create_template(db, current_user.tenant_id, body)


@router.get("/deadline-count")
async def deadline_count(current_user: CurrentUser, db: DB):
    """Return count of open/in-progress tickets with sla_due_at within 24h."""
    count = await service.count_near_deadline(db, current_user.tenant_id)
    return {"count": count}


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
        return await service.update_ticket(db, ticket, body)
    except service.TenantScopeError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.patch("/{ticket_id}/status", response_model=TicketOut)
async def change_status(ticket_id: uuid.UUID, body: TicketStatusUpdate, current_user: CurrentUser, db: DB):
    ticket = await service.get_ticket_orm(db, current_user.tenant_id, ticket_id)
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    return await service.change_status(db, ticket, body.status)


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
    return await service.add_comment(db, current_user.tenant_id, ticket, current_user.id, body)
