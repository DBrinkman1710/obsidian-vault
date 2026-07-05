"""Unified customer context — the single place a contact's full history is assembled.

Architecture decision (Customer data + AI briefing, 2026-07-05): full contact
history is NOT copied into a separate store. It lives in the module-owned,
RLS-isolated Postgres tables; this module is the canonical read-side aggregator
on top of them. Every AI surface (inbox briefing, ticket briefing / suggest /
improve reply, Yip's contact briefing) consumes `build_customer_context()` so
they all see the same complete picture. Sections are gated by the tenant's
`enabled_modules` — a tenant without the billing module never has billing data
pulled or leaked into prompts. The pgvector/embedding memory layer planned for
[AI-MOD1] Phase 2 will slot in behind this same function.
"""
from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone
from typing import Optional, TYPE_CHECKING

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

if TYPE_CHECKING:
    from app.core.models import Tenant
    from app.modules.contacts.models import Contact

log = logging.getLogger(__name__)

# How many rows each section contributes — keep the prompt block compact.
RECENT_TICKETS = 10
RECENT_CHATS = 3
RECENT_PRODUCT_EVENTS = 5
ACTIVE_SHIPMENTS = 3
UPCOMING_EVENTS = 3
RECENT_ACTIVITY = 8
UPCOMING_WINDOW_DAYS = 14


def _has(tenant: "Tenant", module: str) -> bool:
    return module in (tenant.enabled_modules or [])


