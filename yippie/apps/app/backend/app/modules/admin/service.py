from __future__ import annotations

import uuid

from passlib.context import CryptContext
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.models import Tenant, User, UserRole
from app.modules.admin.schemas import TenantCreate, TenantUpdate

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

TENANT_SAFE_FIELDS = {"name", "enabled_modules", "primary_color", "logo_url"}


def _tenant_to_dict(tenant: Tenant, user_count: int) -> dict:
    return {**{c.name: getattr(tenant, c.name) for c in Tenant.__table__.columns}, "user_count": user_count}


async def list_tenants(db: AsyncSession) -> list[dict]:
    result = await db.execute(
        select(Tenant, func.count(User.id).label("user_count"))
        .outerjoin(User, User.tenant_id == Tenant.id)
        .group_by(Tenant.id)
        .order_by(Tenant.created_at)
    )
    rows = result.all()
    return [_tenant_to_dict(row.Tenant, row.user_count) for row in rows]


async def create_tenant(db: AsyncSession, data: TenantCreate) -> dict:
    # Never silently overwrite an existing user's credentials
    existing_user = await db.scalar(select(User).where(User.email == data.admin_email))
    if existing_user:
        raise ValueError(f"A user with email '{data.admin_email}' already exists.")

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
    return _tenant_to_dict(tenant, 1)


async def update_tenant(db: AsyncSession, tenant_id: uuid.UUID, data: TenantUpdate) -> dict | None:
    tenant = await db.get(Tenant, tenant_id)
    if tenant is None:
        return None
    for field, value in data.model_dump(exclude_none=True).items():
        if field not in TENANT_SAFE_FIELDS:
            continue  # explicit safelist — never write unexpected fields to the Tenant model
        setattr(tenant, field, value)
    await db.commit()
    await db.refresh(tenant)
    user_count = await db.scalar(select(func.count(User.id)).where(User.tenant_id == tenant.id))
    return _tenant_to_dict(tenant, user_count or 0)


async def get_tenant_users(db: AsyncSession, tenant_id: uuid.UUID) -> list[User]:
    result = await db.execute(select(User).where(User.tenant_id == tenant_id).order_by(User.created_at))
    return result.scalars().all()
