"""
Runs on a schedule (APScheduler) — escalates overdue tickets and auto-closes stale ones.
Start it alongside uvicorn by importing and calling `start_scheduler()` from main.py lifespan.
"""
from __future__ import annotations

import logging
import re
from datetime import datetime, timedelta, timezone

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from sqlalchemy import func, select, update

from app.core.models import Tenant
from app.core.scheduler_lock import skip_if_locked
from app.database import db_session
from app.modules.tickets.models import Ticket, TicketPriority, TicketStatus

log = logging.getLogger(__name__)
scheduler = AsyncIOScheduler()


@scheduler.scheduled_job("interval", minutes=5, id="sla_escalation", max_instances=1, coalesce=True)
async def escalate_overdue_tickets():
    if await skip_if_locked("sla_escalation", ttl=270):
        return
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


@scheduler.scheduled_job("interval", hours=1, id="auto_close", max_instances=1, coalesce=True)
async def auto_close_stale_tickets():
    if await skip_if_locked("auto_close", ttl=3300):
        return
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


def _demo_cta_urls(company_name: str, questionnaire_json: str) -> tuple[str, str]:
    """Build Book-a-Call and Sign-Up URLs for demo outreach emails."""
    import json
    from app.auth.tokens import create_signed_token
    from app.config import get_settings
    settings = get_settings()
    owner_slug = settings.owner_slug or "yippie"
    app_base = settings.client_base_url or settings.effective_base_url
    site_base = settings.site_base_url or "https://getyippie.com"
    book_url = f"{app_base}/meet/{owner_slug}"
    token = create_signed_token(
        "demo_outreach",
        timedelta(days=30),
        company_name=company_name,
        questionnaire=questionnaire_json,
    )
    signup_url = f"{site_base}/signup?token={token}"
    return book_url, signup_url


async def _get_demo_tenant_admin_email(db, tenant_id) -> tuple[str, str] | None:
    from app.core.models import User, UserRole
    row = await db.scalar(
        select(User).where(
            User.tenant_id == tenant_id,
            User.role == UserRole.admin,
            User.is_active.is_(True),
        ).order_by(User.created_at).limit(1)
    )
    return (row.email, row.full_name) if row else None


async def _send_demo_prospect_email(
    prospect_email: str,
    prospect_name: str,
    company_name: str,
    subject: str,
    intro_html: str,
    book_url: str,
    signup_url: str,
) -> None:
    import html as _html
    from app.core.email_html import render_email_html
    from app.core.mailer import send_email
    plain_name = prospect_name.split()[0] if prospect_name else company_name
    safe_name = _html.escape(plain_name)
    safe_book = _html.escape(book_url)
    safe_signup = _html.escape(signup_url)
    intro_plain = re.sub(r"<[^>]+>", "", intro_html)
    intro_plain = re.sub(r"[ \t]+", " ", intro_plain).strip()
    plain = (
        f"Hi {plain_name},\n\n{intro_plain}\n\n"
        f"Book a call: {book_url}\nStart your account: {signup_url}\n\n"
        f"Best,\nDiederik\nFounder, Yippie"
    )
    prerendered = (
        f'<p style="margin:0 0 16px;">Hi {safe_name},</p>'
        f'{intro_html}'
        f'<div style="text-align:center;margin:32px 0;">'
        f'<a href="{safe_book}" style="display:inline-block;background:#5BA4F5;color:#fff;'
        f'text-decoration:none;padding:13px 28px;border-radius:8px;font-weight:600;font-size:15px;margin-right:12px;">'
        f'Book a call</a>'
        f'<a href="{safe_signup}" style="display:inline-block;background:#22c55e;color:#fff;'
        f'text-decoration:none;padding:13px 28px;border-radius:8px;font-weight:600;font-size:15px;">'
        f'Start your account</a>'
        f'</div>'
        f'<p style="margin:16px 0 0;">Best,<br><strong>Diederik</strong><br>'
        f'<span style="color:#6b7280;font-size:13px;">Founder, Yippie</span></p>'
    )
    await send_email(
        to=prospect_email,
        subject=subject,
        body=plain,
        html=render_email_html(plain, prerendered_html=prerendered, tenant_name="Yippie"),
        from_email="Diederik from Yippie <diederik@getyippie.com>",
        reply_to="diederik@getyippie.com",
    )



async def _get_prospect_questionnaire(db, prospect_email: str) -> str:
    """Return the contact's custom_fields JSON from the root tenant, or '{}' if not found."""
    import json
    from app.config import get_settings
    from app.modules.contacts.models import Contact
    settings = get_settings()
    owner_slug = settings.owner_slug or "yippie"
    root_tenant = await db.scalar(
        select(Tenant).where(Tenant.slug == owner_slug)
    )
    if root_tenant is None:
        return "{}"
    contact = await db.scalar(
        select(Contact).where(
            Contact.tenant_id == root_tenant.id,
            Contact.email == prospect_email,
        ).limit(1)
    )
    if contact is None or not contact.custom_fields:
        return "{}"
    return json.dumps(contact.custom_fields)


