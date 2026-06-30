from __future__ import annotations

import json
import uuid
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.models import Tenant, User, UserReminder
from app.modules.activity import service as activity_service
from app.modules.ai.client import ai_completion
from app.modules.contacts.models import Contact
from app.modules.tickets.models import Ticket, TicketComment, TicketStatus

# Action types Jarvis can route to. Mirrors the frontend prefs toggles.
ACTIONS = ("reminder", "contact_note", "ticket_note", "context_query", "navigate", "search")


def _strip_fences(text: str) -> str:
    if text.startswith("```"):
        lines = text.split("\n")
        inner = "\n".join(lines[1:])
        return inner[: inner.rfind("```")].strip() if "```" in inner else inner.strip()
    return text


def _parse_json(text: str, fallback: dict) -> dict:
    try:
        data = json.loads(_strip_fences(text))
        return data if isinstance(data, dict) else fallback
    except (json.JSONDecodeError, ValueError, TypeError):
        return fallback


async def classify(body: str, context_type: str, context_id: str | None, tenant: Tenant) -> dict:
    """Ask the model to classify the captured text into a single routed action."""
    now = datetime.now(timezone.utc)
    context_line = "No record is currently open."
    if context_type == "contact" and context_id:
        context_line = f"A CONTACT is currently open (contact_id={context_id})."
    elif context_type == "ticket" and context_id:
        context_line = f"A TICKET is currently open (ticket_id={context_id})."

    prompt = f"""You are Yip, a quick-capture assistant inside the {tenant.name} customer-service workspace.
The current UTC time is {now.isoformat()}.
{context_line}

Classify this agent input into exactly one action and return ONLY a JSON object (no markdown):
Input: "{body}"

Schema:
{{
  "action": "reminder | contact_note | ticket_note | context_query | navigate | search",
  "body": "text to store (note body, or reminder text) — null when not applicable",
  "remind_at": "ISO 8601 UTC datetime for reminders, else null",
  "search_query": "name or keyword to look up for navigate/search, else null"
}}

Guidance:
- "Remind me ..." / "follow up at ..." -> reminder; resolve relative times against the current UTC time.
- A short note when a contact is open -> contact_note. When a ticket is open -> ticket_note.
- "What do we know about ..." / "show context" with a contact open -> context_query.
- "Find ...", "Open ...", "Go to ...", "Take me to ...", "Show me ..." -> navigate (set search_query to the destination or person/ticket name)."""

    text = await ai_completion([{"role": "user", "content": prompt}], max_tokens=400)
    data = _parse_json(text, {"action": "search", "search_query": body})
    if data.get("action") not in ACTIONS:
        data["action"] = "search"
    return data


async def _resolve_contact(db: AsyncSession, tenant_id: uuid.UUID, raw_id: str | None, name_hint: str | None) -> Contact | None:
    if raw_id:
        try:
            c = await db.get(Contact, uuid.UUID(raw_id))
            if c and c.tenant_id == tenant_id and c.deleted_at is None:
                return c
        except (ValueError, TypeError):
            pass
    if name_hint:
        result = await db.execute(
            select(Contact)
            .where(Contact.tenant_id == tenant_id, Contact.deleted_at.is_(None), Contact.full_name.ilike(f"%{name_hint}%"))
            .limit(1)
        )
        return result.scalar_one_or_none()
    return None


async def _resolve_ticket(db: AsyncSession, tenant_id: uuid.UUID, raw_id: str | None) -> Ticket | None:
    if not raw_id:
        return None
    try:
        t = await db.get(Ticket, uuid.UUID(raw_id))
    except (ValueError, TypeError):
        return None
    if t and t.tenant_id == tenant_id and t.deleted_at is None:
        return t
    return None


