"""SALES-MOD1 — Commerce tracking service."""
from __future__ import annotations

import uuid
from datetime import date, datetime, timedelta, timezone

from sqlalchemy import func, select, text
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

    # Top pages by pageview count — GROUP BY 1 (ordinal) avoids the asyncpg
    # parameterisation issue where ->> gets split into two bind params and
    # PostgreSQL can't prove SELECT and GROUP BY reference the same expression.
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
        .group_by(text("1"))
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


async def get_sparklines(db: AsyncSession, tenant_id: uuid.UUID, days: int = 7) -> dict:
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)
    result = await db.execute(
        select(
            func.date(SaasEvent.created_at).label("day"),
            SaasEvent.event_type,
            func.count().label("cnt"),
        )
        .where(
            SaasEvent.tenant_id == tenant_id,
            SaasEvent.event_domain == "commerce",
            SaasEvent.created_at >= cutoff,
        )
        .group_by(text("1"), SaasEvent.event_type)
        .order_by(text("1"))
    )
    rows = result.all()

    today = date.today()
    dates = [(today - timedelta(days=days - 1 - i)) for i in range(days)]
    pageviews: dict[date, int] = {d: 0 for d in dates}
    purchases: dict[date, int] = {d: 0 for d in dates}
    for row in rows:
        d = row.day if isinstance(row.day, date) else date.fromisoformat(str(row.day))
        if d in pageviews:
            if row.event_type == "pageview":
                pageviews[d] += row.cnt
            elif row.event_type == "purchase":
                purchases[d] += row.cnt

    return {
        "pageviews": [pageviews[d] for d in dates],
        "purchases": [purchases[d] for d in dates],
    }
