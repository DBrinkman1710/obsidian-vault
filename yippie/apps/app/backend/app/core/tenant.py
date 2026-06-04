from __future__ import annotations

import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.models import Tenant


async def get_tenant(db: AsyncSession, tenant_id) -> Tenant:
    """Fetch a tenant by UUID. Prefer using current_user.tenant_id directly."""
    tenant = await db.get(Tenant, tenant_id)
    if tenant is None:
        raise RuntimeError(f"Tenant {tenant_id} not found")
    return tenant


async def resolve_tenant_uuid(db: AsyncSession) -> uuid.UUID:
    """Return the first tenant's UUID. Used by unauthenticated webhook endpoints.

    TODO: replace with per-tenant webhook URLs (/{tenant_slug}/webhooks/...) once
    multiple clients are onboarded.
    """
    result = await db.execute(select(Tenant.id).order_by(Tenant.created_at).limit(1))
    tenant_id = result.scalar_one_or_none()
    if tenant_id is None:
        raise RuntimeError("No tenant found in database")
    return tenant_id
