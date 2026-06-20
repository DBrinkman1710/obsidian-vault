from __future__ import annotations

import uuid

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import ALL_MODULES
from app.core.models import (
    AccessLevel,
    PermSubjectType,
    PermissionsMatrix,
    RbacRole,
    RbacUserRole,
    User,
    UserRole,
)
from app.modules.departments.models import DepartmentMember

ACCESS_ORDER = {AccessLevel.restricted: 0, AccessLevel.view: 1, AccessLevel.full: 2}


async def resolve_module_access(db: AsyncSession, user: User, module_key: str) -> AccessLevel:
    """Hierarchical resolution: user-override → dept → rbac-role → default full.

    Admins and superadmins always receive full access regardless of matrix entries.
    Only non-full entries are stored in permissions_matrix (the default is full).
    """
    if user.role in (UserRole.admin, UserRole.superadmin):
        return AccessLevel.full

    tid = user.tenant_id

    # 1. User-level override
    row = await _get_matrix_row(db, tid, PermSubjectType.user, user.id, module_key)
    if row:
        return row.access_level

    # 2. Department permissions — take most restrictive among user's depts
    dept_ids = await _get_user_dept_ids(db, user.id, tid)
    if dept_ids:
        rows = await _get_matrix_rows(db, tid, PermSubjectType.department, dept_ids, module_key)
        if rows:
            return min(rows, key=lambda r: ACCESS_ORDER[r.access_level]).access_level

    # 3. RBAC role permissions — take most permissive among assigned roles
    role_ids = await _get_user_rbac_role_ids(db, user.id, tid)
    if role_ids:
        rows = await _get_matrix_rows(db, tid, PermSubjectType.role, role_ids, module_key)
        if rows:
            return max(rows, key=lambda r: ACCESS_ORDER[r.access_level]).access_level

    return AccessLevel.full


async def get_my_permissions(db: AsyncSession, user: User) -> dict[str, str]:
    return {
        module: (await resolve_module_access(db, user, module)).value
        for module in ALL_MODULES
    }


# ---------------------------------------------------------------------------
# RBAC Role CRUD
# ---------------------------------------------------------------------------

async def list_roles(db: AsyncSession, tenant_id: uuid.UUID) -> list[RbacRole]:
    result = await db.execute(
        select(RbacRole).where(RbacRole.tenant_id == tenant_id).order_by(RbacRole.name)
    )
    return list(result.scalars().all())


async def create_role(db: AsyncSession, tenant_id: uuid.UUID, name: str) -> RbacRole:
    role = RbacRole(tenant_id=tenant_id, name=name.strip())
    db.add(role)
    await db.flush()
    await db.refresh(role)
    return role


async def delete_role(db: AsyncSession, tenant_id: uuid.UUID, role_id: uuid.UUID) -> bool:
    result = await db.execute(
        select(RbacRole).where(RbacRole.id == role_id, RbacRole.tenant_id == tenant_id)
    )
    role = result.scalar_one_or_none()
    if not role:
        return False
    await db.delete(role)
    return True


# ---------------------------------------------------------------------------
# User ↔ RBAC Role assignment
# ---------------------------------------------------------------------------

async def list_user_rbac_roles(db: AsyncSession, tenant_id: uuid.UUID, user_id: uuid.UUID) -> list[dict]:
    result = await db.execute(
        select(RbacUserRole, RbacRole)
        .join(RbacRole, RbacUserRole.role_id == RbacRole.id)
        .where(RbacUserRole.user_id == user_id, RbacUserRole.tenant_id == tenant_id)
    )
    return [{"id": ur.id, "role_id": r.id, "role_name": r.name} for ur, r in result.all()]


async def assign_user_rbac_role(
    db: AsyncSession, tenant_id: uuid.UUID, user_id: uuid.UUID, role_id: uuid.UUID
) -> RbacUserRole | None:
    # Verify role belongs to this tenant
    role = await db.execute(
        select(RbacRole).where(RbacRole.id == role_id, RbacRole.tenant_id == tenant_id)
    )
    if not role.scalar_one_or_none():
        return None
    link = RbacUserRole(tenant_id=tenant_id, user_id=user_id, role_id=role_id)
    db.add(link)
    await db.flush()
    return link


