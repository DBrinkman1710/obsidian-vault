from __future__ import annotations

import uuid
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import AdminUser, CurrentUser
from app.database import get_db
from app.modules.activity import service
from app.modules.activity.schemas import ActivityEventOut
from typing import Annotated

router = APIRouter(prefix="/activity", tags=["activity"])
DB = Annotated[AsyncSession, Depends(get_db)]


@router.get("", response_model=list[ActivityEventOut])
async def list_activity(
    current_user: CurrentUser,
    db: DB,
    contact_id: Optional[uuid.UUID] = Query(None),
    pipeline_stage_id: Optional[uuid.UUID] = Query(None),
    actor_id: Optional[uuid.UUID] = Query(None),
    limit: int = Query(100, ge=1, le=500),
):
    return await service.list_events(
        db,
        current_user.tenant_id,
        contact_id,
        limit,
        pipeline_stage_id=pipeline_stage_id,
        actor_id=actor_id,
    )


@router.get("/stats")
async def get_stats(current_user: CurrentUser, db: DB):
    return await service.get_activity_stats(db, current_user.tenant_id)


@router.get("/kpis")
async def get_kpis(current_user: CurrentUser, db: DB):
    return await service.get_kpis(db, current_user.tenant_id)


@router.get("/agent-kpis")
async def get_agent_kpis(current_user: CurrentUser, db: DB):
    return await service.get_agent_kpis(db, current_user.tenant_id)


@router.get("/user-stats")
async def user_stats(current_user: AdminUser, db: DB, days: int = Query(7, ge=1, le=365)):
    """Per-user depth stats for the Users tab. Admin/superadmin only."""
    return await service.get_user_activity_stats(db, current_user.tenant_id, days)


@router.get("/department-stats")
async def department_stats(current_user: AdminUser, db: DB, days: int = Query(7, ge=1, le=365)):
    """Per-department rollup for the Users tab. Admin/superadmin only."""
    return await service.get_department_activity_stats(db, current_user.tenant_id, days)


@router.get("/user-sparklines")
async def user_sparklines(
    current_user: AdminUser,
    db: DB,
    user_id: uuid.UUID = Query(...),
    days: int = Query(7, ge=1, le=90),
):
    """Daily time series for one user's KPI micro charts. Admin/superadmin only."""
    return await service.get_user_sparklines(db, current_user.tenant_id, user_id, days)


@router.get("/contacts/{contact_id}", response_model=list[ActivityEventOut])
async def contact_activity(contact_id: uuid.UUID, current_user: CurrentUser, db: DB):
    return await service.list_events(db, current_user.tenant_id, contact_id)
