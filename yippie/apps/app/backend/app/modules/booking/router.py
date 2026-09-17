from __future__ import annotations

import uuid
from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import AdminUser, CurrentUser
from app.database import get_db
from app.modules.booking import service
from app.modules.booking.schemas import (
    AssignRequest,
    BookingRequestOut,
    BookingTokenCreate,
    BookingTokenOut,
    CalendarSettingsOut,
    CalendarSettingsUpdate,
    DateAvailabilityOut,
    DateAvailabilityUpsert,
    WorkerAvailabilityOut,
    WorkerAvailabilityUpdate,
    WorkerSummary,
)

from app.modules.external_calendar.router import router as _ext_cal_router

router = APIRouter(prefix="/booking", tags=["booking"])
router.include_router(_ext_cal_router)

DB = Annotated[AsyncSession, Depends(get_db)]


@router.get("/settings", response_model=CalendarSettingsOut)
async def get_settings(current_user: CurrentUser, db: DB):
    return await service.get_or_create_settings(db, current_user.tenant_id)


@router.patch("/settings", response_model=CalendarSettingsOut)
async def update_settings(body: CalendarSettingsUpdate, current_user: AdminUser, db: DB):
    return await service.update_settings(db, current_user.tenant_id, body)


# --------------------------------------------------------------------------- #
# Shared (tenant-wide) date-specific availability overrides.
# Reads allowed for any booking access; writes require booking `full` — enforced
# by the check_module_access("booking") gate this router is mounted under (it
# blocks non-GET for view-only and 403s restricted; admins bypass). So a plain
# CurrentUser is correct here: it lets any full-access user manage the schedule,
# not just admins.
# --------------------------------------------------------------------------- #
@router.get("/availability/exceptions", response_model=list[DateAvailabilityOut])
async def list_availability_exceptions(
    current_user: CurrentUser,
    db: DB,
    start: date = Query(..., description="Range start (inclusive, YYYY-MM-DD)"),
    end: date = Query(..., description="Range end (inclusive, YYYY-MM-DD)"),
):
    return await service.list_calendar_exceptions(db, current_user.tenant_id, start, end)


@router.put("/availability/exceptions/{day}", response_model=DateAvailabilityOut)
async def upsert_availability_exception(
    day: date, body: DateAvailabilityUpsert, current_user: CurrentUser, db: DB
):
    return await service.upsert_calendar_exception(
        db, current_user.tenant_id, day, body.slots
    )


@router.delete(
    "/availability/exceptions/{day}", status_code=status.HTTP_204_NO_CONTENT
)
async def delete_availability_exception(day: date, current_user: CurrentUser, db: DB):
    await service.delete_calendar_exception(db, current_user.tenant_id, day)


@router.post("/send", status_code=status.HTTP_201_CREATED)
async def send_booking(body: BookingTokenCreate, current_user: CurrentUser, db: DB):
    try:
        token = await service.create_booking_token(
            db, current_user.tenant_id, current_user.id, body
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    return {"token_id": str(token.id)}


@router.get("/tokens", response_model=list[BookingTokenOut])
async def list_tokens(current_user: CurrentUser, db: DB):
    return await service.list_tokens(db, current_user.tenant_id)


@router.delete("/tokens/{token_id}", status_code=status.HTTP_204_NO_CONTENT)
async def revoke_token(token_id: uuid.UUID, current_user: CurrentUser, db: DB):
    ok = await service.revoke_token(db, current_user.tenant_id, token_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Booking token not found")


# --------------------------------------------------------------------------- #
# Worker availability — admin management (Teams page)
# --------------------------------------------------------------------------- #
@router.get("/workers", response_model=list[WorkerSummary])
async def list_workers(current_user: AdminUser, db: DB):
    return await service.list_workers(db, current_user.tenant_id)


@router.get("/workers/{user_id}/availability", response_model=WorkerAvailabilityOut)
async def get_worker_availability(user_id: uuid.UUID, current_user: AdminUser, db: DB):
    return await service.get_or_create_worker_availability(
        db, current_user.tenant_id, user_id
    )


@router.put("/workers/{user_id}/availability", response_model=WorkerAvailabilityOut)
async def update_worker_availability(
    user_id: uuid.UUID, body: WorkerAvailabilityUpdate, current_user: AdminUser, db: DB
):
    return await service.update_worker_availability(
        db, current_user.tenant_id, user_id, body
    )


# --------------------------------------------------------------------------- #
# Customer requested bookings — admin dispatcher (Calendar page Requests tab)
# --------------------------------------------------------------------------- #
@router.get("/requests", response_model=list[BookingRequestOut])
async def list_requests(current_user: AdminUser, db: DB):
    return await service.list_requests_admin(db, current_user.tenant_id)


@router.post("/requests/{request_id}/assign", status_code=201)
async def assign_request(request_id: uuid.UUID, body: AssignRequest, current_user: AdminUser, db: DB):
    try:
        event = await service.assign_request(
            db, current_user.tenant_id, request_id, body.worker_user_id,
            body.slot_start, body.slot_end, actor_id=current_user.id,
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(e))
    return {"event_id": str(event.id)}


@router.post("/requests/{request_id}/decline", status_code=status.HTTP_204_NO_CONTENT)
async def decline_request(request_id: uuid.UUID, current_user: AdminUser, db: DB):
    ok = await service.decline_request(db, current_user.tenant_id, request_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Request not found")
