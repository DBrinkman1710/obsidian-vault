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

from app.core.models import Tenant
from app.modules.activity import service as activity_service
from app.modules.ai.client import ai_completion
from app.modules.contacts.models import Contact
from app.modules.tickets.models import Ticket, TicketStatus

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
    don't shadow note/search/navigate intents in the agent's math fast-path.
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


async def collect_contact_facts(db: AsyncSession, tenant: Tenant, contact: Contact) -> dict:
    """Pull a contact's tickets, recent activity and pipeline stage into a facts dict."""
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

    return {
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
