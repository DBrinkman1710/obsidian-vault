from __future__ import annotations

import ast
import json
import math
import os
import re
import time
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.models import Tenant, User, UserReminder
from app.modules.activity import service as activity_service
from app.modules.ai.client import ai_completion
from app.modules.contacts.models import Contact
from app.modules.tickets.models import Ticket, TicketComment, TicketStatus

# Action types Jarvis can route to. Mirrors the frontend prefs toggles.
ACTIONS = ("reminder", "contact_note", "ticket_note", "context_query", "navigate", "search", "compose_email", "help", "math")

# ---------------------------------------------------------------------------
# Manual loader — reads user_manual.md from disk and caches for 5 minutes.
# The file lives next to the backend code so it's always at the deployed
# version without needing a GitHub API call.
# ---------------------------------------------------------------------------

_MANUAL_CANDIDATES = [
    Path(__file__).parent.parent.parent.parent / "user_manual.md",   # /app/user_manual.md in Docker
    Path(__file__).parent.parent.parent.parent.parent / "user_manual.md",  # one level up (dev)
]

_manual_cache: str | None = None
_manual_loaded_at: float = 0.0
_MANUAL_TTL = 300  # seconds


def _load_manual() -> str:
    global _manual_cache, _manual_loaded_at
    now = time.monotonic()
    if _manual_cache is not None and (now - _manual_loaded_at) < _MANUAL_TTL:
        return _manual_cache
    for path in _MANUAL_CANDIDATES:
        if path.exists():
            _manual_cache = path.read_text(encoding="utf-8")
            _manual_loaded_at = now
            return _manual_cache
    # Fallback: empty string — Yip will say it has no manual loaded
    return ""


def _build_tenant_context(tenant: Tenant) -> str:
    """Build a short context block from ai_profile to inject into AI prompts."""
    p = tenant.ai_profile or {}
    lines = []
    if p.get("business_description"):
        lines.append(f"Business: {p['business_description']}")
    if p.get("tone"):
        lines.append(f"Tone: {p['tone']}")
    if p.get("common_terms"):
        lines.append(f"Terminology: {p['common_terms']}")
    return "\n".join(lines) if lines else ""


async def synthesise_profile(messages: list, tenant: Tenant) -> dict:
    """Extract structured ai_profile from a Yip training conversation."""
    conversation = "\n".join(f"{m.role.upper()}: {m.content}" for m in messages)
    prompt = f"""Extract a structured AI profile from this onboarding conversation for the workspace "{tenant.name}".

Conversation:
{conversation}

Return ONLY a JSON object with these exact keys:
{{
  "business_description": "one sentence describing what the business does",
  "tone": "formal | friendly | casual",
  "reply_language": "ISO 639-1 code e.g. en, nl, fr",
  "sign_off": "how to sign off replies e.g. 'The Acme Team'",
  "common_terms": "any abbreviations or product terms mentioned, or empty string",
  "faq_context": ""
}}

If a field has no clear answer from the conversation, use sensible defaults (tone=friendly, reply_language=en, sign_off="{tenant.name} Team")."""

    text = await ai_completion([{"role": "user", "content": prompt}], max_tokens=400)
    data = _parse_json(text, {})
    return {
        "business_description": data.get("business_description", ""),
        "tone": data.get("tone", "friendly"),
        "reply_language": data.get("reply_language", "en"),
        "sign_off": data.get("sign_off", f"{tenant.name} Team"),
        "common_terms": data.get("common_terms", ""),
        "faq_context": data.get("faq_context", ""),
    }


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



_ALLOWED_AST_NODES = (
    ast.Expression, ast.BinOp, ast.UnaryOp, ast.Constant,
    ast.Add, ast.Sub, ast.Mult, ast.Div, ast.Pow, ast.Mod, ast.FloorDiv,
    ast.USub, ast.UAdd,
)


