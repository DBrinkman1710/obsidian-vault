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
    """Deactivate demo tenants past demo_expires_at and notify the platform owner."""
    import os

    from app.core.mailer import send_email
    from app.core.models import Tenant

    admin_email = os.getenv("ADMIN_EMAIL", "diederik1710@gmail.com")
    now = datetime.now(timezone.utc)
    legacy_cutoff = now - timedelta(days=7)
    async with db_session() as db:
        result = await db.execute(
            select(Tenant).where(
                Tenant.is_demo.is_(True),
                Tenant.is_active.is_(True),
                (
                    (Tenant.demo_expires_at.isnot(None) & (Tenant.demo_expires_at < now))
                    | (Tenant.demo_expires_at.is_(None) & (Tenant.created_at < legacy_cutoff))
                ),
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


@scheduler.scheduled_job("interval", hours=24, id="onboarding_drip")
async def onboarding_drip():
    """Send day-3 and day-7 onboarding emails to tenants that haven't completed setup."""
    from app.core.mailer import send_email
    from app.core.models import User, UserRole

    now = datetime.now(timezone.utc)
    day3_window = (now - timedelta(days=4), now - timedelta(days=3))
    day7_window = (now - timedelta(days=8), now - timedelta(days=7))

    async with db_session() as db:
        result = await db.execute(
            select(Tenant).where(
                Tenant.is_active.is_(True),
                Tenant.is_demo.is_(False),
            )
        )
        tenants = result.scalars().all()

        for tenant in tenants:
            drip_sent: list[str] = tenant.onboarding_drip_sent or []
            created = tenant.created_at.replace(tzinfo=timezone.utc) if tenant.created_at.tzinfo is None else tenant.created_at

            send_day3 = "day3" not in drip_sent and day3_window[0] <= created < day3_window[1]
            send_day7 = "day7" not in drip_sent and day7_window[0] <= created < day7_window[1]

            if not send_day3 and not send_day7:
                continue

            # Find admin email for this tenant
            admin_result = await db.execute(
                select(User).where(
                    User.tenant_id == tenant.id,
                    User.role == UserRole.admin,
                    User.is_active.is_(True),
                ).order_by(User.created_at).limit(1)
            )
            admin = admin_result.scalar_one_or_none()
            if not admin:
                continue

            # Check which setup gates are incomplete
            email_done = bool(admin.reply_from_email)
            team_result = await db.execute(
                select(func.count(User.id)).where(
                    User.tenant_id == tenant.id,
                    User.is_active.is_(True),
                )
            )
            team_done = (team_result.scalar_one() or 0) > 1
            ticket_result = await db.execute(
                select(func.count(Ticket.id)).where(
                    Ticket.tenant_id == tenant.id,
                    Ticket.status == TicketStatus.closed,
                )
            )
            ticket_done = (ticket_result.scalar_one() or 0) > 0

            missing = []
            if not email_done:
                missing.append("  - Connect your personal email address (Settings → Profile)")
            if not team_done:
                missing.append("  - Invite your team (Settings → Team)")
            if not ticket_done:
                missing.append("  - Handle your first ticket (Inbox → review a draft)")

            if send_day3:
                if missing:
                    subject = f"Getting started with Yippie — {len(missing)} step{'s' if len(missing) > 1 else ''} left"
                    body = (
                        f"Hi {admin.full_name},\n\n"
                        f"You set up {tenant.name} on Yippie 3 days ago — great start!\n\n"
                        f"A few quick things to get the most out of it:\n\n"
                        + "\n".join(missing)
                        + "\n\nThese take less than 5 minutes and make a big difference.\n\n"
                        "Questions? Just reply — a real person reads it.\n\n"
                        "Take back the time that matters,\nTeam Yippie"
                    )
                    try:
                        await send_email(to=admin.email, subject=subject, body=body)
                    except Exception:
                        log.exception("Failed to send day-3 drip to %s", admin.email)
                drip_sent = [*drip_sent, "day3"]
                tenant.onboarding_drip_sent = drip_sent

            if send_day7:
                subject = f"One week on Yippie — tips for {tenant.name}"
                tips = [
                    "  - Use keyboard shortcuts (j/k to move, r to reply, e to close) — Settings → Profile to enable",
                    "  - Set up the Pipeline to track where each customer is in your sales flow",
                    "  - Send a booking link from any contact to let customers pick a time with you",
                ]
                if missing:
                    tips = ["Still to do:"] + ["  " + m.strip() for m in missing] + ["", "Pro tips once you're up:"] + tips
                body = (
                    f"Hi {admin.full_name},\n\n"
                    f"A week in — here's how to get even more out of Yippie:\n\n"
                    + "\n".join(tips)
                    + "\n\nReply any time with questions.\n\n"
                    "Take back the time that matters,\nTeam Yippie"
                )
                try:
                    await send_email(to=admin.email, subject=subject, body=body)
                except Exception:
                    log.exception("Failed to send day-7 drip to %s", admin.email)
                drip_sent = [*drip_sent, "day7"]
                tenant.onboarding_drip_sent = drip_sent

        await db.commit()


def start_scheduler():
    if not scheduler.running:
        scheduler.start()
