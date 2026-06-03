from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import AdminUser
from app.database import get_db
from app.modules.departments import service
from app.modules.departments.schemas import DepartmentCreate, DepartmentOut, DepartmentUpdate

router = APIRouter(prefix="/departments", tags=["departments"])
DB = Annotated[AsyncSession, Depends(get_db)]


@router.get("", response_model=list[DepartmentOut])
async def list_departments(current_user: AdminUser, db: DB):
    return await service.list_departments(db, current_user.tenant_id)


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