def _safe_eval(expr: str):
    """Evaluate simple arithmetic expressions safely using AST.

    Returns a numeric int or float, or None if the expression is not valid
    arithmetic. Bare constants (42, True, 1j) return None so single tokens
    don't shadow note/search/navigate intents in classify().
    """
    if not any(c.isdigit() for c in expr):
        return None
    if len(expr) > 200:
        return None
    # Strip natural language prefix
    expr = re.sub(r'^(?:what\s+is|calculate|compute|how\s+much\s+is)\s+', '', expr.strip(), flags=re.IGNORECASE)
    # Handle digit-adjacent 'x'/'X' as multiplication (e.g. '5x4', '5 x 4', '10x20')
    expr = re.sub(r'(\d)\s*[xX]\s*(\d)', r'\1*\2', expr)
    try:
        tree = ast.parse(expr, mode='eval')
        has_operator = False
        for node in ast.walk(tree):
            if not isinstance(node, _ALLOWED_AST_NODES):
                return None
            if isinstance(node, (ast.BinOp, ast.UnaryOp)):
                has_operator = True
            # Prevent exponentiation towers (e.g. 9**9**9 hangs the event loop):
            # require the right operand of ** to be a small literal constant.
            if isinstance(node, ast.BinOp) and isinstance(node.op, ast.Pow):
                right = node.right
                if not (
                    isinstance(right, ast.Constant)
                    and isinstance(right.value, (int, float))
                    and 0 <= right.value <= 200
                ):
                    return None
        # Bare constants (42, True, 1j) must not short-circuit to math
        if not has_operator:
            return None
        result = eval(compile(tree, '<string>', 'eval'), {'__builtins__': {}}, {})
        # Reject non-numeric results (bool, complex, etc.)
        if isinstance(result, bool) or not isinstance(result, (int, float)):
            return None
        if math.isinf(result) or math.isnan(result):
            return None
        if isinstance(result, float) and result == int(result):
            return int(result)
        if isinstance(result, float):
            return round(result, 6)
        return result
    except Exception:
        return None


async def classify(body: str, context_type: str, context_id: str | None, tenant: Tenant) -> dict:
    """Ask the model to classify the captured text into a single routed action."""
    # Pre-classify math before hitting the LLM — more reliable than asking the model.
    # Store the result so execute() can use it without re-evaluating.
    _math_result = _safe_eval(body)
    if _math_result is not None:
        return {"action": "math", "body": body, "_result": str(_math_result)}

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
  "action": "reminder | contact_note | ticket_note | context_query | navigate | search | compose_email | help | math",
  "body": "the subject/topic only — strip trigger phrases like 'remind me to', 'set a reminder for', 'follow up'. Example: 'remind me to call Jan' → 'call Jan'. 'set a reminder for the meeting at 3pm' → 'meeting'.",
  "remind_at": "ISO 8601 UTC datetime for reminders. For relative times like 'in 5 minutes', add exactly that offset to the current UTC time above. Return null for non-reminders.",
  "search_query": "name or keyword to look up for navigate/search/compose_email, else null"
}}

Guidance:
- "Remind me ..." / "follow up at ..." -> reminder; compute remind_at by adding the stated offset to the current UTC time exactly.
- A short note when a contact is open -> contact_note. When a ticket is open -> ticket_note.
- "What do we know about ..." / "show context" with a contact open -> context_query.
- "Find ...", "Open ...", "Go to ...", "Take me to ...", "Show me ..." -> navigate (set search_query to the destination or person/ticket name).
- "Compose mail to ...", "Send email to ...", "Write mail to ...", "Email ..." -> compose_email (set search_query to the contact name).
- "What can you do", "Help", "How do I ...", "What are your commands" -> help.
- Arithmetic or math ("what is 5*15", "20% of 300", "square root of 144") -> math (put the raw expression in body)."""

    tenant_ctx = _build_tenant_context(tenant)
    if tenant_ctx:
        prompt += f"\n\nWorkspace context:\n{tenant_ctx}"

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

    tone = (tenant.ai_profile or {}).get("tone", "friendly")
    prompt = f"""You are Yip, assisting an agent at {tenant.name}.
