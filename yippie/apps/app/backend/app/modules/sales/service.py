"""SALES-MOD1 — Commerce tracking service."""
from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.saas.models import SaasEvent, SaasIdentity
from app.modules.sales.schemas import SalesStatsOut


async def get_contact_events(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    contact_id: uuid.UUID,
    limit: int = 20,
    offset: int = 0,
) -> list[SaasEvent]:
    result = await db.execute(
        select(SaasEvent)
        .where(
            SaasEvent.tenant_id == tenant_id,
            SaasEvent.contact_id == contact_id,
            SaasEvent.event_domain == "commerce",
        )
        .order_by(SaasEvent.created_at.desc())
        .limit(limit)
        .offset(offset)
    )
    return list(result.scalars().all())


async def get_stats(db: AsyncSession, tenant_id: uuid.UUID) -> SalesStatsOut:
    total_result = await db.execute(
        select(func.count()).where(
            SaasEvent.tenant_id == tenant_id,
            SaasEvent.event_domain == "commerce",
        )
    )
    total = int(total_result.scalar_one() or 0)

    pv_result = await db.execute(
        select(func.count()).where(
            SaasEvent.tenant_id == tenant_id,
            SaasEvent.event_domain == "commerce",
            SaasEvent.event_type == "pageview",
        )
    )
    pageviews = int(pv_result.scalar_one() or 0)

    pur_result = await db.execute(
        select(func.count()).where(
            SaasEvent.tenant_id == tenant_id,
            SaasEvent.event_domain == "commerce",
            SaasEvent.event_type == "purchase",
        )
    )
    purchases = int(pur_result.scalar_one() or 0)

    last_result = await db.execute(
        select(func.max(SaasEvent.created_at)).where(
            SaasEvent.tenant_id == tenant_id,
            SaasEvent.event_domain == "commerce",
        )
    )
    last_event_at = last_result.scalar_one_or_none()

    # Top pages by pageview count
    pages_result = await db.execute(
        select(
            SaasEvent.properties["url"].astext.label("url"),
            func.count().label("cnt"),
        )
        .where(
            SaasEvent.tenant_id == tenant_id,
            SaasEvent.event_domain == "commerce",
            SaasEvent.event_type == "pageview",
        )
        .group_by(SaasEvent.properties["url"].astext)
        .order_by(func.count().desc())
        .limit(10)
    )
    top_pages = [{"url": r.url, "count": r.cnt} for r in pages_result.all()]

    return SalesStatsOut(
        total_events=total,
        pageviews=pageviews,
        purchases=purchases,
        last_event_at=last_event_at,
        top_pages=top_pages,
    )
