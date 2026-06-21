"""MKTG1 — Campaign scheduler (APScheduler).

Three jobs, mirroring the sla_escalation pattern:
- send_scheduled_campaigns (every minute): launch campaigns whose scheduled_at
  has passed.
- send_drip_steps (hourly): for each dispatched campaign with sequences, send any
  step whose delay_days has elapsed to recipients who haven't replied / opted out.
- pick_ab_winners (every 15 min): 2h after dispatch, pick the A/B winner and send
  the held-back 50% the winning template.

The scheduler session never calls set_tenant_context, so it runs as the
connecting role and sees all tenants (same as sla_escalation).
"""
from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from sqlalchemy import select

from app.config import get_settings
from app.core.email_html import render_email_html
from app.database import db_session
from app.modules.marketing import service
from app.modules.marketing.models import (
    Campaign,
    CampaignAnalytics,
    CampaignSequence,
)

log = logging.getLogger(__name__)
scheduler = AsyncIOScheduler()

# Pick the A/B winner this long after the initial 50% dispatch.
AB_WINNER_DELAY = timedelta(hours=2)


@scheduler.scheduled_job("interval", minutes=1, id="mktg_send_scheduled")
async def send_scheduled_campaigns():
    now = datetime.now(timezone.utc)
    async with db_session() as db:
        result = await db.execute(
            select(Campaign).where(
                Campaign.status == "scheduled",
                Campaign.scheduled_at.isnot(None),
                Campaign.scheduled_at <= now,
            )
        )
        campaigns = result.scalars().all()
        for campaign in campaigns:
            try:
                await service.launch_campaign(db, campaign)
                await db.commit()
                log.info("Launched scheduled campaign %s", campaign.id)
            except Exception:
                await db.rollback()
                log.exception("Failed to launch scheduled campaign %s", campaign.id)


@scheduler.scheduled_job("interval", minutes=15, id="mktg_ab_winner")
async def pick_ab_winners():
    now = datetime.now(timezone.utc)
    async with db_session() as db:
        result = await db.execute(
            select(Campaign).where(
                Campaign.status == "sending",
                Campaign.ab_winner.is_(None),
                Campaign.dispatched_at.isnot(None),
            )
        )
        campaigns = result.scalars().all()
        for campaign in campaigns:
            dispatched = campaign.dispatched_at
            if dispatched and dispatched.tzinfo is None:
                dispatched = dispatched.replace(tzinfo=timezone.utc)
            if dispatched is None or (now - dispatched) < AB_WINNER_DELAY:
                continue
            # Only A/B campaigns (two variants among the dispatched rows) qualify.
            variants = await db.execute(
                select(CampaignAnalytics.variant)
                .where(CampaignAnalytics.campaign_id == campaign.id)
                .distinct()
            )
            vset = {v for (v,) in variants.all() if v}
            if {"a", "b"}.issubset(vset):
                try:
                    winner = await service.ab_pick_winner(db, campaign)
                    await db.commit()
                    log.info("Picked A/B winner %s for campaign %s", winner, campaign.id)
                except Exception:
                    await db.rollback()
                    log.exception("Failed A/B winner for campaign %s", campaign.id)
            else:
                # Non-A/B campaign that finished its single dispatch — mark complete.
                campaign.status = "completed"
                await db.commit()


@scheduler.scheduled_job("interval", hours=1, id="mktg_drip")
async def send_drip_steps():
    from app.core.mailer import send_email

    now = datetime.now(timezone.utc)
    settings = get_settings()
    base_url = settings.effective_base_url or settings.app_base_url or ""

    async with db_session() as db:
        # Campaigns that have actually dispatched and have at least one step.
        result = await db.execute(
            select(Campaign).where(
                Campaign.dispatched_at.isnot(None),
                Campaign.status.in_(["sending", "completed"]),
            )
        )
        campaigns = result.scalars().all()
        for campaign in campaigns:
            dispatched = campaign.dispatched_at
            if dispatched and dispatched.tzinfo is None:
                dispatched = dispatched.replace(tzinfo=timezone.utc)
            if dispatched is None:
                continue

            steps_result = await db.execute(
                select(CampaignSequence)
                .where(
                    CampaignSequence.campaign_id == campaign.id,
                    CampaignSequence.sent_at.is_(None),
                )
                .order_by(CampaignSequence.delay_days.asc())
            )
            steps = steps_result.scalars().all()
            for step in steps:
                due = dispatched + timedelta(days=step.delay_days)
                if now < due:
                    continue

                # Recipients who received the campaign and have NOT replied.
                rec_result = await db.execute(
                    select(CampaignAnalytics).where(
                        CampaignAnalytics.campaign_id == campaign.id,
                        CampaignAnalytics.status != "replied",
                    )
                )
                recipients = rec_result.scalars().all()
                sent_any = False
                for row in recipients:
                    # Skip opted-out contacts (matched by email within tenant).
                    from app.modules.contacts.models import Contact

                    contact_q = await db.execute(
                        select(Contact).where(
                            Contact.tenant_id == campaign.tenant_id,
                            Contact.email == row.recipient_email,
                            Contact.deleted_at.is_(None),
                        )
                    )
                    contact = contact_q.scalar_one_or_none()
                    if contact and await service.is_unsubscribed(
                        db, contact.id, campaign.tenant_id
                    ):
                        continue

                    html = render_email_html(
                        body_text=step.subject,
                        prerendered_html=step.html_body,
                    )
                    html += service._open_pixel(base_url, row.tracking_token)
                    html += service._unsubscribe_footer(base_url, row.tracking_token)
                    try:
                        await send_email(
                            to=row.recipient_email,
                            subject=step.subject,
                            body=step.subject,
                            html=html,
                        )
                        sent_any = True
                    except Exception:
                        log.exception(
                            "Drip step %s: send failed for %s",
                            step.id,
                            row.recipient_email,
                        )

                step.sent_at = now
                if sent_any:
                    log.info("Sent drip step %s for campaign %s", step.id, campaign.id)
            await db.commit()


@scheduler.scheduled_job("cron", day=1, hour=0, minute=0, id="mktg_engagement_decay")
async def decay_engagement_scores():
    """Monthly: decay all contact engagement scores by 10%."""
    from sqlalchemy import text
    async with db_session() as db:
        try:
            await db.execute(
                text(
                    "UPDATE contacts SET engagement_score = GREATEST(0, FLOOR(engagement_score * 0.9)::int) "
                    "WHERE engagement_score > 0"
                )
            )
            await db.commit()
            log.info("Monthly engagement score decay applied")
        except Exception:
            await db.rollback()
            log.exception("Failed to apply engagement score decay")


def start_scheduler():
    if not scheduler.running:
        scheduler.start()