Using the structured customer data below, write a 2-3 sentence briefing the agent can read at a glance.
Be concrete; mention open tickets, pipeline stage and anything notable. No preamble.
Use a {tone} tone.

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
        remind_at = _parse_remind_at(plan.get("remind_at"), body)
        # Strip trigger phrases the AI may have left in the body
        clean = re.sub(
            r'^(?:remind(?:er)?\s+me\s+(?:to\s+)?|set\s+a\s+reminder\s+(?:for\s+)?)',
            '', note_body, flags=re.IGNORECASE,
        ).strip() or note_body
        # Also strip trailing time phrases like "at 3pm today / tomorrow at 9am / in 1 minute"
        clean = re.sub(
            r'\s+(?:at\s+\d{1,2}(?::\d{2})?\s*(?:am|pm)?(?:\s+(?:today|tomorrow|on\s+\w+))?'
            r'|(?:today|tomorrow)\s+at\s+\d{1,2}(?::\d{2})?\s*(?:am|pm)?'
            r'|in\s+\d+\s*(?:minute|min|hour|hr|day|week)s?'
            r'|next\s+\w+\s+at\s+\d{1,2}(?::\d{2})?\s*(?:am|pm)?)\s*$',
            '', clean, flags=re.IGNORECASE,
        ).strip() or clean
        reminder = UserReminder(
            user_id=user.id,
            tenant_id=tenant.id,
            body=clean,
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

    if action == "math":
        # Use the result pre-computed by classify() when available — avoids double eval.
        pre_result = plan.get("_result")
        if pre_result is not None:
            return {"action_taken": "math", "summary": pre_result}
        expr = (plan.get("body") or body).strip()
        result = _safe_eval(expr)
        if result is not None:
            return {"action_taken": "math", "summary": str(result)}
        # Fall back to AI for complex/textual expressions (e.g. "sqrt(144)")
        answer = await ai_completion(
            [{"role": "user", "content": f"Compute and return ONLY the numeric answer, no explanation: {expr}"}],
            max_tokens=32,
        )
        return {"action_taken": "math", "summary": answer.strip()}

    if action == "help":
        manual = _load_manual()
        if manual:
            system_msg = (
                "You are Yip, a helpful AI assistant inside the Yippie customer service platform. "
                "Answer the user's question using ONLY the platform manual provided below. "
                "Be concise \u2014 2-5 sentences max. If the answer is not in the manual, say so briefly.\n\n"
                f"MANUAL:\n{manual}"
            )
            answer = await ai_completion(
                [{"role": "system", "content": system_msg}, {"role": "user", "content": body}],
                max_tokens=300,
            )
            return {"action_taken": "help", "summary": answer.strip()}
        # Fallback when manual file is unavailable
        lines = [
            "Here's what I can do:",
            "\u2022 Set reminders \u2014 \"remind me to call Jan at 3pm\"",
            "\u2022 Add notes \u2014 \"make a note: client prefers phone calls\"",
            "\u2022 Look up a contact \u2014 \"what do we know about Guus Stuiver\"",
            "\u2022 Navigate \u2014 \"take me to tickets\" or \"open Acme BV\"",
            "\u2022 Compose email \u2014 \"compose mail to Guus Stuiver\"",
            "\u2022 Math \u2014 \"what is 5*15\"",
            "Just type naturally and I'll figure out the rest.",
        ]
        return {"action_taken": "help", "summary": "\n".join(lines)}

    if action == "compose_email":
        query = (plan.get("search_query") or body).strip()
        contact = await _resolve_contact(db, tenant.id, None, query)
        if contact and contact.email:
            return {
                "action_taken": "compose_email",
                "summary": f"Opening compose for {contact.full_name}.",
                "inline_data": {"email": contact.email, "name": contact.full_name},
            }
        if contact:
            return {
                "action_taken": "compose_email",
                "summary": f"{contact.full_name} has no email address on file.",
                "inline_data": None,
            }
        return {
            "action_taken": "compose_email",
            "summary": f"No contact found matching “{query}”.",
            "inline_data": None,
        }

    # navigate / search — resolve to a destination URL the popup can route to.
    query = (plan.get("search_query") or body).strip()
    nav = await _resolve_navigation(db, tenant.id, query)
    if nav:
        return {"action_taken": "navigate", "summary": nav["label"], "navigate_to": nav["path"]}
    return {"action_taken": "search", "summary": f"Nothing found for \u201c{query}\u201d."}


_REL_TIME = re.compile(
    r'\bin\s+(\d+(?:\.\d+)?)\s*(minute|min|hour|hr|day|week)s?\b',
    re.IGNORECASE,
)

def _parse_relative_time(body: str) -> datetime | None:
    """Parse 'in X minutes/hours/days/weeks' from the raw input string."""
    m = _REL_TIME.search(body)
    if not m:
        return None
    amount = float(m.group(1))
    unit = m.group(2).lower()
    now = datetime.now(timezone.utc)
    if unit in ("minute", "min"):
        return now + timedelta(minutes=amount)
    if unit in ("hour", "hr"):
        return now + timedelta(hours=amount)
    if unit == "day":
        return now + timedelta(days=amount)
    if unit == "week":
        return now + timedelta(weeks=amount)
    return None


def _parse_remind_at(raw: str | None, original_body: str = "") -> datetime:
    """Parse the AI-supplied ISO datetime; fall back to server-side relative-time parsing."""
    now = datetime.now(timezone.utc)

    # Server-side parse first for relative expressions — always exact
    server_dt = _parse_relative_time(original_body)
    if server_dt and server_dt > now:
        return server_dt

    if not raw:
        return now
    try:
        dt = datetime.fromisoformat(raw.replace("Z", "+00:00"))
    except (ValueError, TypeError):
        return now
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    # Sanity-check: reject past times and times more than 1 year out
    if dt <= now or dt > now + timedelta(days=365):
        return now
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