@scheduler.scheduled_job("interval", hours=1, id="demo_nudge_check", max_instances=1, coalesce=True)
async def demo_nudge_check():
    """Day-3 check-in email to prospects who haven't converted yet."""
    if await skip_if_locked("demo_nudge_check", ttl=3300):
        return
    from app.core.models import Tenant
    now = datetime.now(timezone.utc)
    nudge_cutoff = now - timedelta(days=3)
    async with db_session() as db:
        result = await db.execute(
            select(Tenant).where(
                Tenant.is_demo.is_(True),
                Tenant.is_active.is_(True),
                Tenant.demo_nudge_sent_at.is_(None),
                Tenant.created_at < nudge_cutoff,
            )
        )
        tenants = result.scalars().all()
        for tenant in tenants:
            admin = await _get_demo_tenant_admin_email(db, tenant.id)
            if not admin:
                log.warning("No admin email found for demo tenant %s — skipping nudge", tenant.id)
                continue
            prospect_email, prospect_full_name = admin
            questionnaire_json = await _get_prospect_questionnaire(db, prospect_email)
            book_url, signup_url = _demo_cta_urls(tenant.name, questionnaire_json)
            intro = (
                '<p style="margin:0 0 16px;">Just checking in. Have you had a chance to look around '
                'your Yippie workspace yet?</p>'
                '<p style="margin:0 0 16px;">If you have any questions or would like a quick walkthrough, '
                "I'm happy to jump on a call. Or if you're ready to get started, you can sign up directly below.</p>"
            )
            try:
                await _send_demo_prospect_email(
                    prospect_email=prospect_email,
                    prospect_name=prospect_full_name,
                    company_name=tenant.name,
                    subject=f"Have you had time to explore Yippie, {prospect_full_name.split()[0]}?",
                    intro_html=intro,
                    book_url=book_url,
                    signup_url=signup_url,
                )
                tenant.demo_nudge_sent_at = now  # only mark sent if email succeeded
            except Exception:
                log.exception("Failed to send day-3 nudge to %s", prospect_email)
        if tenants:
            await db.commit()


@scheduler.scheduled_job("interval", hours=1, id="demo_expiry_check", max_instances=1, coalesce=True)
async def demo_expiry_check():
    """Deactivate demo tenants past demo_expires_at and notify the platform owner."""
    if await skip_if_locked("demo_expiry_check", ttl=3300):
        return
    import os

    from app.core.mailer import send_email
    from app.core.models import Tenant

    admin_email = os.getenv("ADMIN_EMAIL", "")
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
            # Notify admin
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
                log.exception("Failed to send demo-expiry admin email for %s", tenant.slug)
            # Email the prospect with Book a Call + Sign Up
            admin = await _get_demo_tenant_admin_email(db, tenant.id)
            if admin:
                prospect_email, prospect_full_name = admin
                questionnaire_json = await _get_prospect_questionnaire(db, prospect_email)
                book_url, signup_url = _demo_cta_urls(tenant.name, questionnaire_json)
                intro = (
                    '<p style="margin:0 0 16px;">Your Yippie trial has ended. I hope you got a good feel for the product.</p>'
                    '<p style="margin:0 0 16px;">I\'d love to hear what you thought: what worked, what didn\'t, '
                    'and whether there\'s anything I can improve. Feel free to reply directly to this email.</p>'
                    '<p style="margin:0 0 16px;">If you\'re ready to continue, you can book a call or start your account below.</p>'
                )
                try:
                    await _send_demo_prospect_email(
                        prospect_email=prospect_email,
                        prospect_name=prospect_full_name,
                        company_name=tenant.name,
                        subject=f"How was your Yippie trial, {prospect_full_name.split()[0]}?",
                        intro_html=intro,
                        book_url=book_url,
                        signup_url=signup_url,
                    )
                except Exception:
                    log.exception("Failed to send demo-expiry prospect email to %s", prospect_email)
        if tenants:
            await db.commit()


@scheduler.scheduled_job("interval", hours=1, id="subscription_expiry_check", max_instances=1, coalesce=True)
async def subscription_expiry_check():
    """Deactivate paid tenants whose subscription_ends_at has passed."""
    if await skip_if_locked("subscription_expiry_check", ttl=3300):
        return
    import os

    from app.core.mailer import send_email
    from app.core.models import Tenant

    admin_email = os.getenv("ADMIN_EMAIL", "")
    now = datetime.now(timezone.utc)
    async with db_session() as db:
        result = await db.execute(
            select(Tenant).where(
                Tenant.is_demo.is_(False),
                Tenant.is_active.is_(True),
                Tenant.subscription_ends_at.isnot(None),
                Tenant.subscription_ends_at < now,
            )
        )
        tenants = result.scalars().all()
        for tenant in tenants:
            tenant.is_active = False
            log.info("Deactivated tenant %s (%s) — subscription ended %s", tenant.name, tenant.slug, tenant.subscription_ends_at)
            try:
                await send_email(
                    to=admin_email,
                    subject=f"Subscription ended: {tenant.name}",
                    body=(
                        f"Subscription ended for {tenant.name} ({tenant.slug}). "
                        f"Tenant deactivated at {now.isoformat()}."
                    ),
                )
            except Exception:
                log.exception("Failed to send subscription-expiry admin email for %s", tenant.slug)
        if tenants:
            await db.commit()


