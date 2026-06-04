from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import SuperAdminUser
from app.database import get_db
from app.modules.admin import schemas, service

router = APIRouter(prefix="/admin", tags=["admin"])

DB = Annotated[AsyncSession, Depends(get_db)]


@router.get("/tenants", response_model=list[schemas.TenantOut])
async def list_tenants(_: SuperAdminUser, db: DB):
    return await service.list_tenants(db)


@router.post("/tenants", response_model=schemas.TenantOut, status_code=status.HTTP_201_CREATED)
async def create_tenant(_: SuperAdminUser, db: DB, data: schemas.TenantCreate):
    try:
        return await service.create_tenant(db, data)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(e))


@router.patch("/tenants/{tenant_id}", response_model=schemas.TenantOut)
async def update_tenant(_: SuperAdminUser, db: DB, tenant_id: uuid.UUID, data: schemas.TenantUpdate):
    tenant = await service.update_tenant(db, tenant_id, data)
    if tenant is None:
        raise HTTPException(status_code=404, detail="Tenant not found")
    return tenant


@router.get("/tenants/{tenant_id}/users", response_model=list[schemas.TenantUserOut])
async def get_tenant_users(_: SuperAdminUser, db: DB, tenant_id: uuid.UUID):
    return await service.get_tenant_users(db, tenant_id)
