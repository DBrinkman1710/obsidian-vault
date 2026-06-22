from __future__ import annotations

import uuid

from sqlalchemy import delete as sa_delete, func, select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.invite import send_invite_email
from app.core.models import Tenant, User, UserRole
from app.core.plans import limits_for_plan
from app.modules.departments.models import Department, DepartmentMember

INVITABLE_ROLES = {UserRole.admin, UserRole.agent, UserRole.viewer}


async def list_users(db: AsyncSession, tenant_id: uuid.UUID) -> list[User]:
    result = await db.execute(
        select(User).where(User.tenant_id == tenant_id).order_by(User.created_at)
    )
    return list(result.scalars().all())


async def list_assignable_users(db: AsyncSession, tenant_id: uuid.UUID, module: str) -> list[User]:
    """Return active users who have at least view-level access to the given module.

    Admins/superadmins always qualify. For other roles, check the RBAC matrix —
    users explicitly restricted at user, dept, or role level are excluded.
    The default when no matrix entry exists is 'full', so most users qualify.
    """
    from app.core.models import AccessLevel
    from app.modules.rbac.service import resolve_module_access

    result = await db.execute(
        select(User).where(
            User.tenant_id == tenant_id,
            User.is_active.is_(True),
        ).order_by(User.full_name)
    )
    all_users = list(result.scalars().all())

    assignable = []
    for user in all_users:
        if user.role in (UserRole.admin, UserRole.superadmin):
            assignable.append(user)
            continue
        level = await resolve_module_access(db, user, module)
        if level != AccessLevel.restricted:
            assignable.append(user)
    return assignable


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
    limits = limits_for_plan(tenant.plan if tenant else None)
    max_users = limits.get("users")
    if max_users is not None:
        current_count = await db.scalar(
            select(func.count()).select_from(User).where(
                User.tenant_id == tenant_id,
                User.is_active.is_(True),
            )
        )
        if (current_count or 0) >= max_users:
            raise ValueError(
                f"Your {(tenant.plan or 'current').title()} plan is limited to {max_users} users. "
                "Upgrade to add more team members."
            )
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
    email: str | None = None,
    full_name: str | None = None,
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
    if email is not None:
        email = email.strip().lower()
        conflict = await db.scalar(select(User).where(User.email == email))
        if conflict and conflict.id != user_id:
            raise ValueError(f"Email '{email}' is already in use")
        user.email = email
    if full_name is not None:
        user.full_name = full_name.strip()

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


async def set_user_departments(
    db: AsyncSession, tenant_id: uuid.UUID, user_id: uuid.UUID, department_ids: list[uuid.UUID]
) -> None:
    """Replace all department memberships for a user within the tenant."""
    # Delete all existing memberships for this user in this tenant
    await db.execute(
        sa_delete(DepartmentMember).where(
            DepartmentMember.tenant_id == tenant_id,
            DepartmentMember.user_id == user_id,
        )
    )
    # Insert new memberships (only for departments that belong to this tenant)
    for dept_id in department_ids:
        dept = await db.scalar(
            select(Department).where(Department.id == dept_id, Department.tenant_id == tenant_id)
        )
        if dept is not None:
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
