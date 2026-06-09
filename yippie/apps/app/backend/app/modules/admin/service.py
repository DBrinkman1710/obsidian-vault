from __future__ import annotations

import os
import uuid

from passlib.context import CryptContext
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.models import Tenant, User, UserRole
from app.modules.admin.schemas import AddAdminRequest, TenantCreate, TenantUpdate

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

TENANT_SAFE_FIELDS = {"name", "enabled_modules", "primary_color", "logo_url", "is_active", "is_demo", "go_live_at", "inbound_email"}

# The platform owner's account — same default as promote_superadmin.py / seed.py.
# No one, including other superadmins, may deactivate it.
PROTECTED_SUPERADMIN_EMAIL = os.getenv("ADMIN_EMAIL", "diederik1710@gmail.com").lower()


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
        is_demo=data.is_demo,
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


async def add_tenant_user(db: AsyncSession, tenant_id: uuid.UUID, data: AddAdminRequest) -> User | None:
    tenant = await db.get(Tenant, tenant_id)
    if tenant is None:
        return None
    existing = await db.scalar(select(User).where(User.email == data.email))
    if existing:
        raise ValueError(f"A user with email '{data.email}' already exists.")
    user = User(
        tenant_id=tenant_id,
        email=data.email,
        full_name=data.full_name,
        hashed_password=pwd_context.hash(data.password),
        role=UserRole.admin,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


async def list_superadmins(db: AsyncSession) -> list[User]:
    result = await db.execute(
        select(User).where(User.role == UserRole.superadmin).order_by(User.created_at)
    )
    return result.scalars().all()


async def toggle_superadmin_active(
    db: AsyncSession,
    current_user: User,
    target_id: uuid.UUID,
    is_active: bool,
    current_password: str,
) -> User:
    if not pwd_context.verify(current_password, current_user.hashed_password):
        raise ValueError("Incorrect password.")
    if target_id == current_user.id:
        raise ValueError("You cannot deactivate your own account.")
    target = await db.get(User, target_id)
    if target is None:
        raise LookupError("User not found.")
    if target.role != UserRole.superadmin:
        raise ValueError("User is not a superadmin.")
    if not is_active and target.email.lower() == PROTECTED_SUPERADMIN_EMAIL:
        raise ValueError(f"{target.email} cannot be deactivated.")
    target.is_active = is_active
    await db.commit()
    await db.refresh(target)
    return target


async def promote_superadmin(
    db: AsyncSession,
    current_user: User,
    target_email: str,
    current_password: str,
) -> User | None:
    if not pwd_context.verify(current_password, current_user.hashed_password):
        raise ValueError("Incorrect password.")
    target = await db.scalar(select(User).where(User.email == target_email))
    if target is None:
        raise LookupError(f"No user found with email '{target_email}'.")
    target.role = UserRole.superadmin
    await db.commit()
    await db.refresh(target)
    return target
