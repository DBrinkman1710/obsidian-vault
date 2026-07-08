"""Worker self-service availability endpoints.

Mounted OUTSIDE the module gate loop in main.py (like email_accounts_router) so
contract workers — who are restricted from every module by RBAC — can still reach
their own availability. Each endpoint is scoped to the calling user's own row.
"""
from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import CurrentUser
from app.database import get_db
from app.modules.booking import service
from app.modules.booking.schemas import WorkerAvailabilityOut, WorkerAvailabilityUpdate

router = APIRouter(prefix="/worker", tags=["worker"])

DB = Annotated[AsyncSession, Depends(get_db)]


@router.get("/my-availability", response_model=WorkerAvailabilityOut)
async def get_my_availability(current_user: CurrentUser, db: DB):
    return await service.get_or_create_worker_availability(
        db, current_user.tenant_id, current_user.id
    )


@router.put("/my-availability", response_model=WorkerAvailabilityOut)
async def update_my_availability(
    body: WorkerAvailabilityUpdate, current_user: CurrentUser, db: DB
):
    return await service.update_worker_availability(
        db, current_user.tenant_id, current_user.id, body
    )
