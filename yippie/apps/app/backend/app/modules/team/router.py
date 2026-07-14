from __future__ import annotations

import uuid
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import AdminUser, CurrentUser
from app.core.mailer import ResendNotConfiguredError
from app.database import get_db
from app.modules.departments import service as dept_service
from app.modules.team import schemas, service

router = APIRouter(prefix="/team", tags=["team"])

DB = Annotated[AsyncSession, Depends(get_db)]


@router.get("/members", response_model=list[schemas.TeamMemberOut])
async def list_team_members(current_user: CurrentUser, db: DB, module: Optional[str] = None):
    """Lightweight member list available to all authenticated users (for assignment dropdowns).

    Pass ?module=tickets or ?module=inbox to filter to users who have access to that module.
    """
    if module:
        return await service.list_assignable_users(db, current_user.tenant_id, module)
    return await service.list_users(db, current_user.tenant_id)


@router.get("/users", response_model=list[schemas.TeamUserOut])
async def list_team_users(current_user: AdminUser, db: DB):
    return await service.list_users(db, current_user.tenant_id)


@router.post("/invite", status_code=status.HTTP_201_CREATED)
async def invite_team_user(current_user: AdminUser, db: DB, data: schemas.TeamInviteRequest):
    try:
        return await service.invite_user(db, current_user.tenant_id, data.email, data.full_name, data.role, data.rbac_role_ids)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(e))
    except ResendNotConfiguredError as e:
        raise HTTPException(status_code=503, detail=str(e))


@router.patch("/users/{user_id}", response_model=schemas.TeamUserOut)
async def update_team_user(current_user: AdminUser, db: DB, user_id: uuid.UUID, data: schemas.TeamUserUpdate):
    try:
        return await service.update_user(
            db, current_user.tenant_id, user_id, current_user,
            data.is_active, data.role, data.email, data.full_name,
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))
    except LookupError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.patch("/branding")
async def update_branding(current_user: AdminUser, db: DB, data: schemas.BrandingUpdate):
    try:
        await service.update_branding(db, current_user.tenant_id, data.primary_color, data.logo_url)
    except LookupError as e:
        raise HTTPException(status_code=404, detail=str(e))
    return {"ok": True}


@router.get("/workspace-prefs", response_model=schemas.WorkspacePrefsOut)
async def get_workspace_prefs(current_user: AdminUser, db: DB):
    from app.core.models import Tenant

    tenant = await db.get(Tenant, current_user.tenant_id)
    if tenant is None:
        raise HTTPException(status_code=404, detail="Tenant not found")
    return schemas.WorkspacePrefsOut(
        pipeline_nudge_enabled=tenant.pipeline_nudge_enabled,
        inbound_email=tenant.inbound_email,
    )


@router.patch("/workspace-prefs", response_model=schemas.WorkspacePrefsOut)
async def update_workspace_prefs(current_user: AdminUser, db: DB, data: schemas.WorkspacePrefsUpdate):
    from sqlalchemy import select

    from app.core.models import Tenant

    tenant = await db.get(Tenant, current_user.tenant_id)
    if tenant is None:
        raise HTTPException(status_code=404, detail="Tenant not found")
    if data.pipeline_nudge_enabled is not None:
        tenant.pipeline_nudge_enabled = data.pipeline_nudge_enabled
    if data.inbound_email is not None:
        addr = data.inbound_email.strip().lower()
        if addr and "@" not in addr:
            raise HTTPException(status_code=422, detail="Enter a valid email address.")
        if addr:
            clash = await db.scalar(
                select(Tenant.id).where(Tenant.inbound_email == addr, Tenant.id != tenant.id)
            )
            if clash is not None:
                raise HTTPException(status_code=409, detail="That address is already used by another workspace.")
        tenant.inbound_email = addr or None
    await db.commit()
    await db.refresh(tenant)
    return schemas.WorkspacePrefsOut(
        pipeline_nudge_enabled=tenant.pipeline_nudge_enabled,
        inbound_email=tenant.inbound_email,
    )


@router.get("/org-settings", response_model=schemas.OrgSettingsOut)
async def get_org_settings(current_user: AdminUser, db: DB):
    tenant = await service.get_org_settings(db, current_user.tenant_id)
    return schemas.OrgSettingsOut(kvk_nummer=tenant.kvk_nummer, btw_nummer=tenant.btw_nummer)


@router.patch("/org-settings", response_model=schemas.OrgSettingsOut)
async def update_org_settings(current_user: AdminUser, db: DB, data: schemas.OrgSettingsUpdate):
    try:
        tenant = await service.update_org_settings(
            db, current_user.tenant_id, data.kvk_nummer, data.btw_nummer
        )
    except LookupError as e:
        raise HTTPException(status_code=404, detail=str(e))
    return schemas.OrgSettingsOut(kvk_nummer=tenant.kvk_nummer, btw_nummer=tenant.btw_nummer)


@router.get("/users/{user_id}/departments", response_model=list[schemas.UserDepartmentOut])
async def get_user_departments(current_user: AdminUser, db: DB, user_id: uuid.UUID):
    from app.core.models import User
    user = await db.get(User, user_id)
    if user is None or user.tenant_id != current_user.tenant_id:
        raise HTTPException(status_code=404, detail="User not found")
    return await dept_service.get_departments_for_user(db, current_user.tenant_id, user_id)


@router.put("/users/{user_id}/departments", status_code=status.HTTP_204_NO_CONTENT)
async def set_user_departments(current_user: AdminUser, db: DB, user_id: uuid.UUID, data: schemas.UserDepartmentsUpdate):
    from app.core.models import User
    user = await db.get(User, user_id)
    if user is None or user.tenant_id != current_user.tenant_id:
        raise HTTPException(status_code=404, detail="User not found")
    await service.set_user_departments(db, current_user.tenant_id, user_id, data.department_ids)


@router.delete("/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_team_user(current_user: AdminUser, db: DB, user_id: uuid.UUID):
    try:
        await service.delete_user(db, current_user.tenant_id, user_id, current_user)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except LookupError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.patch("/ai-profile")
async def update_ai_profile(current_user: AdminUser, db: DB, data: schemas.AiProfileUpdate):
    from app.core.models import Tenant
    tenant = await db.get(Tenant, current_user.tenant_id)
    if tenant is None:
        raise HTTPException(status_code=404, detail="Tenant not found")
    existing = dict(tenant.ai_profile or {})
    update_fields = data.model_dump(exclude_none=True)
    existing.update(update_fields)
    tenant.ai_profile = existing
    await db.commit()
    return {"ai_profile": tenant.ai_profile}