async def build_customer_context(
    db: AsyncSession, tenant: "Tenant", contact: Optional["Contact"]
) -> Optional[dict]:
    """Assemble a contact's complete cross-module history into one dict.

    Returns None for unknown senders (no matching contact). Each section that
    depends on an optional module is only queried when the tenant has that
    module enabled; a section that fails never sinks the whole briefing.
    """
    if contact is None:
        return None

    tenant_id = tenant.id
    ctx: dict = {
        "profile": {
            "name": contact.full_name,
            "email": contact.email,
            "phone": contact.phone,
            "company": contact.company_name,
            "tags": contact.tags or [],
            "labels": [l.name for l in (contact.labels or [])],
            "notes": contact.notes,
            "engagement_score": contact.engagement_score,
            "customer_since": contact.created_at.date().isoformat() if contact.created_at else None,
        }
    }

    # Tickets — the support backbone; tickets is a near-universal module.
    if _has(tenant, "tickets"):
        try:
            from app.modules.tickets.models import Ticket, TicketStatus

            result = await db.execute(
                select(Ticket)
                .where(
                    Ticket.tenant_id == tenant_id,
                    Ticket.contact_id == contact.id,
                    Ticket.deleted_at.is_(None),
                )
                .order_by(Ticket.created_at.desc())
                .limit(RECENT_TICKETS)
            )
            tickets = result.scalars().all()
            total = await db.scalar(
                select(func.count()).select_from(Ticket).where(
                    Ticket.tenant_id == tenant_id,
                    Ticket.contact_id == contact.id,
                    Ticket.deleted_at.is_(None),
                )
            )
            ctx["tickets"] = {
                "total": int(total or 0),
                "open": sum(1 for t in tickets if t.status in (TicketStatus.open, TicketStatus.in_progress)),
                "recent": [
                    {
                        "subject": t.subject,
                        "status": t.status.value,
                        "priority": t.priority.value,
                        "created_at": t.created_at.date().isoformat() if t.created_at else None,
                    }
                    for t in tickets
                ],
            }
        except Exception:
            log.exception("customer_context: tickets section failed for contact %s", contact.id)

    # Pipeline stage
    if _has(tenant, "pipeline"):
        try:
            from app.modules.pipeline.models import ContactPipelineEntry, PipelineStage

            stage = await db.scalar(
                select(PipelineStage.name)
                .join(ContactPipelineEntry, ContactPipelineEntry.stage_id == PipelineStage.id)
                .where(
                    ContactPipelineEntry.contact_id == contact.id,
                    ContactPipelineEntry.tenant_id == tenant_id,
                )
                .limit(1)
            )
            ctx["pipeline_stage"] = stage
        except Exception:
            log.exception("customer_context: pipeline section failed for contact %s", contact.id)

    # Billing — subscription + outstanding invoices
    if _has(tenant, "billing"):
        try:
            from app.modules.billing.models import Invoice, InvoiceStatus, Subscription

            sub = await db.scalar(
                select(Subscription)
                .where(Subscription.tenant_id == tenant_id, Subscription.contact_id == contact.id)
                .order_by(Subscription.started_at.desc())
                .limit(1)
            )
            if sub:
                outstanding = await db.scalar(
                    select(func.count()).select_from(Invoice).where(
                        Invoice.tenant_id == tenant_id,
                        Invoice.contact_id == contact.id,
                        Invoice.status.in_([InvoiceStatus.sent, InvoiceStatus.overdue]),
                    )
                )
                ctx["billing"] = {
                    "plan_name": sub.plan_name,
                    "status": sub.status.value,
                    "billing_cycle": sub.billing_cycle.value,
                    "amount_cents": sub.amount_cents,
                    "currency": sub.currency,
                    "outstanding_invoices": int(outstanding or 0),
                }
        except Exception:
            log.exception("customer_context: billing section failed for contact %s", contact.id)

    # Live chat / WhatsApp conversations
    if _has(tenant, "chat"):
        try:
            from app.modules.chat.models import ChatSession

            result = await db.execute(
                select(ChatSession)
                .where(ChatSession.tenant_id == tenant_id, ChatSession.contact_id == contact.id)
                .order_by(ChatSession.started_at.desc())
                .limit(RECENT_CHATS)
            )
            sessions = result.scalars().all()
            if sessions:
                total = await db.scalar(
                    select(func.count()).select_from(ChatSession).where(
                        ChatSession.tenant_id == tenant_id, ChatSession.contact_id == contact.id
                    )
                )
                ctx["chat"] = {
                    "total_sessions": int(total or 0),
                    "recent": [
                        {
                            "source": s.source,
                            "status": s.status,
                            "started_at": s.started_at.date().isoformat() if s.started_at else None,
                        }
                        for s in sessions
                    ],
                }
        except Exception:
            log.exception("customer_context: chat section failed for contact %s", contact.id)

    # Email engagement — outbound_emails is inbox infrastructure, always available.
    try:
        from app.modules.emailtracking.models import OutboundEmail

        row = (
            await db.execute(
                select(
                    func.count(OutboundEmail.id),
                    func.count(OutboundEmail.opened_at),
                    func.count(OutboundEmail.clicked_at),
                    func.max(OutboundEmail.opened_at),
                ).where(
                    OutboundEmail.tenant_id == tenant_id,
                    OutboundEmail.contact_id == contact.id,
                )
            )
        ).one()
        sent, opened, clicked, last_opened = row
        if sent:
            ctx["email_engagement"] = {
                "emails_sent": int(sent),
                "opened": int(opened),
                "clicked": int(clicked),
                "last_opened_at": last_opened.date().isoformat() if last_opened else None,
            }
    except Exception:
        log.exception("customer_context: email engagement section failed for contact %s", contact.id)

    # SaaS product usage — health score + recent events
    if _has(tenant, "saas"):
        try:
            from app.modules.saas.models import SaasEvent, SaasHealth

            health = await db.scalar(
                select(SaasHealth).where(
                    SaasHealth.tenant_id == tenant_id, SaasHealth.contact_id == contact.id
                )
            )
            events_result = await db.execute(
                select(SaasEvent.event_type, SaasEvent.created_at)
                .where(SaasEvent.tenant_id == tenant_id, SaasEvent.contact_id == contact.id)
                .order_by(SaasEvent.created_at.desc())
                .limit(RECENT_PRODUCT_EVENTS)
            )
            events = events_result.all()
            if health or events:
                ctx["product_usage"] = {
                    "health_score": health.score if health else None,
                    "last_active": events[0][1].date().isoformat() if events else None,
                    "recent_events": [e[0] for e in events],
                }
        except Exception:
            log.exception("customer_context: saas section failed for contact %s", contact.id)

    # Active shipments (track & trace)
    if _has(tenant, "tracking"):
        try:
            from app.modules.shipments.models import Shipment, ShipmentStatus

            result = await db.execute(
                select(Shipment)
                .where(
                    Shipment.tenant_id == tenant_id,
                    Shipment.contact_id == contact.id,
                    Shipment.deleted_at.is_(None),
                    Shipment.status.notin_((ShipmentStatus.delivered, ShipmentStatus.cancelled)),
                )
                .order_by(Shipment.created_at.desc())
                .limit(ACTIVE_SHIPMENTS)
            )
            shipments = result.scalars().all()
            if shipments:
                ctx["shipments"] = [
                    {
                        "tracking_number": s.tracking_number,
                        "carrier": s.carrier.value,
                        "status": s.status.value,
                        "last_event": s.last_event_description,
                        "estimated_delivery": s.estimated_delivery.date().isoformat() if s.estimated_delivery else None,
                    }
                    for s in shipments
                ]
        except Exception:
            log.exception("customer_context: shipments section failed for contact %s", contact.id)

    # Upcoming meetings / bookings
    if _has(tenant, "calendar"):
        try:
            from app.modules.calendar.models import CalendarEvent

            now = datetime.now(timezone.utc)
            result = await db.execute(
                select(CalendarEvent.title, CalendarEvent.start_at)
                .where(
                    CalendarEvent.tenant_id == tenant_id,
                    CalendarEvent.contact_id == contact.id,
                    CalendarEvent.start_at >= now,
                    CalendarEvent.start_at <= now + timedelta(days=UPCOMING_WINDOW_DAYS),
                )
                .order_by(CalendarEvent.start_at.asc())
                .limit(UPCOMING_EVENTS)
            )
            events = result.all()
            if events:
                ctx["upcoming_events"] = [
                    {"title": title, "start_at": start.isoformat()} for title, start in events
                ]
        except Exception:
            log.exception("customer_context: calendar section failed for contact %s", contact.id)

    # Recent activity timeline (quick notes, pipeline moves, emails, …)
    if _has(tenant, "activity"):
        try:
            from app.modules.activity import service as activity_service

            events = await activity_service.list_events(
                db, tenant_id, contact_id=contact.id, limit=RECENT_ACTIVITY
            )
            if events:
                ctx["recent_activity"] = [e["event_type"] for e in events]
        except Exception:
            log.exception("customer_context: activity section failed for contact %s", contact.id)

    return ctx


