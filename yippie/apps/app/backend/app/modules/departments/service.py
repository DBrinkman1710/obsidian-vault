from __future__ import annotations

import uuid
from typing import Optional

from sqlalchemy import delete as sa_delete, select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.models import User
from app.modules.departments.models import Department, DepartmentMember
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


# --- Membership ---


async def get_departments_for_user(
    db: AsyncSession, tenant_id: uuid.UUID, user_id: uuid.UUID
) -> list[Department]:
    """Departments this user is a member of."""
    result = await db.execute(
        select(Department)
        .join(DepartmentMember, DepartmentMember.department_id == Department.id)
        .where(
            DepartmentMember.tenant_id == tenant_id,
            DepartmentMember.user_id == user_id,
        )
        .order_by(Department.name)
    )
    return result.scalars().all()


async def list_members(
    db: AsyncSession, tenant_id: uuid.UUID, dept_id: uuid.UUID
) -> list[tuple[DepartmentMember, User]]:
    """(DepartmentMember, User) pairs for one department."""
    result = await db.execute(
        select(DepartmentMember, User)
        .join(User, User.id == DepartmentMember.user_id)
        .where(
            DepartmentMember.tenant_id == tenant_id,
            DepartmentMember.department_id == dept_id,
        )
        .order_by(User.full_name)
    )
    return [(row[0], row[1]) for row in result.all()]


async def add_member(
    db: AsyncSession, tenant_id: uuid.UUID, dept_id: uuid.UUID, user_id: uuid.UUID
) -> None:
    """Add a user to a department; no-op if already a member."""
    await db.execute(
        pg_insert(DepartmentMember)
        .values(
            id=uuid.uuid4(),
            tenant_id=tenant_id,
            department_id=dept_id,
            user_id=user_id,
        )
        .on_conflict_do_nothing(index_elements=["department_id", "user_id"])
    )
    await db.commit()


async def remove_member(
    db: AsyncSession, tenant_id: uuid.UUID, dept_id: uuid.UUID, user_id: uuid.UUID
) -> None:
    await db.execute(
        sa_delete(DepartmentMember).where(
            DepartmentMember.tenant_id == tenant_id,
            DepartmentMember.department_id == dept_id,
            DepartmentMember.user_id == user_id,
        )
    )
    await db.commit()
