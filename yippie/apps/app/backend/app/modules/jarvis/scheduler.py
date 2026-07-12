"""APScheduler jobs for Yip: reminder toasts, [YIP5] morning briefings + SLA
near breach nudges, and [YIP-STREAM] thread retention.

Start it from the main.py lifespan alongside the other schedulers.
"""
from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from sqlalchemy import select, text

from app.core.models import Tenant, User, UserReminder
from app.database import db_session
from app.modules.chat.manager import manager

log = logging.getLogger(__name__)
scheduler = AsyncIOScheduler()

DEFAULT_BRIEFING_TIME = "08:00"


@scheduler.scheduled_job("interval", minutes=1, id="jarvis_reminders", max_instances=1, coalesce=True)
async def jarvis_reminder_job():
    """Push due reminder toasts to their owner, exactly once.

    delivered_at is stamped in the DB the moment a reminder reaches an online
    socket, so a process restart or a second worker never re-fires it. An offline
    owner simply leaves delivered_at NULL and the reminder is retried next tick.
    """
    now = datetime.now(timezone.utc)
    try:
        async with db_session() as db:
            await db.execute(text("SET LOCAL row_security = off"))
            result = await db.execute(
                select(UserReminder).where(
                    UserReminder.remind_at <= now,
                    UserReminder.dismissed_at.is_(None),
                    UserReminder.delivered_at.is_(None),
                )
            )
            reminders = result.scalars().all()

            fired = 0
            for reminder in reminders:
                delivered = await manager.send_to_agent_user(
                    str(reminder.tenant_id),
                    str(reminder.user_id),
                    {
                        "event": "jarvis_reminder",
                        "type": "jarvis_reminder",
                        "reminder_id": str(reminder.id),
                        "user_id": str(reminder.user_id),
                        "body": reminder.body,
                    },
                )
                if delivered:
                    reminder.delivered_at = now
                    fired += 1
            if fired:
                await db.commit()
                log.info("[jarvis_reminders] delivered %d reminder(s)", fired)
    except Exception:
        log.exception("[jarvis_reminders] job failed")


# ---------------------------------------------------------------------------
# [YIP5] Morning briefing — per user digest written into a briefing thread.
# Runs every 15 minutes; a user is served once per tenant-local day, at or
# after their preferred time (missed ticks self heal on the next run).
# ---------------------------------------------------------------------------

def _parse_briefing_time(raw: str | None) -> tuple[int, int]:
    try:
        hh, mm = (raw or DEFAULT_BRIEFING_TIME).split(":")
        return int(hh), int(mm)
    except (ValueError, AttributeError):
        return 8, 0


@scheduler.scheduled_job("interval", minutes=15, id="yip_briefing", max_instances=1, coalesce=True)
async def yip_briefing_job(force_user_email: str | None = None):
    """Build and deliver morning briefings.

    force_user_email bypasses the time window and the once-per-day dedup —
    for manual testing:
      docker compose exec backend python -c "import asyncio; \\
        from app.modules.jarvis.scheduler import yip_briefing_job; \\
        asyncio.run(yip_briefing_job(force_user_email='you@example.com'))"
    """
    from app.modules.booking.models import CalendarSettings
    from app.modules.jarvis import briefing as briefing_mod
    from app.modules.jarvis.models import JarvisMessage, JarvisThread

    sent = 0
    try:
        async with db_session() as db:
            await db.execute(text("SET LOCAL row_security = off"))
            tenants = (await db.execute(select(Tenant))).scalars().all()
            tz_by_tenant = dict(
                (await db.execute(select(CalendarSettings.tenant_id, CalendarSettings.timezone))).all()
            )

            for tenant in tenants:
                try:
                    tz = ZoneInfo(tz_by_tenant.get(tenant.id) or "Europe/Amsterdam")
                except Exception:
                    tz = ZoneInfo("Europe/Amsterdam")
                local_now = datetime.now(tz)
                today_str = local_now.strftime("%Y-%m-%d")

                users = (
                    await db.execute(
                        select(User).where(User.tenant_id == tenant.id, User.is_active.is_(True))
                    )
                ).scalars().all()

                for u in users:
                    prefs = dict(u.jarvis_prefs or {})
                    if force_user_email:
                        if u.email != force_user_email:
                            continue
                    else:
                        if prefs.get("briefing_enabled") is False:
                            continue
                        hh, mm = _parse_briefing_time(prefs.get("briefing_time"))
                        if (local_now.hour, local_now.minute) < (hh, mm):
                            continue
                        if prefs.get("briefing_last_sent_on") == today_str:
                            continue

                    body = await briefing_mod.build_briefing(db, tenant, u, tz)

                    # Mark the day served either way — an empty day should not
                    # be rebuilt every 15 minutes.
                    prefs["briefing_last_sent_on"] = today_str
                    u.jarvis_prefs = prefs

                    if body:
                        thread = JarvisThread(
                            tenant_id=tenant.id,
                            user_id=u.id,
                            kind="briefing",
                            title=f"Morning briefing — {local_now.strftime('%a %d %b')}",
                        )
                        db.add(thread)
                        await db.flush()
                        db.add(JarvisMessage(
                            thread_id=thread.id,
                            tenant_id=tenant.id,
                            role="assistant",
                            content=body,
                            action_taken="answer",
                        ))
                    await db.commit()
                    # SET LOCAL reverts on commit — re-arm for the next user.
                    await db.execute(text("SET LOCAL row_security = off"))

                    if body:
                        sent += 1
                        await manager.broadcast_to_agents(
                            str(tenant.id),
                            {
                                "event": "jarvis_briefing",
                                "type": "jarvis_briefing",
                                "user_id": str(u.id),
                                "body": "Your morning briefing is ready",
                            },
                        )
        if sent:
            log.info("[yip_briefing] delivered %d briefing(s)", sent)
    except Exception:
        log.exception("[yip_briefing] job failed")


# [YIP5]'s SLA near breach nudge job was retired in [FLOW8]: the notification is
# now the default flow "Notify the assigned agent before SLA breach" (trigger
# ticket_sla_due_soon), so tenants can edit or disable it. The sla_nudged_at
# column is left in place (no DDL) — harmless, and dropping it is out of scope.


# ---------------------------------------------------------------------------
# [YIP-STREAM] thread retention — drop conversations idle past 30 days.
# ---------------------------------------------------------------------------

@scheduler.scheduled_job("interval", hours=24, id="jarvis_thread_cleanup", max_instances=1, coalesce=True)
async def jarvis_thread_cleanup_job():
    from app.modules.jarvis import threads

    try:
        async with db_session() as db:
            await db.execute(text("SET LOCAL row_security = off"))
            removed = await threads.cleanup_old_threads(db)
            await db.commit()
        if removed:
            log.info("[jarvis_thread_cleanup] removed %d thread(s)", removed)
    except Exception:
        log.exception("[jarvis_thread_cleanup] job failed")


def start_scheduler():
    if not scheduler.running:
        scheduler.start()
