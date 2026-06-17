"""
Runs on a schedule (APScheduler) — escalates overdue tickets and auto-closes stale ones.
Start it alongside uvicorn by importing and calling `start_scheduler()` from main.py lifespan.
"""
from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from sqlalchemy import func, select, update

from app.core.models import Tenant
from app.database import db_session
from app.modules.tickets.models import Ticket, TicketPriority, TicketStatus

log = logging.getLogger(__name__)
scheduler = AsyncIOScheduler()


@scheduler.scheduled_job("interval", minutes=5, id="sla_escalation")
async def escalate_overdue_tickets():
    now = datetime.now(timezone.utc)
    async with db_session() as db:
        result = await db.execute(
            select(Ticket).where(
                Ticket.sla_due_at < now,
                Ticket.status.in_([TicketStatus.open, TicketStatus.in_progress]),
                Ticket.priority != TicketPriority.urgent,
                Ticket.deleted_at.is_(None),
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
    # Per-tenant: each ticket is closed once it has gone its OWN tenant's
    # auto_close_days without an update. This scheduler session never calls
    # set_tenant_context, so it runs as the connecting role and sees all tenants.
    async with db_session() as db:
        result = await db.execute(
            select(Ticket)
            .join(Tenant, Tenant.id == Ticket.tenant_id)
            .where(
                Ticket.status == TicketStatus.waiting,
                Ticket.deleted_at.is_(None),
                Ticket.updated_at < func.now() - func.make_interval(0, 0, 0, Tenant.auto_close_days),
            )
        )
        tickets = result.scalars().all()
        for ticket in tickets:
            ticket.status = TicketStatus.closed
            log.info("Auto-closed stale ticket %s", ticket.id)
        if tickets:
            await db.commit()


@scheduler.scheduled_job("interval", hours=1, id="demo_expiry_check")
async def demo_expiry_check():
    """Deactivate demo tenants older than 7 days and notify the platform owner."""
    import os

    from app.core.mailer import send_email
    from app.core.models import Tenant

    admin_email = os.getenv("ADMIN_EMAIL", "diederik1710@gmail.com")
    cutoff = datetime.now(timezone.utc) - timedelta(days=7)
    async with db_session() as db:
        result = await db.execute(
            select(Tenant).where(
                Tenant.is_demo.is_(True),
                Tenant.is_active.is_(True),
                Tenant.created_at < cutoff,
            )
        )
        tenants = result.scalars().all()
        for tenant in tenants:
            tenant.is_active = False
            log.info("Expired demo tenant %s (%s)", tenant.name, tenant.slug)
            try:
                await send_email(
                    to=admin_email,
                    subject=f"Demo expired: {tenant.name}",
                    body=(
                        f"Demo expired: {tenant.name} ({tenant.slug}), "
                        f"created {tenant.created_at}."
                    ),
                )
            except Exception:
                log.exception("Failed to send demo-expiry email for %s", tenant.slug)
        if tenants:
            await db.commit()


@scheduler.scheduled_job("interval", hours=1, id="contact_retention_purge")
async def contact_retention_purge():
    """Hard-delete contacts that have been soft-deleted for more than 30 days."""
    from app.modules.contacts import service as contacts_service

    async with db_session() as db:
        count = await contacts_service.purge_old_deleted_contacts(db)
        if count:
            log.info("Purged %d contact(s) older than 30 days", count)


def start_scheduler():
    if not scheduler.running:
        scheduler.start()