@scheduler.scheduled_job("interval", hours=1, id="contact_retention_purge", max_instances=1, coalesce=True)
async def contact_retention_purge():
    """Hard-delete contacts that have been soft-deleted for more than 30 days."""
    if await skip_if_locked("contact_retention_purge", ttl=3300):
        return
    from app.modules.contacts import service as contacts_service

    async with db_session() as db:
        count = await contacts_service.purge_old_deleted_contacts(db)
        if count:
            log.info("Purged %d contact(s) older than 30 days", count)


@scheduler.scheduled_job("interval", hours=24, id="onboarding_drip", max_instances=1, coalesce=True)
async def onboarding_drip():
    """Send day-3 and day-7 onboarding emails to tenants that haven't completed setup."""
    if await skip_if_locked("onboarding_drip", ttl=82800):
        return
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
                Tenant.created_at >= now - timedelta(days=8),
                Tenant.created_at < now - timedelta(days=3),
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
                    Ticket.deleted_at.is_(None),
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
                    from app.core.email_html import render_email_html
                    from app.core.mailer import send_email
                    subject = f"Getting started with Yippie: {len(missing)} step{'s' if len(missing) > 1 else ''} left"
                    body = (
                        f"Hi {admin.full_name},\n\n"
                        f"You set up {tenant.name} on Yippie 3 days ago. Great start!\n\n"
                        f"A few quick things to get the most out of it:\n\n"
                        + "\n".join(missing)
                        + "\n\nThese take less than 5 minutes and make a big difference.\n\n"
                        "Questions? Just reply. A real person reads it.\n\n"
                        "Take back the time that matters,\nTeam Yippie"
                    )
                    html = render_email_html(body, subject)
                    try:
                        await send_email(to=admin.email, subject=subject, body=body, html=html)
                        drip_sent = [*drip_sent, "day3"]
                        tenant.onboarding_drip_sent = drip_sent
                    except Exception:
                        log.exception("Failed to send day-3 drip to %s", admin.email)

            if send_day7:
                from app.core.email_html import render_email_html
                from app.core.mailer import send_email
                subject = f"One week on Yippie: tips for {tenant.name}"
                tips = [
                    "  - Use keyboard shortcuts (j/k to move, r to reply, e to close). Enable in Settings → Profile.",
                    "  - Set up the Pipeline to track where each customer is in your sales flow",
                    "  - Send a booking link from any contact to let customers pick a time with you",
                ]
                if missing:
                    tips = ["Still to do:"] + ["  " + m.strip() for m in missing] + ["", "Pro tips once you're up:"] + tips
                body = (
                    f"Hi {admin.full_name},\n\n"
                    f"A week in. Here's how to get even more out of Yippie:\n\n"
                    + "\n".join(tips)
                    + "\n\nReply any time with questions.\n\n"
                    "Take back the time that matters,\nTeam Yippie"
                )
                html = render_email_html(body, subject)
                try:
                    await send_email(to=admin.email, subject=subject, body=body, html=html)
                    drip_sent = [*drip_sent, "day7"]
                    tenant.onboarding_drip_sent = drip_sent
                except Exception:
                    log.exception("Failed to send day-7 drip to %s", admin.email)

        await db.commit()


@scheduler.scheduled_job("interval", hours=24, id="invoice_overdue_check", max_instances=1, coalesce=True)
async def mark_overdue_invoices():
    """Flip sent invoices to overdue once their due_date has passed."""
    if await skip_if_locked("invoice_overdue_check", ttl=82800):
        return
    from app.modules.billing.models import Invoice, InvoiceStatus

    today = datetime.now(timezone.utc).date()
    async with db_session() as db:
        result = await db.execute(
            select(Invoice).where(
                Invoice.status == InvoiceStatus.sent,
                Invoice.due_date < today,
            )
        )
        invoices = result.scalars().all()
        for inv in invoices:
            inv.status = InvoiceStatus.overdue
            log.info("Marked invoice %s (%s) as overdue", inv.invoice_number, inv.id)
        if invoices:
            await db.commit()


@scheduler.scheduled_job("interval", minutes=5, id="external_calendar_sync", max_instances=1, coalesce=True)
async def sync_external_calendars():
    """Refresh iCal feeds (Apple Calendar, Outlook) for all active users across all tenants."""
    if await skip_if_locked("external_calendar_sync", ttl=270):
        return
    from app.modules.external_calendar.service import sync_all_active_feeds

    async with db_session() as db:
        await sync_all_active_feeds(db)


def start_scheduler():
    if not scheduler.running:
        scheduler.start()
