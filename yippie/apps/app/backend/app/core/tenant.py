from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.models import Tenant


async def get_tenant(db: AsyncSession, tenant_id) -> Tenant:
    """Fetch a tenant by UUID. Prefer using current_user.tenant_id directly."""
    tenant = await db.get(Tenant, tenant_id)
    if tenant is None:
        raise RuntimeError(f"Tenant {tenant_id} not found")
    return tenant
