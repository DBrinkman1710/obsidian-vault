"""SAAS-MOD1 — APScheduler jobs for health score computation and at-risk digest."""
from __future__ import annotations

import logging
from datetime import datetime, timezone

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from sqlalchemy import func, select

from app.core.scheduler_lock import skip_if_locked
from app.database import db_session
from app.modules.saas.models import SaasEvent, SaasHealth
from app.modules.saas import service

log = logging.getLogger(__name__)
scheduler = AsyncIOScheduler()


@scheduler.scheduled_job("interval", hours=1, id="saas_compute_health", max_instances=1, coalesce=True)
async def compute_saas_health():
    """Recompute health scores for all contacts that have new saas events since last compute."""
    if await skip_if_locked("saas_compute_health", ttl=3300):
        return
    async with db_session() as db:
        # Find (tenant_id, contact_id) pairs with events newer than their last_computed_at
        # or that have no health row yet.
        try:
            result = await db.execute(
                select(
                    SaasEvent.tenant_id,
                    SaasEvent.contact_id,
                )
                .join(
                    SaasHealth,
                    (SaasHealth.tenant_id == SaasEvent.tenant_id)
                    & (SaasHealth.contact_id == SaasEvent.contact_id),
                    isouter=True,
                )
                .where(
                    SaasEvent.contact_id.isnot(None),
                    SaasEvent.event_domain == "saas",
                    (SaasHealth.last_computed_at.is_(None))
                    | (SaasEvent.created_at > SaasHealth.last_computed_at),
                )
                .group_by(SaasEvent.tenant_id, SaasEvent.contact_id)
                .limit(500)
            )
            pairs = result.all()
            for row in pairs:
                try:
                    await service.compute_health_for_contact(db, row.tenant_id, row.contact_id)
                    await db.commit()
                except Exception:
                    await db.rollback()
                    log.exception(
                        "Failed to compute health for contact %s", row.contact_id
                    )
            log.info("saas_compute_health: updated %d contact scores", len(pairs))
        except Exception:
            await db.rollback()
            log.exception("saas_compute_health job failed")


@scheduler.scheduled_job("cron", day_of_week="mon", hour=8, minute=0, id="saas_health_digest", max_instances=1, coalesce=True)
async def saas_health_digest():
    """Weekly: email tenant admins a list of at-risk contacts (score < 40)."""
    from app.core.mailer import send_email
    from app.core.models import Tenant, User as TeamUser
    from sqlalchemy import and_

    if await skip_if_locked("saas_health_digest", ttl=82800):
        return
    async with db_session() as db:
        try:
            # Get all tenants with at-risk contacts
            at_risk_result = await db.execute(
                select(SaasHealth.tenant_id, func.count().label("cnt"))
                .where(SaasHealth.score < 40)
                .group_by(SaasHealth.tenant_id)
            )
            for row in at_risk_result.all():
                tenant_result = await db.execute(
                    select(Tenant).where(Tenant.id == row.tenant_id)
                )
                tenant = tenant_result.scalar_one_or_none()
                if not tenant:
                    continue

                # Admin users for this tenant
                admin_result = await db.execute(
                    select(TeamUser).where(
                        TeamUser.tenant_id == row.tenant_id,
                        TeamUser.role.in_(["admin", "superadmin"]),
                        TeamUser.is_active.is_(True),
                    )
                )
                admins = admin_result.scalars().all()
                for admin in admins:
                    try:
                        await send_email(
                            to=admin.email,
                            subject=f"[Yippie] {row.cnt} at-risk customers this week",
                            body=(
                                f"Hi {admin.full_name},\n\n"
                                f"{row.cnt} of your tracked customers have a health score below 40 this week. "
                                f"Log in to Yippie and visit the SaaS module to see who needs attention.\n\n"
                                f"The Yippie Team"
                            ),
                        )
                    except Exception:
                        log.exception("Failed to send digest to %s", admin.email)
            log.info("saas_health_digest completed")
        except Exception:
            await db.rollback()
            log.exception("saas_health_digest job failed")


def start_scheduler():
    if not scheduler.running:
        scheduler.start()
