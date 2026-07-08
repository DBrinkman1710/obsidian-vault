from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import AdminUser, CurrentUser
from app.database import get_db
from app.modules.booking import service
from app.modules.booking.schemas import (
    BookingTokenCreate,
    BookingTokenOut,
    CalendarSettingsOut,
    CalendarSettingsUpdate,
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
