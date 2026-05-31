from __future__ import annotations

import uuid
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import load_tenant_config
from app.core.models import Tenant

_cached_tenant_uuid: Optional[uuid.UUID] = None


async def resolve_tenant_uuid(db: AsyncSession) -> uuid.UUID:
    """Returns the UUID of the configured tenant, queried once then cached."""
    global _cached_tenant_uuid
    if _cached_tenant_uuid is not None:
        return _cached_tenant_uuid
    cfg = load_tenant_config()
    result = await db.execute(select(Tenant).where(Tenant.slug == cfg.tenant_id))
    tenant = result.scalar_one_or_none()
    if tenant is None:
        raise RuntimeError(f"Tenant '{cfg.tenant_id}' not found — run seed.py first")
    _cached_tenant_uuid = tenant.id
    return _cached_tenant_uuid
