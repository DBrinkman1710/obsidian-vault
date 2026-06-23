from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Annotated

from app.auth.dependencies import AdminUser, CurrentUser
from app.core.models import Tenant
from app.database import get_db
from app.modules.sales import service
from app.modules.sales.schemas import CommerceEventOut, SalesStatsOut

router = APIRouter(prefix="/sales", tags=["sales"])

DB = Annotated[AsyncSession, Depends(get_db)]


@router.get("/contacts/{contact_id}/events", response_model=list[CommerceEventOut])
async def get_contact_events(
    contact_id: uuid.UUID,
    current_user: CurrentUser,
    db: DB,
    limit: int = 20,
    offset: int = 0,
):
    events = await service.get_contact_events(
        db, current_user.tenant_id, contact_id, limit=limit, offset=offset
    )
    return events


@router.get("/summary", response_model=SalesStatsOut)
async def get_summary(current_user: CurrentUser, db: DB):
    return await service.get_stats(db, current_user.tenant_id)


@router.get("/token")
async def get_tracking_token(current_user: CurrentUser, db: DB) -> dict:
    """Return the tenant's JS snippet tracking token."""
    tenant = await db.get(Tenant, current_user.tenant_id)
    if tenant is None:
        raise HTTPException(status_code=404, detail="Tenant not found")
    return {"tracking_token": str(tenant.tracking_token)}


@router.post("/token/rotate")
async def rotate_tracking_token(current_user: AdminUser, db: DB) -> dict:
    """Generate a new tracking token (invalidates existing snippets)."""
    tenant = await db.get(Tenant, current_user.tenant_id)
    if tenant is None:
        raise HTTPException(status_code=404, detail="Tenant not found")
    tenant.tracking_token = uuid.uuid4()
    await db.commit()
    return {"tracking_token": str(tenant.tracking_token)}
