from __future__ import annotations

import uuid

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.invite import send_invite_email
from app.core.models import Tenant, User, UserRole

INVITABLE_ROLES = {UserRole.admin, UserRole.agent, UserRole.viewer}


async def list_users(db: AsyncSession, tenant_id: uuid.UUID) -> list[User]:
    result = await db.execute(
        select(User).where(User.tenant_id == tenant_id).order_by(User.created_at)
    )
    return result.scalars().all()


async def invite_user(
    db: AsyncSession, tenant_id: uuid.UUID, email: str, full_name: str, role: str,
    rbac_role_ids: list[uuid.UUID] | None = None,
) -> dict:
    try:
        role_enum = UserRole(role)
    except ValueError:
        raise ValueError(f"Unknown role '{role}'")
    if role_enum not in INVITABLE_ROLES:
        raise ValueError(f"Cannot invite users with role '{role}'")

    existing = await db.scalar(select(User).where(User.email == email))
    if existing:
        raise ValueError(f"A user with email '{email}' already exists.")

    tenant = await db.get(Tenant, tenant_id)
    await send_invite_email(
        to=email, full_name=full_name, tenant_id=tenant_id,
        role=role_enum.value, tenant_name=tenant.name if tenant else "Yippie",
        rbac_role_ids=[str(r) for r in rbac_role_ids] if rbac_role_ids else [],
    )
    return {"invited": True, "email": email, "role": role_enum.value}


async def update_user(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    user_id: uuid.UUID,
    acting_user: User,
    is_active: bool | None,
    role: str | None,
) -> User:
    user = await db.get(User, user_id)
    if user is None or user.tenant_id != tenant_id:
        raise LookupError("User not found")
    if user.id == acting_user.id:
        raise ValueError("You cannot change your own account here")
    if user.role == UserRole.superadmin:
        raise ValueError("Superadmins are managed from the Superadmins page")

    if role is not None:
        try:
            role_enum = UserRole(role)
        except ValueError:
            raise ValueError(f"Unknown role '{role}'")
        if role_enum not in INVITABLE_ROLES:
            raise ValueError(f"Cannot assign role '{role}'")
        user.role = role_enum
    if is_active is not None:
        user.is_active = is_active

    await db.commit()
    await db.refresh(user)
    return user


async def update_branding(db: AsyncSession, tenant_id: uuid.UUID, primary_color: str) -> None:
    tenant = await db.get(Tenant, tenant_id)
    if tenant is None:
        raise LookupError("Tenant not found")
    tenant.primary_color = primary_color
    await db.commit()


async def get_org_settings(db: AsyncSession, tenant_id: uuid.UUID) -> Tenant:
    tenant = await db.get(Tenant, tenant_id)
    if tenant is None:
        raise LookupError("Tenant not found")
    return tenant


async def update_org_settings(
    db: AsyncSession, tenant_id: uuid.UUID, kvk_nummer, btw_nummer
) -> Tenant:
    tenant = await db.get(Tenant, tenant_id)
    if tenant is None:
        raise LookupError("Tenant not found")
    tenant.kvk_nummer = (kvk_nummer or "").strip() or None
    tenant.btw_nummer = (btw_nummer or "").strip() or None
    await db.commit()
    await db.refresh(tenant)
    return tenant


async def delete_user(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    user_id: uuid.UUID,
    acting_user: User,
) -> None:
    if user_id == acting_user.id:
        raise ValueError("You cannot delete your own account")

    user = await db.get(User, user_id)
    if user is None or user.tenant_id != tenant_id:
        raise LookupError("User not found")
    if user.role == UserRole.superadmin:
        raise ValueError("Superadmins are managed from the Superadmins page")

    # Prevent removing the last active admin in the tenant.
    if user.role == UserRole.admin and user.is_active:
        active_admins = await db.scalar(
            select(func.count())
            .select_from(User)
            .where(
                User.tenant_id == tenant_id,
                User.role == UserRole.admin,
                User.is_active.is_(True),
            )
        )
        if (active_admins or 0) <= 1:
            raise ValueError("Cannot delete the last active admin")

    await db.delete(user)
    await db.commit()
