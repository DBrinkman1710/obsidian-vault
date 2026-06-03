from __future__ import annotations

import uuid

from passlib.context import CryptContext
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.models import Tenant, User, UserRole
from app.modules.admin.schemas import TenantCreate, TenantUpdate

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


async def list_tenants(db: AsyncSession) -> list[dict]:
    result = await db.execute(
        select(Tenant, func.count(User.id).label("user_count"))
        .outerjoin(User, User.tenant_id == Tenant.id)
        .group_by(Tenant.id)
        .order_by(Tenant.created_at)
    )
    rows = result.all()
    return [
        {**{c.name: getattr(row.Tenant, c.name) for c in Tenant.__table__.columns}, "user_count": row.user_count}
        for row in rows
    ]


async def create_tenant(db: AsyncSession, data: TenantCreate) -> Tenant:
    tenant = Tenant(
        slug=data.slug,
        name=data.name,
        enabled_modules=data.enabled_modules,
        primary_color=data.primary_color,
        logo_url=data.logo_url,
    )
    db.add(tenant)
    await db.flush()

    db.add(User(
        tenant_id=tenant.id,
        email=data.admin_email,
        full_name="Admin",
        hashed_password=pwd_context.hash(data.admin_password),
        role=UserRole.admin,
    ))
    await db.commit()
    await db.refresh(tenant)
    return tenant


async def update_tenant(db: AsyncSession, tenant_id: uuid.UUID, data: TenantUpdate) -> Tenant:
    tenant = await db.get(Tenant, tenant_id)
    if tenant is None:
        return None
    for field, value in data.model_dump(exclude_none=True).items():
        setattr(tenant, field, value)
    await db.commit()
    await db.refresh(tenant)
    return tenant


async def get_tenant_users(db: AsyncSession, tenant_id: uuid.UUID) -> list[User]:
    result = await db.execute(select(User).where(User.tenant_id == tenant_id).order_by(User.created_at))
    return result.scalars().all()
