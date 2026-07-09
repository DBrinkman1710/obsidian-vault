"""APScheduler job for contract lifecycle ([CONTRACT2]).

Runs every 6 hours (idempotent — the one-shot nudge timestamps on the row and
the status transitions make re-runs harmless):

1. Auto-expire: active contracts past end_date without auto_renew → status "expired".
2. Auto-renew:  active contracts past end_date with auto_renew → roll start/end
   forward by renewal_term and re-arm the reminder timestamps for the new cycle.
3. Notice nudge: notice_deadline within NOTICE_NUDGE_DAYS → drop a UserReminder
   for the contract owner; the existing jarvis minute-job delivers it as a
   WebSocket toast and keeps retrying until an agent is online.
4. Expiry nudge: end_date within EXPIRY_NUDGE_DAYS on non-renewing contracts.

Start it from the main.py lifespan alongside the other schedulers.
"""
from __future__ import annotations

import logging
from datetime import date, datetime, timedelta, timezone

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from sqlalchemy import select, text

from app.core.models import UserReminder
from app.database import db_session
from app.modules.contracts.models import Contract

log = logging.getLogger(__name__)
scheduler = AsyncIOScheduler()

NOTICE_NUDGE_DAYS = 14  # nudge this many days before the notice deadline
EXPIRY_NUDGE_DAYS = 7   # nudge this many days before a non-renewing contract ends


def _add_term(d: date, term: str | None) -> date:
    """Roll a date forward one renewal term, clamping the day (Jan 31 → Feb 28)."""
    if term == "monthly":
        year, month = (d.year + 1, 1) if d.month == 12 else (d.year, d.month + 1)
    else:  # yearly (default when unset — annual contracts are the common case)
        year, month = d.year + 1, d.month
    for day in (d.day, 30, 29, 28):
        try:
            return date(year, month, day)
        except ValueError:
            continue
    return date(year, month, 28)


def _counterparty(c: Contract) -> str:
    return c.counterparty_name or "the counterparty"


async def _nudge(db, c: Contract, body: str) -> None:
    """Queue a Yip reminder for the contract owner (falls back to the creator)."""
    user_id = c.owner_user_id or c.created_by
    if not user_id:
        return
    db.add(
        UserReminder(
            user_id=user_id,
            tenant_id=c.tenant_id,
            body=body,
            remind_at=datetime.now(timezone.utc),
        )
    )


@scheduler.scheduled_job("interval", hours=6, id="contract_lifecycle", max_instances=1, coalesce=True)
async def contract_lifecycle_job():
    now = datetime.now(timezone.utc)
    today = now.date()
    try:
        async with db_session() as db:
            # Cross-tenant maintenance job — same pattern as the jarvis reminder job.
            await db.execute(text("SET LOCAL row_security = off"))

            result = await db.execute(
                select(Contract).where(Contract.status == "active", Contract.end_date.isnot(None))
            )
            contracts = result.scalars().all()

            expired = renewed = nudged = 0
            for c in contracts:
                # 1 + 2 — end_date passed: expire or roll forward.
                if c.end_date < today:
                    if c.auto_renew:
                        term_start = c.end_date
                        c.end_date = _add_term(c.end_date, c.renewal_term)
                        if c.start_date:
                            c.start_date = term_start
                        c.notice_reminder_sent_at = None
                        c.expiry_reminder_sent_at = None
                        renewed += 1
                    else:
                        c.status = "expired"
                        expired += 1
                    continue

                # 3 — notice deadline approaching.
                deadline = c.notice_deadline
                if (
                    deadline is not None
                    and c.notice_reminder_sent_at is None
                    and today >= deadline - timedelta(days=NOTICE_NUDGE_DAYS)
                ):
                    days_left = (deadline - today).days
                    when = f"in {days_left} day{'s' if days_left != 1 else ''}" if days_left > 0 else "today"
                    await _nudge(
                        db, c,
                        f"Contract \"{c.title}\" with {_counterparty(c)}: notice deadline is {when} "
                        f"({deadline.strftime('%d-%m-%Y')}). Renew or give notice.",
                    )
                    c.notice_reminder_sent_at = now
                    nudged += 1

                # 4 — expiry approaching and it will not auto renew.
                if (
                    not c.auto_renew
                    and c.expiry_reminder_sent_at is None
                    and today >= c.end_date - timedelta(days=EXPIRY_NUDGE_DAYS)
                ):
                    days_left = (c.end_date - today).days
                    when = f"in {days_left} day{'s' if days_left != 1 else ''}" if days_left > 0 else "today"
                    await _nudge(
                        db, c,
                        f"Contract \"{c.title}\" with {_counterparty(c)} expires {when} "
                        f"({c.end_date.strftime('%d-%m-%Y')}) and does not auto renew.",
                    )
                    # [FLOW7] one-shot flow event: expiry_reminder_sent_at IS the
                    # dedup, stamped in this same transaction (outbox guarantee).
                    from app.core.flow_events import emit_flow_event

                    await emit_flow_event(
                        db, c.tenant_id, "contract_expiring",
                        entity_type="contract", entity_id=c.id,
                        contact_id=c.contact_id,
                        payload={
                            "title": c.title,
                            "counterparty": _counterparty(c),
                            "days_left": days_left,
                            "end_date": c.end_date.isoformat(),
                            "contact_id": c.contact_id,
                        },
                    )
                    c.expiry_reminder_sent_at = now
                    nudged += 1

            await db.commit()
        if expired or renewed or nudged:
            log.info(
                "[contract_lifecycle] expired=%d renewed=%d nudged=%d", expired, renewed, nudged
            )
    except Exception:
        log.exception("[contract_lifecycle] job failed")


def start_scheduler():
    if not scheduler.running:
        scheduler.start()
