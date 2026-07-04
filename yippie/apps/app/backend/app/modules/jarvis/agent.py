"""Yip agent loop — tool-calling assistant that replaces the classify/execute router.

The model receives the workspace context (tenant profile, current screen, user
memories) in the system prompt plus a set of tools. It loops: call tools → read
results → call more tools or answer. Every tool executor is tenant-filtered
server-side; the model never touches the DB directly.
"""
from __future__ import annotations

import json
import uuid
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.models import AssistantMemory, Tenant, User, UserReminder
from app.modules.activity import service as activity_service
from app.modules.ai.client import ai_completion_tools
from app.modules.contacts.models import Contact
from app.modules.jarvis import service
from app.modules.tickets.models import Ticket, TicketComment

MAX_ITERATIONS = 8
MAX_MEMORIES = 30
MAX_HISTORY = 12

TOOL_DEFS: list[dict] = [
    {
        "type": "function",
        "function": {
            "name": "search_contacts",
            "description": "Search the workspace's contacts by name, email or company. Returns up to 5 matches.",
            "parameters": {
                "type": "object",
                "properties": {"query": {"type": "string", "description": "Name, email or company fragment"}},
                "required": ["query"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_contact_briefing",
            "description": "Get everything known about one contact: details, pipeline stage, open tickets, recent activity, notes. Use the contact_id from search_contacts or the currently open contact.",
            "parameters": {
                "type": "object",
                "properties": {
                    "contact_id": {"type": "string", "description": "Contact UUID if known"},
                    "contact_name": {"type": "string", "description": "Name to look up when no id is available"},
                },
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "search_tickets",
            "description": "Search tickets by subject keyword. Returns up to 5 recent matches with status.",
            "parameters": {
                "type": "object",
                "properties": {"query": {"type": "string"}},
                "required": ["query"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "create_reminder",
            "description": "Set a personal reminder for the agent. Fires as a toast at the given time.",
            "parameters": {
                "type": "object",
                "properties": {
                    "text": {"type": "string", "description": "What to remind about — the subject only, no time phrases"},
                    "remind_at": {"type": "string", "description": "ISO 8601 UTC datetime, computed from the current time in the system prompt"},
                },
                "required": ["text", "remind_at"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "add_contact_note",
            "description": "Add a note to a contact's activity timeline. Defaults to the currently open contact.",
            "parameters": {
                "type": "object",
                "properties": {
                    "note": {"type": "string"},
                    "contact_name": {"type": "string", "description": "Only when the note is for a different contact than the open one"},
                },
                "required": ["note"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "add_ticket_note",
            "description": "Add an internal note to the currently open ticket. Only works when a ticket is open.",
            "parameters": {
                "type": "object",
                "properties": {"note": {"type": "string"}},
                "required": ["note"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "open_page",
            "description": "Navigate the user to a page or record: a module (inbox, contacts, tickets, calendar, pipeline, chat, tracking, sales, settings, ...) or a contact/ticket by name.",
            "parameters": {
                "type": "object",
                "properties": {"destination": {"type": "string", "description": "Page name or contact/ticket name"}},
                "required": ["destination"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "compose_email",
            "description": "Open the email compose window addressed to a contact.",
            "parameters": {
                "type": "object",
                "properties": {"contact_name": {"type": "string"}},
                "required": ["contact_name"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_platform_manual",
            "description": "Fetch the Yippie platform manual. Use it to answer how-do-I questions about the platform itself.",
            "parameters": {"type": "object", "properties": {}},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "save_memory",
            "description": "Remember a durable fact about this user or how they like to work (preferences, recurring context). Use when the user says 'remember ...' or states a lasting preference.",
            "parameters": {
                "type": "object",
                "properties": {"fact": {"type": "string", "description": "One self-contained sentence"}},
                "required": ["fact"],
            },
        },
    },
]


class AgentContext:
    """Mutable per-request state the tool executors write into."""

    def __init__(
        self,
        db: AsyncSession,
        user: User,
        tenant: Tenant,
        context_type: str,
        context_id: str | None,
    ):
        self.db = db
        self.user = user
        self.tenant = tenant
        self.context_type = context_type
        self.context_id = context_id
        # Outcome fields mapped into CaptureResponse
        self.action_taken = "answer"
        self.navigate_to: str | None = None
        self.inline_data: dict | None = None


def _build_system_prompt(ctx: AgentContext, route: str | None, memories: list[str]) -> str:
    now = datetime.now(timezone.utc)
    tenant = ctx.tenant

    screen = "The user is not viewing a specific record."
    if ctx.context_type == "contact" and ctx.context_id:
        screen = f"The user has a CONTACT open (contact_id={ctx.context_id})."
    elif ctx.context_type == "ticket" and ctx.context_id:
        screen = f"The user has a TICKET open (ticket_id={ctx.context_id})."
    if route:
        screen += f" Current page: {route}"

    lines = [
        f"You are Yip, the AI assistant inside the {tenant.name} workspace on the Yippie customer service platform.",
        f"You are talking to {ctx.user.full_name or 'an agent'} (role: {ctx.user.role.value if hasattr(ctx.user.role, 'value') else ctx.user.role}), a member of the {tenant.name} team — not an end customer.",
        f"The current UTC time is {now.isoformat()}.",
        screen,
        "",
        "Rules:",
        "- Use tools to look up real data before answering questions about contacts, tickets or the workspace. Never invent records.",
        "- Take the action the user asks for (reminder, note, navigation, email) via tools, then confirm in one short sentence.",
        "- Answer in plain text only — no markdown, asterisks or bullet symbols.",
        "- Be brief: one to three sentences unless the user asks for detail.",
        "- When the user states a lasting preference or says 'remember', use save_memory.",
        "- If a tool reports an error or no match, say so honestly and suggest what to try.",
    ]

    tenant_ctx = service._build_tenant_context(tenant)
    if tenant_ctx:
        lines += ["", "Workspace context:", tenant_ctx]

    if memories:
        lines += ["", "Things you remember about this user:"]
        lines += [f"- {m}" for m in memories]

    return "\n".join(lines)


async def _load_memories(db: AsyncSession, tenant_id: uuid.UUID, user_id: uuid.UUID) -> list[str]:
    result = await db.execute(
        select(AssistantMemory.content)
        .where(AssistantMemory.tenant_id == tenant_id, AssistantMemory.user_id == user_id)
        .order_by(AssistantMemory.created_at.desc())
        .limit(MAX_MEMORIES)
    )
    return list(result.scalars().all())


# ---------------------------------------------------------------------------
# Tool executors — each returns a JSON-serialisable dict fed back to the model.
# ---------------------------------------------------------------------------

async def _tool_search_contacts(ctx: AgentContext, args: dict) -> dict:
    query = (args.get("query") or "").strip()
    if not query:
        return {"error": "empty query"}
    result = await ctx.db.execute(
        select(Contact)
        .where(
            Contact.tenant_id == ctx.tenant.id,
            Contact.deleted_at.is_(None),
            Contact.full_name.ilike(f"%{query}%")
            | Contact.email.ilike(f"%{query}%")
            | Contact.company_name.ilike(f"%{query}%"),
        )
        .limit(5)
    )
    contacts = result.scalars().all()
    return {
        "matches": [
            {
                "contact_id": str(c.id),
                "name": c.full_name,
                "email": c.email,
                "phone": c.phone,
                "company": c.company_name,
            }
            for c in contacts
        ]
    }


async def _tool_get_contact_briefing(ctx: AgentContext, args: dict) -> dict:
    raw_id = args.get("contact_id") or (ctx.context_id if ctx.context_type == "contact" else None)
    contact = await service._resolve_contact(ctx.db, ctx.tenant.id, raw_id, args.get("contact_name"))
    if not contact:
        return {"error": "no matching contact"}
    facts = await service.collect_contact_facts(ctx.db, ctx.tenant, contact)
    # Surface the editable contact card in the popup alongside the answer.
    ctx.action_taken = "context_query"
    ctx.inline_data = {
        "contact_id": str(contact.id),
        "full_name": contact.full_name,
        "email": contact.email,
        "phone": contact.phone,
        "notes": contact.notes,
    }
    facts["contact_id"] = str(contact.id)
    return facts


async def _tool_search_tickets(ctx: AgentContext, args: dict) -> dict:
    query = (args.get("query") or "").strip()
    if not query:
        return {"error": "empty query"}
    result = await ctx.db.execute(
        select(Ticket)
        .where(
            Ticket.tenant_id == ctx.tenant.id,
            Ticket.deleted_at.is_(None),
            Ticket.subject.ilike(f"%{query}%"),
        )
        .order_by(Ticket.created_at.desc())
        .limit(5)
    )
    tickets = result.scalars().all()
    return {
        "matches": [
            {
                "ticket_id": str(t.id),
                "subject": t.subject,
                "status": t.status.value if hasattr(t.status, "value") else str(t.status),
                "created_at": t.created_at.isoformat() if t.created_at else None,
            }
            for t in tickets
        ]
    }


async def _tool_create_reminder(ctx: AgentContext, args: dict) -> dict:
    text = (args.get("text") or "").strip()
    if not text:
        return {"error": "reminder text is empty"}
    remind_at = service._parse_remind_at(args.get("remind_at"), text)
    reminder = UserReminder(
        user_id=ctx.user.id,
        tenant_id=ctx.tenant.id,
        body=text,
        remind_at=remind_at,
    )
    ctx.db.add(reminder)
    await ctx.db.commit()
    ctx.action_taken = "reminder"
    return {"ok": True, "remind_at": remind_at.isoformat()}


async def _tool_add_contact_note(ctx: AgentContext, args: dict) -> dict:
    note = (args.get("note") or "").strip()
    if not note:
        return {"error": "note is empty"}
    raw_id = ctx.context_id if ctx.context_type == "contact" and not args.get("contact_name") else None
    contact = await service._resolve_contact(ctx.db, ctx.tenant.id, raw_id, args.get("contact_name"))
    if not contact:
        return {"error": "no contact in context or matching that name"}
    await activity_service.log_event(
        ctx.db, ctx.tenant.id,
        module="contacts", event_type="quick_note", entity_type="contact",
        entity_id=contact.id, contact_id=contact.id, actor_id=ctx.user.id,
        payload={"body": note, "source": "jarvis"},
    )
    await ctx.db.commit()
    ctx.action_taken = "contact_note"
    return {"ok": True, "contact": contact.full_name}


async def _tool_add_ticket_note(ctx: AgentContext, args: dict) -> dict:
    note = (args.get("note") or "").strip()
    if not note:
        return {"error": "note is empty"}
    raw_id = ctx.context_id if ctx.context_type == "ticket" else None
    ticket = await service._resolve_ticket(ctx.db, ctx.tenant.id, raw_id)
    if not ticket:
        return {"error": "no ticket is currently open"}
    comment = TicketComment(
        tenant_id=ctx.tenant.id,
        ticket_id=ticket.id,
        author_id=ctx.user.id,
        body=note,
        is_internal=True,
    )
    ctx.db.add(comment)
    await activity_service.log_event(
        ctx.db, ctx.tenant.id,
        module="tickets", event_type="ticket_commented", entity_type="ticket",
        entity_id=ticket.id, contact_id=ticket.contact_id, actor_id=ctx.user.id,
        payload={"preview": note[:100], "source": "jarvis"},
    )
    await ctx.db.commit()
    ctx.action_taken = "ticket_note"
    return {"ok": True, "ticket": ticket.subject}


async def _tool_open_page(ctx: AgentContext, args: dict) -> dict:
    destination = (args.get("destination") or "").strip()
    if not destination:
        return {"error": "empty destination"}
    nav = await service._resolve_navigation(ctx.db, ctx.tenant.id, destination)
    if not nav:
        return {"error": f"nothing found for '{destination}'"}
    ctx.navigate_to = nav["path"]
    return {"ok": True, "navigating_to": nav["path"], "label": nav["label"]}


async def _tool_compose_email(ctx: AgentContext, args: dict) -> dict:
    name = (args.get("contact_name") or "").strip()
    contact = await service._resolve_contact(ctx.db, ctx.tenant.id, None, name)
    if not contact:
        return {"error": f"no contact found matching '{name}'"}
    if not contact.email:
        return {"error": f"{contact.full_name} has no email address on file"}
    ctx.action_taken = "compose_email"
    ctx.inline_data = {"email": contact.email, "name": contact.full_name}
    return {"ok": True, "opening_compose_for": contact.full_name}


async def _tool_get_platform_manual(ctx: AgentContext, args: dict) -> dict:
    manual = service._load_manual()
    if not manual:
        return {"error": "manual unavailable — refer the user to support@getyippie.com"}
    return {"manual": manual}


async def _tool_save_memory(ctx: AgentContext, args: dict) -> dict:
    fact = (args.get("fact") or "").strip()
    if not fact:
        return {"error": "empty fact"}
    ctx.db.add(AssistantMemory(user_id=ctx.user.id, tenant_id=ctx.tenant.id, content=fact))
    await ctx.db.commit()
    return {"ok": True, "remembered": fact}


_EXECUTORS = {
    "search_contacts": _tool_search_contacts,
    "get_contact_briefing": _tool_get_contact_briefing,
    "search_tickets": _tool_search_tickets,
    "create_reminder": _tool_create_reminder,
    "add_contact_note": _tool_add_contact_note,
    "add_ticket_note": _tool_add_ticket_note,
    "open_page": _tool_open_page,
    "compose_email": _tool_compose_email,
    "get_platform_manual": _tool_get_platform_manual,
    "save_memory": _tool_save_memory,
}


async def _execute_tool(ctx: AgentContext, name: str, args: dict) -> dict:
    executor = _EXECUTORS.get(name)
    if executor is None:
        return {"error": f"unknown tool '{name}'"}
    try:
        return await executor(ctx, args)
    except Exception as exc:  # tool failures go back to the model, not to a 500
        await ctx.db.rollback()
        return {"error": f"tool failed: {exc}"}


# ---------------------------------------------------------------------------
# Agent loop
# ---------------------------------------------------------------------------

async def run_agent(
    db: AsyncSession,
    user: User,
    tenant: Tenant,
    body: str,
    context_type: str,
    context_id: str | None,
    route: str | None = None,
    history: list[dict] | None = None,
) -> dict:
    """Run the tool loop and return a CaptureResponse-shaped dict."""
    # Fast path: plain arithmetic never needs the model.
    math_result = service._safe_eval(body)
    if math_result is not None:
        return {"action_taken": "math", "summary": str(math_result)}

    ctx = AgentContext(db, user, tenant, context_type, context_id)
    memories = await _load_memories(db, tenant.id, user.id)

    messages: list[dict] = [{"role": "system", "content": _build_system_prompt(ctx, route, memories)}]
    for m in (history or [])[-MAX_HISTORY:]:
        role = m.get("role")
        content = (m.get("content") or "").strip()
        if role in ("user", "assistant") and content:
            messages.append({"role": role, "content": content})
    messages.append({"role": "user", "content": body})

    final_text = ""
    for _ in range(MAX_ITERATIONS):
        msg = await ai_completion_tools(messages, tools=TOOL_DEFS)
        tool_calls = getattr(msg, "tool_calls", None)
        if not tool_calls:
            final_text = (msg.content or "").strip()
            break
        messages.append({
            "role": "assistant",
            "content": msg.content or "",
            "tool_calls": [
                {
                    "id": tc.id,
                    "type": "function",
                    "function": {"name": tc.function.name, "arguments": tc.function.arguments or "{}"},
                }
                for tc in tool_calls
            ],
        })
        for tc in tool_calls:
            try:
                args = json.loads(tc.function.arguments or "{}")
                if not isinstance(args, dict):
                    args = {}
            except json.JSONDecodeError:
                args = {}
            result = await _execute_tool(ctx, tc.function.name, args)
            messages.append({
                "role": "tool",
                "tool_call_id": tc.id,
                "content": json.dumps(result, default=str),
            })
    else:
        final_text = "That took more steps than I can handle in one go — try breaking it into smaller requests."

    if not final_text:
        final_text = "Done."

    out: dict = {"action_taken": ctx.action_taken, "summary": final_text}
    if ctx.navigate_to:
        out["action_taken"] = "navigate"
        out["navigate_to"] = ctx.navigate_to
    if ctx.inline_data:
        out["inline_data"] = ctx.inline_data
    return out
