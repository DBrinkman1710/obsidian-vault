from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import AdminUser, CurrentUser
from app.database import get_db
from app.modules.departments import service
from app.modules.departments.schemas import (
    AddMemberRequest,
    DeadlineSettings,
    DeadlineSettingsUpdate,
    DepartmentCreate,
    DepartmentMemberOut,
    DepartmentOut,
    DepartmentUpdate,
    InviteAndAddMemberRequest,
)
from app.modules.team import service as team_service

router = APIRouter(prefix="/departments", tags=["departments"])
DB = Annotated[AsyncSession, Depends(get_db)]


@router.get("/all", response_model=list[DepartmentOut])
async def list_all_departments(current_user: CurrentUser, db: DB):
    """All departments in this tenant — available to any authenticated user (for assignment dropdowns)."""
    depts = await service.list_departments(db, current_user.tenant_id)
    return [
        DepartmentOut(
            id=d.id,
            tenant_id=d.tenant_id,
            name=d.name,
            email=d.email,
            reply_template=d.reply_template,
            sla_working_days=d.sla_working_days,
            created_at=d.created_at,
            members=[],
        )
        for d in depts
    ]


@router.get("", response_model=list[DepartmentOut])
async def list_departments(current_user: AdminUser, db: DB):
    return await service.list_departments(db, current_user.tenant_id)


@router.get("/my", response_model=list[DepartmentOut])
async def list_my_departments(current_user: CurrentUser, db: DB):
    """Departments the current (non-admin) user belongs to — drives the
    per-department inbox sub-items in the sidebar."""
    depts = await service.get_departments_for_user(
        db, current_user.tenant_id, current_user.id
    )
    return [
        DepartmentOut(
            id=d.id,
            tenant_id=d.tenant_id,
            name=d.name,
            email=d.email,
            reply_template=d.reply_template,
            sla_working_days=d.sla_working_days,
            created_at=d.created_at,
            members=[],
        )
        for d in depts
    ]


@router.get("/deadline-settings", response_model=DeadlineSettings)
async def get_deadline_settings(current_user: AdminUser, db: DB):
    from app.core.models import Tenant

    tenant = await db.get(Tenant, current_user.tenant_id)
    if tenant is None:
        raise HTTPException(status_code=404, detail="Tenant not found")
    return DeadlineSettings(
        deadline_red_days=tenant.deadline_red_days,
        deadline_orange_days=tenant.deadline_orange_days,
    )


@router.patch("/deadline-settings", response_model=DeadlineSettings)
async def update_deadline_settings(body: DeadlineSettingsUpdate, current_user: AdminUser, db: DB):
    from app.core.models import Tenant

    tenant = await db.get(Tenant, current_user.tenant_id)
    if tenant is None:
        raise HTTPException(status_code=404, detail="Tenant not found")
    if body.deadline_red_days is not None:
        tenant.deadline_red_days = max(0, body.deadline_red_days)
    if body.deadline_orange_days is not None:
        tenant.deadline_orange_days = max(0, body.deadline_orange_days)
    await db.commit()
    await db.refresh(tenant)
    return DeadlineSettings(
        deadline_red_days=tenant.deadline_red_days,
        deadline_orange_days=tenant.deadline_orange_days,
    )


@router.post("", response_model=DepartmentOut, status_code=status.HTTP_201_CREATED)
async def create_department(body: DepartmentCreate, current_user: AdminUser, db: DB):
    return await service.create_department(db, current_user.tenant_id, body)


@router.patch("/{dept_id}", response_model=DepartmentOut)
async def update_department(dept_id: uuid.UUID, body: DepartmentUpdate, current_user: AdminUser, db: DB):
    dept = await service.get_department(db, current_user.tenant_id, dept_id)
    if not dept:
        raise HTTPException(status_code=404, detail="Department not found")
    return await service.update_department(db, dept, body)


@router.delete("/{dept_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_department(dept_id: uuid.UUID, current_user: AdminUser, db: DB):
    dept = await service.get_department(db, current_user.tenant_id, dept_id)
    if not dept:
        raise HTTPException(status_code=404, detail="Department not found")
    await service.delete_department(db, dept)


# --- Members ---


async def _require_dept(db: AsyncSession, tenant_id: uuid.UUID, dept_id: uuid.UUID):
    dept = await service.get_department(db, tenant_id, dept_id)
    if not dept:
        raise HTTPException(status_code=404, detail="Department not found")
    return dept


@router.get("/{dept_id}/members", response_model=list[DepartmentMemberOut])
async def list_department_members(dept_id: uuid.UUID, current_user: AdminUser, db: DB):
    await _require_dept(db, current_user.tenant_id, dept_id)
    pairs = await service.list_members(db, current_user.tenant_id, dept_id)
    return [
        DepartmentMemberOut(
            user_id=user.id,
            email=user.email,
            full_name=user.full_name,
            role=user.role.value,
        )
        for _member, user in pairs
    ]


@router.post("/{dept_id}/members", status_code=status.HTTP_204_NO_CONTENT)
async def add_department_member(
    dept_id: uuid.UUID, body: AddMemberRequest, current_user: AdminUser, db: DB
):
    await _require_dept(db, current_user.tenant_id, dept_id)
    from app.core.models import User

    user = await db.get(User, body.user_id)
    if user is None or user.tenant_id != current_user.tenant_id:
        raise HTTPException(status_code=404, detail="User not found")
    await service.add_member(db, current_user.tenant_id, dept_id, body.user_id)


@router.delete("/{dept_id}/members/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_department_member(
    dept_id: uuid.UUID, user_id: uuid.UUID, current_user: AdminUser, db: DB
):
    await _require_dept(db, current_user.tenant_id, dept_id)
    await service.remove_member(db, current_user.tenant_id, dept_id, user_id)


@router.post("/{dept_id}/members/invite", status_code=status.HTTP_201_CREATED)
async def invite_department_member(
    dept_id: uuid.UUID, body: InviteAndAddMemberRequest, current_user: AdminUser, db: DB
):
    """Invite a new user to the tenant and add them to this department. If a user
    with that email already exists in the tenant, skip the invite and just add
    them to the department."""
    from app.core.models import User

    await _require_dept(db, current_user.tenant_id, dept_id)

    existing = await db.scalar(select(User).where(User.email == body.email))
    if existing is not None:
        if existing.tenant_id != current_user.tenant_id:
            raise HTTPException(
                status_code=409,
                detail="A user with that email belongs to another workspace",
            )
        await service.add_member(db, current_user.tenant_id, dept_id, existing.id)
        return {"invited": False, "email": body.email}

    try:
        await team_service.invite_user(
            db, current_user.tenant_id, body.email, body.full_name, body.role
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return {"invited": True, "email": body.email}
