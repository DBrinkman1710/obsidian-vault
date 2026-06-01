from __future__ import annotations

import uuid
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.departments.models import Department
from app.modules.departments.schemas import DepartmentCreate, DepartmentUpdate


async def list_departments(db: AsyncSession, tenant_id: uuid.UUID) -> list[Department]:
    result = await db.execute(
        select(Department)
        .where(Department.tenant_id == tenant_id)
        .order_by(Department.name)
    )
    return result.scalars().all()


async def get_department(db: AsyncSession, tenant_id: uuid.UUID, dept_id: uuid.UUID) -> Optional[Department]:
    result = await db.execute(
        select(Department).where(Department.tenant_id == tenant_id, Department.id == dept_id)
    )
    return result.scalar_one_or_none()


async def create_department(db: AsyncSession, tenant_id: uuid.UUID, body: DepartmentCreate) -> Department:
    dept = Department(
        tenant_id=tenant_id,
        name=body.name,
        email=body.email,
        reply_template=body.reply_template,
        sla_working_days=body.sla_working_days,
    )
    db.add(dept)
    await db.commit()
    await db.refresh(dept)
    return dept


async def update_department(db: AsyncSession, dept: Department, body: DepartmentUpdate) -> Department:
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(dept, field, value)
    await db.commit()
    await db.refresh(dept)
    return dept


async def delete_department(db: AsyncSession, dept: Department) -> None:
    await db.delete(dept)
    await db.commit()
