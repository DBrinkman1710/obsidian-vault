"""APScheduler minute-job that fires due Jarvis reminders over the agent WebSocket.

Start it from the main.py lifespan alongside the other schedulers.
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from sqlalchemy import select, text

from app.core.models import UserReminder
from app.database import db_session
from app.modules.chat.manager import manager

log = logging.getLogger(__name__)
scheduler = AsyncIOScheduler()

# Reminders only carry dismissed_at, so a delivered-but-undismissed reminder would
# re-fire every minute. Track what we've already pushed this process to fire once.
_fired: set[str] = set()


@scheduler.scheduled_job("interval", minutes=1, id="jarvis_reminders", max_instances=1, coalesce=True)
async def jarvis_reminder_job():
    now = datetime.now(timezone.utc)
    async with db_session() as db:
        # Disable row-level security for this system-level cross-tenant query.
        # The scheduler runs as the DB owner (postgres) which has BYPASSRLS;
        # this SET LOCAL makes it explicit and survives even if the role changes.
        await db.execute(text("SET LOCAL row_security = off"))
        result = await db.execute(
            select(UserReminder).where(
                UserReminder.remind_at <= now,
                UserReminder.dismissed_at.is_(None),
            )
        )
        reminders = result.scalars().all()
    log.info("jarvis_reminder_job: %d due reminder(s) found", len(reminders))

    for reminder in reminders:
        key = str(reminder.id)
        if key in _fired:
            continue
        await manager.broadcast_to_agents(
            str(reminder.tenant_id),
            {
                "event": "jarvis_reminder",
                "type": "jarvis_reminder",
                "reminder_id": key,
                "user_id": str(reminder.user_id),
                "body": reminder.body,
            },
        )
        _fired.add(key)
        log.info("Fired Jarvis reminder %s", key)


def start_scheduler():
    if not scheduler.running:
        scheduler.start()