async def build_context_summary(db: AsyncSession, tenant: Tenant, contact: Contact) -> dict:
    """Pull a contact's tickets, recent activity and pipeline stage, then summarise."""
    from app.modules.pipeline.models import ContactPipelineEntry, PipelineStage

    tickets_result = await db.execute(
        select(Ticket)
        .where(Ticket.tenant_id == tenant.id, Ticket.contact_id == contact.id, Ticket.deleted_at.is_(None))
        .order_by(Ticket.created_at.desc())
        .limit(10)
    )
    tickets = tickets_result.scalars().all()
    open_tickets = [t for t in tickets if t.status in (TicketStatus.open, TicketStatus.in_progress)]

    stage_row = await db.execute(
        select(PipelineStage.name)
        .join(ContactPipelineEntry, ContactPipelineEntry.stage_id == PipelineStage.id)
        .where(ContactPipelineEntry.contact_id == contact.id, ContactPipelineEntry.tenant_id == tenant.id)
        .limit(1)
    )
    stage_name = stage_row.scalar_one_or_none()

    events = await activity_service.list_events(db, tenant.id, contact_id=contact.id, limit=8)

    facts = {
        "name": contact.full_name,
        "company": contact.company_name,
        "email": contact.email,
        "phone": contact.phone,
        "pipeline_stage": stage_name,
        "open_tickets": len(open_tickets),
        "total_tickets": len(tickets),
        "recent_ticket_subjects": [t.subject for t in tickets[:3]],
        "recent_activity": [e["event_type"] for e in events[:5]],
        "notes": contact.notes,
    }

    prompt = f"""You are Yip, assisting an agent at {tenant.name}.
Using the structured customer data below, write a 2-3 sentence briefing the agent can read at a glance.
Be concrete; mention open tickets, pipeline stage and anything notable. No preamble.

Data:
{json.dumps(facts, default=str)}"""

    summary = await ai_completion([{"role": "user", "content": prompt}], max_tokens=250)

    return {
        "summary": summary,
        "inline_data": {
            "contact_id": str(contact.id),
            "full_name": contact.full_name,
            "email": contact.email,
            "phone": contact.phone,
            "notes": contact.notes,
        },
    }


async def execute(
    db: AsyncSession,
    user: User,
    tenant: Tenant,
    body: str,
    context_type: str,
    context_id: str | None,
    plan: dict,
) -> dict:
    """Run the classified action and return {action_taken, summary, navigate_to?, inline_data?}."""
    action = plan.get("action", "search")
    note_body = (plan.get("body") or body).strip()

    if action == "reminder":
        remind_at = _parse_remind_at(plan.get("remind_at"))
        reminder = UserReminder(
            user_id=user.id,
            tenant_id=tenant.id,
            body=note_body,
            remind_at=remind_at,
        )
        db.add(reminder)
        await db.commit()
        when = remind_at.strftime("%H:%M on %b %d")
        return {"action_taken": "reminder", "summary": f"Reminder set for {when}."}

    if action == "context_query":
        contact = await _resolve_contact(db, tenant.id, context_id, plan.get("search_query"))
        if not contact:
            return {"action_taken": "context_query", "summary": "No matching contact to summarise."}
        result = await build_context_summary(db, tenant, contact)
        return {
            "action_taken": "context_query",
            "summary": result["summary"],
            "inline_data": result["inline_data"],
        }

    if action == "ticket_note" or (context_type == "ticket" and action in ("contact_note", "search")):
        ticket = await _resolve_ticket(db, tenant.id, context_id)
        if not ticket:
            return {"action_taken": "ticket_note", "summary": "No ticket in context for this note."}
        comment = TicketComment(
            tenant_id=tenant.id,
            ticket_id=ticket.id,
            author_id=user.id,
            body=note_body,
            is_internal=True,
        )
        db.add(comment)
        await activity_service.log_event(
            db, tenant.id,
            module="tickets", event_type="ticket_commented", entity_type="ticket",
            entity_id=ticket.id, contact_id=ticket.contact_id, actor_id=user.id,
            payload={"preview": note_body[:100], "source": "jarvis"},
        )
        await db.commit()
        return {"action_taken": "ticket_note", "summary": "Internal note added to the ticket."}

    if action == "contact_note":
        contact = await _resolve_contact(db, tenant.id, context_id, plan.get("search_query"))
        if not contact:
            return {"action_taken": "contact_note", "summary": "No contact in context for this note."}
        await activity_service.log_event(
            db, tenant.id,
            module="contacts", event_type="quick_note", entity_type="contact",
            entity_id=contact.id, contact_id=contact.id, actor_id=user.id,
            payload={"body": note_body, "source": "jarvis"},
        )
        await db.commit()
        return {"action_taken": "contact_note", "summary": f"Note added to {contact.full_name}."}

    # navigate / search — resolve to a destination URL the popup can route to.
    query = (plan.get("search_query") or body).strip()
    nav = await _resolve_navigation(db, tenant.id, query)
    if nav:
        return {"action_taken": "navigate", "summary": nav["label"], "navigate_to": nav["path"]}
    return {"action_taken": "search", "summary": f"Nothing found for \u201c{query}\u201d."}


