"""SAAS-MOD1 — SaaS product analytics service.

Health score formula:
  recency_score  = max(0, 100 - days_since_last_active * 3.3)   → weight 40%
  breadth_score  = (distinct_features / max(distinct_features, 10)) * 100 → weight 40%
  error_penalty  = min(50, recent_errors * 5)                   → weight 20% (subtracted)
  score = clamp(round(recency*0.4 + breadth*0.4 - error*0.2), 0, 100)
"""
from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.flow_events import emit_flow_event
from app.modules.saas.models import SaasEvent, SaasHealth
from app.modules.saas.schemas import HealthSummaryOut, SaasHealthOut


def _health_color(score: int) -> str:
    if score >= 70:
        return "green"
    if score >= 40:
        return "amber"
    return "red"


async def get_contact_events(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    contact_id: uuid.UUID,
    domain: str | None = None,
    limit: int = 50,
    offset: int = 0,
) -> list[SaasEvent]:
    q = (
        select(SaasEvent)
        .where(SaasEvent.tenant_id == tenant_id, SaasEvent.contact_id == contact_id)
        .order_by(SaasEvent.created_at.desc())
        .limit(limit)
        .offset(offset)
    )
    if domain:
        q = q.where(SaasEvent.event_domain == domain)
    result = await db.execute(q)
    return list(result.scalars().all())


async def get_contact_health(
    db: AsyncSession, tenant_id: uuid.UUID, contact_id: uuid.UUID
) -> SaasHealthOut | None:
    result = await db.execute(
        select(SaasHealth).where(
            SaasHealth.tenant_id == tenant_id, SaasHealth.contact_id == contact_id
        )
    )
    row = result.scalar_one_or_none()
    if row is None:
        return None
    return SaasHealthOut(
        contact_id=row.contact_id,
        score=row.score,
        recency_score=row.recency_score,
        breadth_score=row.breadth_score,
        error_penalty=row.error_penalty,
        last_computed_at=row.last_computed_at,
        color=_health_color(row.score),
    )


async def compute_health_for_contact(
    db: AsyncSession, tenant_id: uuid.UUID, contact_id: uuid.UUID
) -> int:
    """Recompute and persist health score. Returns the new score."""
    now = datetime.now(timezone.utc)
    cutoff_30d = now - timedelta(days=30)

    # Recency: days since last event
    last_result = await db.execute(
        select(func.max(SaasEvent.created_at)).where(
            SaasEvent.tenant_id == tenant_id,
            SaasEvent.contact_id == contact_id,
            SaasEvent.event_domain == "saas",
        )
    )
    last_active = last_result.scalar_one_or_none()
    if last_active is None:
        return 0
    if last_active.tzinfo is None:
        last_active = last_active.replace(tzinfo=timezone.utc)
    days_inactive = max(0, (now - last_active).days)
    recency = max(0.0, 100.0 - days_inactive * 3.3)

    # Breadth: distinct features used in last 30 days
    features_result = await db.execute(
        select(func.count(func.distinct(SaasEvent.properties["feature"].astext))).where(
            SaasEvent.tenant_id == tenant_id,
            SaasEvent.contact_id == contact_id,
            SaasEvent.event_type == "feature_used",
            SaasEvent.event_domain == "saas",
            SaasEvent.created_at >= cutoff_30d,
        )
    )
    distinct_features = int(features_result.scalar_one() or 0)
    breadth = min(100.0, (distinct_features / 10.0) * 100.0)

    # Error penalty: error events in last 30 days
    errors_result = await db.execute(
        select(func.count()).where(
            SaasEvent.tenant_id == tenant_id,
            SaasEvent.contact_id == contact_id,
            SaasEvent.event_type == "error_encountered",
            SaasEvent.event_domain == "saas",
            SaasEvent.created_at >= cutoff_30d,
        )
    )
    recent_errors = int(errors_result.scalar_one() or 0)
    penalty = min(50.0, recent_errors * 5.0)

    score = max(0, min(100, round(recency * 0.4 + breadth * 0.4 - penalty * 0.2)))

    # Upsert into saas_health
    existing = await db.execute(
        select(SaasHealth).where(
            SaasHealth.tenant_id == tenant_id, SaasHealth.contact_id == contact_id
        )
    )
    row = existing.scalar_one_or_none()
    old_score = row.score if row else None
    if row is None:
        row = SaasHealth(tenant_id=tenant_id, contact_id=contact_id)
        db.add(row)
    row.score = score
    row.recency_score = round(recency, 2)
    row.breadth_score = round(breadth, 2)
    row.error_penalty = round(penalty, 2)
    row.last_computed_at = now

    # Emit flow event if score dropped
    if old_score is not None and score < old_score:
        drop = old_score - score
        await emit_flow_event(
            db,
            tenant_id,
            "saas_health_dropped",
            entity_type="contact",
            entity_id=contact_id,
            contact_id=contact_id,
            payload={"score": score, "previous_score": old_score, "drop": drop},
        )

    return score


async def get_health_summary(
    db: AsyncSession, tenant_id: uuid.UUID
) -> HealthSummaryOut:
    cutoff_30d = datetime.now(timezone.utc) - timedelta(days=30)

    # Total contacts tracked
    total_result = await db.execute(
        select(func.count(func.distinct(SaasEvent.contact_id))).where(
            SaasEvent.tenant_id == tenant_id,
            SaasEvent.contact_id.isnot(None),
            SaasEvent.event_domain == "saas",
        )
    )
    total = int(total_result.scalar_one() or 0)

    # Contacts with at least one onboarding_step event
    onboard_result = await db.execute(
        select(func.count(func.distinct(SaasEvent.contact_id))).where(
            SaasEvent.tenant_id == tenant_id,
            SaasEvent.contact_id.isnot(None),
            SaasEvent.event_type == "onboarding_step",
            SaasEvent.event_domain == "saas",
        )
    )
    onboarded = int(onboard_result.scalar_one() or 0)
    onboarding_pct = round((onboarded / total * 100) if total else 0, 1)

    # Top features (last 30 days)
    feat_result = await db.execute(
        select(
            SaasEvent.properties["feature"].astext.label("feature"),
            func.count().label("cnt"),
        )
        .where(
            SaasEvent.tenant_id == tenant_id,
            SaasEvent.event_type == "feature_used",
            SaasEvent.event_domain == "saas",
            SaasEvent.created_at >= cutoff_30d,
        )
        .group_by(text("1"))
        .order_by(func.count().desc())
        .limit(5)
    )
    top_features = [{"feature": r.feature, "count": r.cnt} for r in feat_result.all()]

    # Most common errors (last 30 days)
    err_result = await db.execute(
        select(
            SaasEvent.properties["code"].astext.label("error_code"),
            func.count().label("cnt"),
        )
        .where(
            SaasEvent.tenant_id == tenant_id,
            SaasEvent.event_type == "error_encountered",
            SaasEvent.event_domain == "saas",
            SaasEvent.created_at >= cutoff_30d,
        )
        .group_by(text("1"))
        .order_by(func.count().desc())
        .limit(5)
    )
    common_errors = [{"error_code": r.error_code, "count": r.cnt} for r in err_result.all()]

    # At-risk count
    at_risk_result = await db.execute(
        select(func.count()).where(
            SaasHealth.tenant_id == tenant_id,
            SaasHealth.score < 40,
        )
    )
    at_risk = int(at_risk_result.scalar_one() or 0)

    return HealthSummaryOut(
        total_contacts_tracked=total,
        onboarding_completion_pct=onboarding_pct,
        top_features=top_features,
        common_errors=common_errors,
        at_risk_count=at_risk,
    )
