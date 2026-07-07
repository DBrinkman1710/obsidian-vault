from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import CurrentUser, require_admin
from app.core.models import Tenant, User
from app.database import get_db
from app.modules.flows import service
from app.modules.flows.schemas import (
    FlowCreate,
    FlowOut,
    FlowRunOut,
    FlowUpdate,
    RecipeOut,
)
from app.modules.flows.service import FlowValidationError

router = APIRouter(prefix="/flows", tags=["flows"])
DB = Annotated[AsyncSession, Depends(get_db)]
AdminUser = Annotated[User, Depends(require_admin)]


async def _load_tenant(db: AsyncSession, tenant_id: uuid.UUID) -> Tenant:
    tenant = await db.get(Tenant, tenant_id)
    if tenant is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tenant not found")
    return tenant


@router.get("", response_model=list[FlowOut])
async def list_flows(current_user: CurrentUser, db: DB):
    return await service.list_flows(db, current_user.tenant_id)


@router.post("", response_model=FlowOut, status_code=status.HTTP_201_CREATED)
async def create_flow(body: FlowCreate, current_user: AdminUser, db: DB):
    tenant = await _load_tenant(db, current_user.tenant_id)
    try:
        return await service.create_flow(db, tenant, current_user.id, body)
    except FlowValidationError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc))


# Static paths declared before "/{flow_id}" so FastAPI does not read them as UUIDs.
@router.get("/meta")
async def get_meta(current_user: CurrentUser, db: DB):
    tenant = await _load_tenant(db, current_user.tenant_id)
    return await service.build_meta(db, tenant)


@router.get("/recipes", response_model=list[RecipeOut])
async def list_recipes(current_user: CurrentUser, db: DB):
    tenant = await _load_tenant(db, current_user.tenant_id)
    return service.list_recipes(tenant)


@router.post("/recipes/{key}/install", response_model=FlowOut, status_code=status.HTTP_201_CREATED)
async def install_recipe(key: str, current_user: AdminUser, db: DB):
    tenant = await _load_tenant(db, current_user.tenant_id)
    try:
        return await service.install_recipe(db, tenant, current_user.id, key)
    except KeyError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Recipe not found")


@router.get("/{flow_id}/runs", response_model=list[FlowRunOut])
async def list_flow_runs(
    flow_id: uuid.UUID,
    current_user: CurrentUser,
    db: DB,
    limit: int = Query(25, ge=1, le=100),
):
    flow = await service.get_flow(db, current_user.tenant_id, flow_id)
    if flow is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Flow not found")
    return await service.list_runs(db, current_user.tenant_id, flow_id, limit)


@router.patch("/{flow_id}", response_model=FlowOut)
async def update_flow(flow_id: uuid.UUID, body: FlowUpdate, current_user: AdminUser, db: DB):
    flow = await service.get_flow(db, current_user.tenant_id, flow_id)
    if flow is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Flow not found")
    tenant = await _load_tenant(db, current_user.tenant_id)
    try:
        return await service.update_flow(db, tenant, flow, body)
    except FlowValidationError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc))


@router.delete("/{flow_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_flow(flow_id: uuid.UUID, current_user: AdminUser, db: DB):
    flow = await service.get_flow(db, current_user.tenant_id, flow_id)
    if flow is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Flow not found")
    await service.delete_flow(db, flow)
