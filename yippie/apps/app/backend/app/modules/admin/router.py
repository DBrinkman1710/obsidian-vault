from __future__ import annotations

import uuid
from typing import Annotated

import httpx
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import SuperAdminUser
from app.config import get_settings
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


@router.post("/tenants/{tenant_id}/users", response_model=schemas.TenantUserOut, status_code=status.HTTP_201_CREATED)
async def add_tenant_user(_: SuperAdminUser, db: DB, tenant_id: uuid.UUID, data: schemas.AddAdminRequest):
    try:
        user = await service.add_tenant_user(db, tenant_id, data)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(e))
    if user is None:
        raise HTTPException(status_code=404, detail="Tenant not found")
    return user


@router.post("/promote-superadmin", response_model=schemas.TenantUserOut)
async def promote_superadmin(current_user: SuperAdminUser, db: DB, data: schemas.PromoteSuperadminRequest):
    try:
        user = await service.promote_superadmin(db, current_user, data.target_email, data.current_password)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))
    except LookupError as e:
        raise HTTPException(status_code=404, detail=str(e))
    return user


@router.get("/resend-check")
async def resend_check(_: SuperAdminUser):
    """Diagnostic: shows exactly what the Resend receiving API returns for the most recent email."""
    settings = get_settings()
    if not settings.resend_api_key:
        return {"error": "RESEND_API_KEY not set"}

    auth = {"Authorization": f"Bearer {settings.resend_api_key}"}
    result: dict = {}

    async with httpx.AsyncClient(timeout=15) as client:
        list_resp = await client.get(
            "https://api.resend.com/emails/receiving",
            headers=auth,
            params={"limit": 3},
        )
        result["list_status"] = list_resp.status_code
        result["list_body"] = list_resp.json() if list_resp.status_code == 200 else list_resp.text

        if list_resp.status_code == 200:
            emails = list_resp.json().get("data", [])
            if emails:
                first_id = emails[0]["id"]
                body_resp = await client.get(
                    f"https://api.resend.com/emails/receiving/{first_id}",
                    headers=auth,
                )
                result["detail_status"] = body_resp.status_code
                result["detail_body"] = body_resp.json() if body_resp.status_code == 200 else body_resp.text
            else:
                result["detail_body"] = "no emails in list"

    return result
