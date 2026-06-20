from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import AdminUser, CurrentUser
from app.database import get_db
from app.modules.rbac import service

DB = Annotated[AsyncSession, Depends(get_db)]
from app.modules.rbac.schemas import (
    MyPermissionsOut,
    PermissionsMatrixOut,
    PermissionsMatrixUpsert,
    RbacRoleCreate,
    RbacRoleOut,
    UserRbacRoleOut,
)

router = APIRouter(prefix="/rbac", tags=["rbac"])


@router.post("/provision-defaults", status_code=204)
async def provision_defaults(current_user: AdminUser, db: DB):
    """Seed the default Agent + Viewer roles for this tenant (idempotent)."""
    await service.provision_default_rbac_roles(db, current_user.tenant_id)
    await db.commit()


@router.get("/my-permissions", response_model=MyPermissionsOut)
async def my_permissions(current_user: CurrentUser, db: DB):
    perms = await service.get_my_permissions(db, current_user)
    return MyPermissionsOut(permissions=perms)


# ---------------------------------------------------------------------------
# Roles
# ---------------------------------------------------------------------------

@router.get("/roles", response_model=list[RbacRoleOut])
async def list_roles(current_user: AdminUser, db: DB):
    return await service.list_roles(db, current_user.tenant_id)


@router.post("/roles", response_model=RbacRoleOut, status_code=201)
async def create_role(body: RbacRoleCreate, current_user: AdminUser, db: DB):
    if not body.name.strip():
        raise HTTPException(400, "Role name is required")
    role = await service.create_role(db, current_user.tenant_id, body.name)
    await db.commit()
    return role


@router.delete("/roles/{role_id}", status_code=204)
async def delete_role(role_id: uuid.UUID, current_user: AdminUser, db: DB):
    deleted = await service.delete_role(db, current_user.tenant_id, role_id)
    if not deleted:
        raise HTTPException(404, "Role not found")
    await db.commit()


# ---------------------------------------------------------------------------
# User ↔ RBAC Role assignments
# ---------------------------------------------------------------------------

@router.get("/users/{user_id}/roles", response_model=list[UserRbacRoleOut])
async def list_user_rbac_roles(user_id: uuid.UUID, current_user: AdminUser, db: DB):
    return await service.list_user_rbac_roles(db, current_user.tenant_id, user_id)


@router.post("/users/{user_id}/roles/{role_id}", status_code=201)
async def assign_user_rbac_role(user_id: uuid.UUID, role_id: uuid.UUID, current_user: AdminUser, db: DB):
    link = await service.assign_user_rbac_role(db, current_user.tenant_id, user_id, role_id)
    if not link:
        raise HTTPException(404, "Role not found")
    await db.commit()
    return {"ok": True}


@router.delete("/users/{user_id}/roles/{role_id}", status_code=204)
async def remove_user_rbac_role(user_id: uuid.UUID, role_id: uuid.UUID, current_user: AdminUser, db: DB):
    removed = await service.remove_user_rbac_role(db, current_user.tenant_id, user_id, role_id)
    if not removed:
        raise HTTPException(404, "Assignment not found")
    await db.commit()


# ---------------------------------------------------------------------------
# Permissions matrix
# ---------------------------------------------------------------------------

@router.get("/permissions", response_model=list[PermissionsMatrixOut])
async def list_permissions(current_user: AdminUser, db: DB):
    return await service.list_permissions(db, current_user.tenant_id)


@router.put("/permissions", response_model=PermissionsMatrixOut)
async def upsert_permission(body: PermissionsMatrixUpsert, current_user: AdminUser, db: DB):
    row = await service.upsert_permission(
        db,
        current_user.tenant_id,
        body.subject_type,
        body.subject_id,
        body.module,
        body.access_level,
    )
    await db.commit()
    await db.refresh(row)
    return row


@router.delete("/permissions/{permission_id}", status_code=204)
async def delete_permission(permission_id: uuid.UUID, current_user: AdminUser, db: DB):
    deleted = await service.delete_permission(db, current_user.tenant_id, permission_id)
    if not deleted:
        raise HTTPException(404, "Permission entry not found")
    await db.commit()