def render_context_block(ctx: Optional[dict]) -> str:
    """Render the context dict as a compact plain-text block for AI prompts."""
    if not ctx:
        return "Unknown sender — no matching contact found."

    p = ctx.get("profile", {})
    lines = [
        f"Name: {p.get('name')}",
        f"Company: {p.get('company') or 'N/A'}",
        f"Email: {p.get('email') or 'N/A'}",
        f"Phone: {p.get('phone') or 'N/A'}",
    ]
    badges = list(p.get("labels") or []) + list(p.get("tags") or [])
    if badges:
        lines.append(f"Labels: {', '.join(badges)}")
    if p.get("customer_since"):
        lines.append(f"Customer since: {p['customer_since']}")
    if ctx.get("pipeline_stage"):
        lines.append(f"Pipeline stage: {ctx['pipeline_stage']}")
    if p.get("notes"):
        lines.append(f"Notes: {p['notes']}")

    t = ctx.get("tickets")
    if t:
        lines.append(f"\nTICKETS: {t['total']} total, {t['open']} open. Recent (newest first):")
        lines += [
            f"- [{r['status'].upper()}] {r['subject']} ({r['priority']} priority, {r['created_at']})"
            for r in t["recent"][:5]
        ] or ["- none"]
    else:
        lines.append("\nTICKETS: no previous tickets.")

    b = ctx.get("billing")
    if b:
        lines.append(
            f"\nBILLING: {b['plan_name']} — {b['status']} ({b['billing_cycle']}), "
            f"{b['amount_cents'] / 100:.2f} {b['currency']}, "
            f"{b['outstanding_invoices']} outstanding invoice(s)"
        )

    c = ctx.get("chat")
    if c:
        recent = "; ".join(f"{s['source']} {s['status']} {s['started_at']}" for s in c["recent"])
        lines.append(f"\nLIVE CHAT: {c['total_sessions']} session(s). Recent: {recent}")

    e = ctx.get("email_engagement")
    if e:
        lines.append(
            f"\nEMAIL ENGAGEMENT: {e['emails_sent']} sent, {e['opened']} opened, "
            f"{e['clicked']} clicked" + (f", last opened {e['last_opened_at']}" if e["last_opened_at"] else "")
        )

    u = ctx.get("product_usage")
    if u:
        score = f"health score {u['health_score']}/100" if u["health_score"] is not None else "no health score yet"
        lines.append(
            f"\nPRODUCT USAGE: {score}"
            + (f", last active {u['last_active']}" if u["last_active"] else "")
            + (f". Recent events: {', '.join(u['recent_events'])}" if u["recent_events"] else "")
        )

    s = ctx.get("shipments")
    if s:
        lines.append("\nACTIVE SHIPMENTS:")
        lines += [
            f"- {sh['carrier']} {sh['tracking_number'] or '(no tracking nr)'}: {sh['status']}"
            + (f" — {sh['last_event']}" if sh["last_event"] else "")
            + (f" (ETA {sh['estimated_delivery']})" if sh["estimated_delivery"] else "")
            for sh in s
        ]

    ue = ctx.get("upcoming_events")
    if ue:
        lines.append("\nUPCOMING MEETINGS: " + "; ".join(f"{ev['title']} at {ev['start_at']}" for ev in ue))

    a = ctx.get("recent_activity")
    if a:
        lines.append(f"\nRECENT ACTIVITY: {', '.join(a)}")

    return "\n".join(lines)
