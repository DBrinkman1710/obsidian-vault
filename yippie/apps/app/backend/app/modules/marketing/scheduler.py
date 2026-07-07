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
from app.core.scheduler_lock import skip_if_locked
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
    if await skip_if_locked("mktg_send_scheduled", ttl=50):
        return
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
    if await skip_if_locked("mktg_ab_winner", ttl=870):
        return
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
    if await skip_if_locked("mktg_drip", ttl=3300):
        return
    from app.core.mailer import send_email

    now = datetime.now(timezone.utc)
    settings = get_settings()
    base_url = settings.effective_base_url or settings.app_base_url or ""

    from app.modules.contacts.models import Contact
    from app.modules.marketing.models import ContactUnsubscribe

    async with db_session() as db:
        # Campaigns that have actually dispatched AND still have an unsent step —
        # finished campaigns drop out of this scan instead of being re-checked
        # every hour forever.
        result = await db.execute(
            select(Campaign).where(
                Campaign.dispatched_at.isnot(None),
                Campaign.status.in_(["sending", "completed"]),
                select(CampaignSequence.id)
                .where(
                    CampaignSequence.campaign_id == Campaign.id,
                    CampaignSequence.sent_at.is_(None),
                )
                .exists(),
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

                # Claim the step BEFORE sending: a restart mid-batch must not
                # re-send the whole recipient list next hour. (The remainder of
                # an interrupted step is skipped — duplicates are worse than a
                # missed follow-up for marketing email.)
                step.sent_at = now
                await db.commit()

                # Recipients who received the campaign and have NOT replied.
                rec_result = await db.execute(
                    select(CampaignAnalytics).where(
                        CampaignAnalytics.campaign_id == campaign.id,
                        CampaignAnalytics.status != "replied",
                    )
                )
                recipients = rec_result.scalars().all()

                # Resolve contacts and opt-outs in two batched queries instead
                # of two per recipient.
                emails = {r.recipient_email for r in recipients}
                contact_rows = await db.execute(
                    select(Contact.email, Contact.id).where(
                        Contact.tenant_id == campaign.tenant_id,
                        Contact.email.in_(emails),
                        Contact.deleted_at.is_(None),
                    )
                )
                contact_by_email = {email: cid for email, cid in contact_rows.all()}
                unsub_rows = await db.execute(
                    select(ContactUnsubscribe.contact_id).where(
                        ContactUnsubscribe.tenant_id == campaign.tenant_id,
                        ContactUnsubscribe.contact_id.in_(contact_by_email.values()),
                    )
                )
                unsubscribed_ids = {cid for (cid,) in unsub_rows.all()}

                sent_any = False
                for row in recipients:
                    contact_id = contact_by_email.get(row.recipient_email)
                    if contact_id in unsubscribed_ids:
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

                if sent_any:
                    log.info("Sent drip step %s for campaign %s", step.id, campaign.id)


@scheduler.scheduled_job("cron", day=1, hour=0, minute=0, id="mktg_engagement_decay")
async def decay_engagement_scores():
    """Monthly: decay all contact engagement scores by 10%."""
    from sqlalchemy import text
    if await skip_if_locked("mktg_engagement_decay", ttl=82800):
        return
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
