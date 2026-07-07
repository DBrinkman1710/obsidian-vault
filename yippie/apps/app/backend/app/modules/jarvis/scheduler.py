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
from app.core.scheduler_lock import skip_if_locked
from app.database import db_session
from app.modules.chat.manager import manager

log = logging.getLogger(__name__)
scheduler = AsyncIOScheduler()

DEFAULT_BRIEFING_TIME = "08:00"
SLA_NUDGE_WINDOW_MIN = 60

# Reminders only carry dismissed_at, so a delivered-but-undismissed reminder would
# re-fire every minute. Track what we've already pushed this process to fire once.
_fired: set[str] = set()

# NOTE on distributed locking: jarvis_reminders and yip_sla_nudge deliberately
# do NOT use skip_if_locked. They deliver via the in-process WebSocket manager,
# so with multiple instances each instance must run the job to reach the agents
# connected to IT — a lock would silence agents on the other instances. Their
# writes are delivery-conditional (only marked done when a toast actually
# landed), which keeps them correct across instances. Jobs that write to the DB
# unconditionally (yip_briefing, jarvis_thread_cleanup) ARE locked.


@scheduler.scheduled_job("interval", minutes=1, id="jarvis_reminders", max_instances=1, coalesce=True)
async def jarvis_reminder_job():
    import sys
    now = datetime.now(timezone.utc)
    print(f"[jarvis_scheduler] tick at {now.isoformat()}", file=sys.stderr, flush=True)
    try:
        async with db_session() as db:
            await db.execute(text("SET LOCAL row_security = off"))
            result = await db.execute(
                select(UserReminder).where(
                    UserReminder.remind_at <= now,
                    UserReminder.dismissed_at.is_(None),
                )
            )
            reminders = result.scalars().all()
        print(f"[jarvis_scheduler] {len(reminders)} due reminder(s)", file=sys.stderr, flush=True)
    except Exception as exc:
        print(f"[jarvis_scheduler] ERROR: {exc}", file=sys.stderr, flush=True)
        raise

    for reminder in reminders:
        key = str(reminder.id)
        if key in _fired:
            continue
        delivered = await manager.broadcast_to_agents(
            str(reminder.tenant_id),
            {
                "event": "jarvis_reminder",
                "type": "jarvis_reminder",
                "reminder_id": key,
                "user_id": str(reminder.user_id),
                "body": reminder.body,
            },
        )
        if delivered:
            _fired.add(key)
            print(f"[jarvis_scheduler] Fired reminder {key[:8]} to agents", flush=True)
        else:
            print(f"[jarvis_scheduler] No agents online for reminder {key[:8]}, will retry", flush=True)


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

    if not force_user_email and await skip_if_locked("yip_briefing", ttl=870):
        return
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


# ---------------------------------------------------------------------------
# [YIP5] SLA near breach nudge — toast when a ticket's SLA lands within the
# next hour. sla_nudged_at makes it one nudge per ticket, restart proof; it is
# only set once the toast actually reached an online agent (same retry
# semantics as the reminder job).
# ---------------------------------------------------------------------------

@scheduler.scheduled_job("interval", minutes=10, id="yip_sla_nudge", max_instances=1, coalesce=True)
async def yip_sla_nudge_job():
    from app.modules.tickets.models import Ticket, TicketStatus

    now = datetime.now(timezone.utc)
    try:
        async with db_session() as db:
            await db.execute(text("SET LOCAL row_security = off"))
            result = await db.execute(
                select(Ticket).where(
                    Ticket.sla_due_at > now,
                    Ticket.sla_due_at <= now + timedelta(minutes=SLA_NUDGE_WINDOW_MIN),
                    Ticket.status.in_((TicketStatus.open, TicketStatus.in_progress)),
                    Ticket.deleted_at.is_(None),
                    Ticket.sla_nudged_at.is_(None),
                )
            )
            tickets = result.scalars().all()
            nudged = 0
            for t in tickets:
                due_in = max(1, int((t.sla_due_at - now).total_seconds() // 60))
                delivered = await manager.broadcast_to_agents(
                    str(t.tenant_id),
                    {
                        "event": "jarvis_sla_nudge",
                        "type": "jarvis_sla_nudge",
                        "ticket_id": str(t.id),
                        "user_id": str(t.assigned_to) if t.assigned_to else None,
                        "subject": t.subject,
                        "due_in_minutes": due_in,
                    },
                )
                if delivered:
                    t.sla_nudged_at = now
                    nudged += 1
            await db.commit()
        if nudged:
            log.info("[yip_sla_nudge] nudged %d ticket(s)", nudged)
    except Exception:
        log.exception("[yip_sla_nudge] job failed")


# ---------------------------------------------------------------------------
# [YIP-STREAM] thread retention — drop conversations idle past 30 days.
# ---------------------------------------------------------------------------

@scheduler.scheduled_job("interval", hours=24, id="jarvis_thread_cleanup", max_instances=1, coalesce=True)
async def jarvis_thread_cleanup_job():
    from app.modules.jarvis import threads

    if await skip_if_locked("jarvis_thread_cleanup", ttl=82800):
        return
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
