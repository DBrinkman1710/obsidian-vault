from __future__ import annotations

import uuid

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.models import Tenant


async def get_tenant(db: AsyncSession, tenant_id) -> Tenant:
    """Fetch a tenant by UUID. Prefer using current_user.tenant_id directly."""
    tenant = await db.get(Tenant, tenant_id)
    if tenant is None:
        raise RuntimeError(f"Tenant {tenant_id} not found")
    return tenant


async def resolve_tenant_by_inbound_email(db: AsyncSession, email: str) -> uuid.UUID | None:
    """Return a tenant's UUID by inbound_email. Returns None if not found."""
    result = await db.execute(
        select(Tenant.id).where(Tenant.inbound_email == email.lower().strip(), Tenant.is_active == True)  # noqa: E712
    )
    return result.scalar_one_or_none()


async def resolve_tenant_by_slug(db: AsyncSession, slug: str) -> uuid.UUID:
    """Return a tenant's UUID by slug. Used by per-tenant webhook endpoints."""
    result = await db.execute(select(Tenant.id).where(Tenant.slug == slug))
    tenant_id = result.scalar_one_or_none()
    if tenant_id is None:
        raise HTTPException(status_code=404, detail=f"Tenant '{slug}' not found")
    return tenant_id


async def get_inbound_email_map(db: AsyncSession) -> dict[str, tuple[uuid.UUID, bool]]:
    """Return {inbound_email_lower: (tenant_id, ai_enabled)} for all active tenants with inbound_email set."""
    result = await db.execute(
        select(Tenant.id, Tenant.inbound_email, Tenant.enabled_modules)
        .where(Tenant.inbound_email.isnot(None), Tenant.is_active == True)  # noqa: E712
    )
    return {
        row.inbound_email.lower().strip(): (row.id, "ai" in (row.enabled_modules or []))
        for row in result
    }
