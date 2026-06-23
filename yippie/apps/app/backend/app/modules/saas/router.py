from __future__ import annotations

import uuid
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import CurrentUser
from app.core.models import Tenant
from app.database import get_db
from app.modules.saas import service
from app.modules.saas.schemas import HealthSummaryOut, SaasEventOut, SaasHealthOut

router = APIRouter(prefix="/saas", tags=["saas"])

DB = Annotated[AsyncSession, Depends(get_db)]


@router.get("/contacts/{contact_id}/events", response_model=list[SaasEventOut])
async def get_contact_events(
    contact_id: uuid.UUID,
    current_user: CurrentUser,
    db: DB,
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    event_type: Optional[str] = None,
):
    events = await service.get_contact_events(
        db, current_user.tenant_id, contact_id, domain="saas", limit=limit, offset=offset
    )
    if event_type:
        events = [e for e in events if e.event_type == event_type]
    return events


@router.get("/contacts/{contact_id}/health", response_model=SaasHealthOut)
async def get_contact_health(
    contact_id: uuid.UUID,
    current_user: CurrentUser,
    db: DB,
):
    health = await service.get_contact_health(db, current_user.tenant_id, contact_id)
    if health is None:
        raise HTTPException(status_code=404, detail="No health data for this contact")
    return health


@router.get("/health/summary", response_model=HealthSummaryOut)
async def get_health_summary(current_user: CurrentUser, db: DB):
    return await service.get_health_summary(db, current_user.tenant_id)


@router.get("/token")
async def get_tracking_token(current_user: CurrentUser, db: DB) -> dict:
    """Return the tenant's JS snippet tracking token (same token as /sales/token)."""
    tenant = await db.get(Tenant, current_user.tenant_id)
    if tenant is None:
        raise HTTPException(status_code=404, detail="Tenant not found")
    return {"tracking_token": str(tenant.tracking_token)}