async def remove_user_rbac_role(
    db: AsyncSession, tenant_id: uuid.UUID, user_id: uuid.UUID, role_id: uuid.UUID
) -> bool:
    result = await db.execute(
        select(RbacUserRole).where(
            RbacUserRole.user_id == user_id,
            RbacUserRole.role_id == role_id,
            RbacUserRole.tenant_id == tenant_id,
        )
    )
    link = result.scalar_one_or_none()
    if not link:
        return False
    await db.delete(link)
    return True


# ---------------------------------------------------------------------------
# Permissions matrix CRUD
# ---------------------------------------------------------------------------

async def list_permissions(db: AsyncSession, tenant_id: uuid.UUID) -> list[PermissionsMatrix]:
    result = await db.execute(
        select(PermissionsMatrix).where(PermissionsMatrix.tenant_id == tenant_id)
    )
    return list(result.scalars().all())


async def upsert_permission(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    subject_type: PermSubjectType,
    subject_id: uuid.UUID,
    module: str,
    access_level: AccessLevel,
) -> PermissionsMatrix:
    result = await db.execute(
        select(PermissionsMatrix).where(
            PermissionsMatrix.tenant_id == tenant_id,
            PermissionsMatrix.subject_type == subject_type,
            PermissionsMatrix.subject_id == subject_id,
            PermissionsMatrix.module == module,
        )
    )
    row = result.scalar_one_or_none()
    if row:
        row.access_level = access_level
    else:
        row = PermissionsMatrix(
            tenant_id=tenant_id,
            subject_type=subject_type,
            subject_id=subject_id,
            module=module,
            access_level=access_level,
        )
        db.add(row)
    await db.flush()
    await db.refresh(row)
    return row


async def delete_permission(
    db: AsyncSession, tenant_id: uuid.UUID, permission_id: uuid.UUID
) -> bool:
    result = await db.execute(
        select(PermissionsMatrix).where(
            PermissionsMatrix.id == permission_id,
            PermissionsMatrix.tenant_id == tenant_id,
        )
    )
    row = result.scalar_one_or_none()
    if not row:
        return False
    await db.delete(row)
    return True


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

async def _get_matrix_row(
    db: AsyncSession, tenant_id: uuid.UUID, subject_type: PermSubjectType, subject_id: uuid.UUID, module: str
) -> PermissionsMatrix | None:
    result = await db.execute(
        select(PermissionsMatrix).where(
            PermissionsMatrix.tenant_id == tenant_id,
            PermissionsMatrix.subject_type == subject_type,
            PermissionsMatrix.subject_id == subject_id,
            PermissionsMatrix.module == module,
        )
    )
    return result.scalar_one_or_none()


async def _get_matrix_rows(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    subject_type: PermSubjectType,
    subject_ids: list[uuid.UUID],
    module: str,
) -> list[PermissionsMatrix]:
    result = await db.execute(
        select(PermissionsMatrix).where(
            PermissionsMatrix.tenant_id == tenant_id,
            PermissionsMatrix.subject_type == subject_type,
            PermissionsMatrix.subject_id.in_(subject_ids),
            PermissionsMatrix.module == module,
        )
    )
    return list(result.scalars().all())


async def _get_user_dept_ids(db: AsyncSession, user_id: uuid.UUID, tenant_id: uuid.UUID) -> list[uuid.UUID]:
    result = await db.execute(
        select(DepartmentMember.department_id).where(
            DepartmentMember.user_id == user_id,
            DepartmentMember.tenant_id == tenant_id,
        )
    )
    return list(result.scalars().all())


async def _get_user_rbac_role_ids(db: AsyncSession, user_id: uuid.UUID, tenant_id: uuid.UUID) -> list[uuid.UUID]:
    result = await db.execute(
        select(RbacUserRole.role_id).where(
            RbacUserRole.user_id == user_id,
            RbacUserRole.tenant_id == tenant_id,
        )
    )
    return list(result.scalars().all())
