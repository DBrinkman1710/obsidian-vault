from __future__ import annotations

import uuid
from datetime import datetime
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import CurrentUser
from app.database import get_db
from app.modules.calendar import service
from app.modules.calendar.schemas import (
    CalendarEventCreate,
    CalendarEventOut,
    CalendarEventUpdate,
    CalendarItemList,
    InvitationCreate,
    InvitationOut,
    InvitationRespond,
    PendingInvitationOut,
)
from app.modules.calendar.service import TenantScopeError

router = APIRouter(prefix="/calendar", tags=["calendar"])

DB = Annotated[AsyncSession, Depends(get_db)]


@router.get("/items", response_model=CalendarItemList)
async def list_items(
    current_user: CurrentUser,
    db: DB,
    start: datetime = Query(..., description="Range start (ISO 8601, inclusive)"),
    end: datetime = Query(..., description="Range end (ISO 8601, exclusive)"),
    calendar_type: Optional[str] = Query(None, description="Filter: shared | personal | all"),
):
    if end <= start:
        raise HTTPException(status_code=400, detail="end must be after start")
    items = await service.list_calendar_items(
        db, current_user.tenant_id, start, end,
        calendar_type=calendar_type,
        user_id=current_user.id,
    )
    return CalendarItemList(items=items)


@router.post("/events", response_model=CalendarEventOut, status_code=status.HTTP_201_CREATED)
async def create_event(body: CalendarEventCreate, current_user: CurrentUser, db: DB):
    try:
        return await service.create_event(db, current_user.tenant_id, current_user.id, body)
    except TenantScopeError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("/events/{event_id}", response_model=CalendarEventOut)
async def get_event(event_id: uuid.UUID, current_user: CurrentUser, db: DB):
    event_orm = await service.get_event_orm(db, current_user.tenant_id, event_id)
    if not event_orm:
        raise HTTPException(status_code=404, detail="Event not found")
    return await service._to_event_out(db, event_orm, include_invitations=True)


@router.patch("/events/{event_id}", response_model=CalendarEventOut)
async def update_event(
    event_id: uuid.UUID, body: CalendarEventUpdate, current_user: CurrentUser, db: DB
):
    event = await service.get_event_orm(db, current_user.tenant_id, event_id)
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    try:
        return await service.update_event(db, event, body)
    except (TenantScopeError, ValueError) as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.delete("/events/{event_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_event(event_id: uuid.UUID, current_user: CurrentUser, db: DB):
    event = await service.get_event_orm(db, current_user.tenant_id, event_id)
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    await service.delete_event(db, event)


# ---------------------------------------------------------------------------
# Invitation endpoints
# ---------------------------------------------------------------------------

@router.post(
    "/events/{event_id}/invitations",
    status_code=status.HTTP_201_CREATED,
)
async def invite_users(
    event_id: uuid.UUID, body: InvitationCreate, current_user: CurrentUser, db: DB
):
    event = await service.get_event_orm(db, current_user.tenant_id, event_id)
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    if event.created_by != current_user.id:
        raise HTTPException(status_code=403, detail="Only the event organiser can invite people")
    try:
        invitations = await service.bulk_invite(
            db, current_user.tenant_id, current_user.id, event_id, body.user_ids
        )
    except LookupError as e:
        raise HTTPException(status_code=404, detail=str(e))
    return {"invited": len(invitations)}


@router.get("/events/{event_id}/invitations", response_model=list[InvitationOut])
async def get_event_invitations(event_id: uuid.UUID, current_user: CurrentUser, db: DB):
    event = await service.get_event_orm(db, current_user.tenant_id, event_id)
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    return await service.get_event_invitations(db, current_user.tenant_id, event_id)


@router.get("/invitations/pending", response_model=list[PendingInvitationOut])
async def list_pending_invitations(current_user: CurrentUser, db: DB):
    return await service.list_pending_invitations(db, current_user.id, current_user.tenant_id)


@router.get("/invitations/pending/count")
async def pending_invitation_count(current_user: CurrentUser, db: DB):
    count = await service.get_pending_invitation_count(db, current_user.id)
    return {"count": count}


@router.patch("/invitations/{inv_id}", response_model=InvitationOut)
async def respond_to_invitation(
    inv_id: uuid.UUID, body: InvitationRespond, current_user: CurrentUser, db: DB
):
    if body.status == "counter_proposed" and not body.counter_proposed_slots:
        raise HTTPException(
            status_code=400, detail="counter_proposed_slots required when counter-proposing"
        )
    try:
        inv = await service.respond_to_invitation(
            db, current_user.tenant_id, inv_id, current_user.id, body
        )
    except LookupError as e:
        raise HTTPException(status_code=404, detail=str(e))
    return inv