def _parse_remind_at(raw: str | None) -> datetime:
    now = datetime.now(timezone.utc)
    if not raw:
        return now
    try:
        dt = datetime.fromisoformat(raw.replace("Z", "+00:00"))
    except (ValueError, TypeError):
        return now
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt


_PAGE_ROUTES: list[tuple[tuple[str, ...], str, str]] = [
    (("inbox", "mail", "email", "messages"), "/inbox", "Opening Inbox…"),
    (("contact", "contacts", "people", "customers", "clients"), "/contacts", "Opening Contacts…"),
    (("ticket", "tickets", "support", "issues", "cases"), "/tickets", "Opening Tickets…"),
    (("calendar", "schedule", "appointments", "bookings"), "/calendar", "Opening Calendar…"),
    (("pipeline", "kanban", "deals", "funnel"), "/pipeline", "Opening Pipeline…"),
    (("activity", "feed", "history", "log", "timeline"), "/activity", "Opening Activity…"),
    (("billing", "invoices", "payments"), "/billing", "Opening Billing…"),
    (("chat", "livechat", "live chat", "whatsapp"), "/chat", "Opening Live Chat…"),
    (("marketing", "campaigns", "email campaign"), "/marketing", "Opening Marketing…"),
    (("tracking", "shipment", "shipments", "track"), "/tracking", "Opening Tracking…"),
    (("sales", "analytics", "revenue"), "/sales", "Opening Sales…"),
    (("settings", "admin", "configuration"), "/settings/profile", "Opening Settings…"),
]


async def _resolve_navigation(db: AsyncSession, tenant_id: uuid.UUID, query: str) -> dict | None:
    if not query:
        return None
    q = query.lower().strip()

    # Check page-level keywords before trying record lookup.
    for keywords, path, label in _PAGE_ROUTES:
        if any(kw in q for kw in keywords):
            return {"path": path, "label": label}

    contact = await db.execute(
        select(Contact)
        .where(Contact.tenant_id == tenant_id, Contact.deleted_at.is_(None), Contact.full_name.ilike(f"%{query}%"))
        .limit(1)
    )
    found = contact.scalar_one_or_none()
    if found:
        return {"path": f"/contacts/{found.id}", "label": f"Opening {found.full_name}…"}
    ticket = await db.execute(
        select(Ticket)
        .where(Ticket.tenant_id == tenant_id, Ticket.deleted_at.is_(None), Ticket.subject.ilike(f"%{query}%"))
        .order_by(Ticket.created_at.desc())
        .limit(1)
    )
    t = ticket.scalar_one_or_none()
    if t:
        return {"path": f"/tickets/{t.id}", "label": f"Opening ticket \u201c{t.subject}\u201d\u2026"}
    return None
