"""
Runs on a schedule (APScheduler) — escalates overdue tickets and auto-closes stale ones.
Start it alongside uvicorn by importing and calling `start_scheduler()` from main.py lifespan.
"""
from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from sqlalchemy import select, update

from app.config import load_tenant_config
from app.database import db_session
from app.modules.tickets.models import Ticket, TicketPriority, TicketStatus

log = logging.getLogger(__name__)
scheduler = AsyncIOScheduler()


@scheduler.scheduled_job("interval", minutes=5, id="sla_escalation")
async def escalate_overdue_tickets():
    cfg = load_tenant_config()
    now = datetime.now(timezone.utc)
    async with db_session() as db:
        result = await db.execute(
            select(Ticket).where(
                Ticket.sla_due_at < now,
                Ticket.status.in_([TicketStatus.open, TicketStatus.in_progress]),
                Ticket.priority != TicketPriority.urgent,
            )
        )
        tickets = result.scalars().all()
        for ticket in tickets:
            priority_order = [TicketPriority.low, TicketPriority.medium, TicketPriority.high, TicketPriority.urgent]
            idx = priority_order.index(ticket.priority)
            ticket.priority = priority_order[min(idx + 1, len(priority_order) - 1)]
            log.info("Escalated ticket %s to %s", ticket.id, ticket.priority)
        if tickets:
            await db.commit()


@scheduler.scheduled_job("interval", hours=1, id="auto_close")
async def auto_close_stale_tickets():
    cfg = load_tenant_config()
    days = cfg.features.auto_close_days
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)
    async with db_session() as db:
        result = await db.execute(
            select(Ticket).where(
                Ticket.status == TicketStatus.waiting,
                Ticket.updated_at < cutoff,
            )
        )
        tickets = result.scalars().all()
        for ticket in tickets:
            ticket.status = TicketStatus.closed
            log.info("Auto-closed stale ticket %s", ticket.id)
        if tickets:
            await db.commit()


def start_scheduler():
    if not scheduler.running:
        scheduler.start()
