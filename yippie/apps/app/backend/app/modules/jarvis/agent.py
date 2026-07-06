"""Yip agent loop — tool-calling assistant that replaces the classify/execute router.

The model receives the workspace context (tenant profile, current screen, user
memories) in the system prompt plus a set of tools. It loops: call tools → read
results → call more tools or answer. Every tool executor is tenant-filtered
server-side; the model never touches the DB directly.
"""
from __future__ import annotations

import json
import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

import litellm

from app.core.models import AssistantMemory, Tenant, User, UserReminder
from app.modules.activity import service as activity_service
from app.modules.ai.client import ai_stream_tools
from app.modules.contacts.models import Contact
from app.modules.jarvis import service
from app.modules.tickets.models import Ticket, TicketComment, TicketPriority, TicketStatus

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
            "name": "get_ticket_thread",
            "description": "Fetch a ticket's full conversation: customer messages, team replies and internal notes, oldest first. Use for 'brief me on this ticket', thread summaries, or translating what the customer wrote. Defaults to the currently open ticket.",
            "parameters": {
                "type": "object",
                "properties": {
                    "ticket_query": {"type": "string", "description": "Subject keyword, only when no ticket is open"},
                },
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "draft_reply",
            "description": "Draft a reply email in the workspace's trained tone and language. For the currently open ticket (or one found via ticket_query) it drafts a reply to the full thread; with only a contact_name it drafts a fresh email. The draft opens prefilled in the compose window for the user to review and send — it is NEVER sent automatically.",
            "parameters": {
                "type": "object",
                "properties": {
                    "ticket_query": {"type": "string", "description": "Subject keyword when replying to a ticket that is not open"},
                    "contact_name": {"type": "string", "description": "Recipient name when drafting a fresh email without a ticket"},
                    "instructions": {"type": "string", "description": "What the reply should say or emphasise, in the user's words"},
                },
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "list_open_tickets",
            "description": "List open and in-progress tickets, optionally only those assigned to the current user. Use for 'what is on my plate', 'any open tickets', 'what needs attention'.",
            "parameters": {
                "type": "object",
                "properties": {
                    "assigned_to_me": {"type": "boolean", "description": "Only tickets assigned to the current user"},
                },
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "track_shipments",
            "description": "Look up shipments by tracking number, order reference or customer name. Returns status, carrier, last event and estimated delivery.",
            "parameters": {
                "type": "object",
                "properties": {"query": {"type": "string", "description": "Tracking number, order reference or contact name"}},
                "required": ["query"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "list_calendar_events",
            "description": "List calendar events, meetings and ticket deadlines between two dates. Compute the dates from the current UTC time in your instructions (e.g. next week = coming Monday through Sunday).",
            "parameters": {
                "type": "object",
                "properties": {
                    "start_date": {"type": "string", "description": "Inclusive start, YYYY-MM-DD"},
                    "end_date": {"type": "string", "description": "Exclusive end, YYYY-MM-DD"},
                },
                "required": ["start_date", "end_date"],
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
    # [YIP4] Read tool expansion — workload/stats questions.
    {
        "type": "function",
        "function": {
            "name": "list_pending_drafts",
            "description": "List incoming emails waiting for review in the inbox (pending draft tickets). Use for 'any new mail', 'anything in the inbox', 'pending drafts'.",
            "parameters": {"type": "object", "properties": {}},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "list_waiting_chats",
            "description": "List live chat conversations waiting for an agent: unassigned sessions and sessions with unread visitor messages.",
            "parameters": {"type": "object", "properties": {}},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "check_email_engagement",
            "description": "Check whether emails sent to a contact were delivered, opened or clicked. Use for 'did Jan open my email?'.",
            "parameters": {
                "type": "object",
                "properties": {
                    "contact_name": {"type": "string", "description": "Recipient's name — defaults to the currently open contact"},
                    "email": {"type": "string", "description": "Recipient's email address, when known"},
                },
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_ticket_stats",
            "description": "Ticket workload statistics: open counts per status plus how many tickets were resolved today and in the last 7 days.",
            "parameters": {"type": "object", "properties": {}},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_revenue_summary",
            "description": "Recurring revenue rollup from the contracts module: MRR, ARR, one-off total and renewal counts. Use for questions about revenue or contract value.",
            "parameters": {"type": "object", "properties": {}},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "list_todays_bookings",
            "description": "List today's meetings, bookings and ticket deadlines in the workspace's local timezone. Use for 'what is on today', 'my meetings today'.",
            "parameters": {"type": "object", "properties": {}},
        },
    },
    # [YIP3] Write tools — these only PROPOSE a change; the popup shows a
    # Confirm/Cancel card and the write runs via POST /jarvis/confirm.
    {
        "type": "function",
        "function": {
            "name": "create_ticket",
            "description": "Propose creating a new ticket. The user sees a confirmation card and must press Confirm before anything is created.",
            "parameters": {
                "type": "object",
                "properties": {
                    "subject": {"type": "string"},
                    "description": {"type": "string", "description": "What the ticket is about, in one or two sentences"},
                    "priority": {"type": "string", "enum": ["low", "medium", "high", "urgent"]},
                    "contact_name": {"type": "string", "description": "Customer the ticket is about, when mentioned"},
                },
                "required": ["subject"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "update_ticket",
            "description": "Propose changing a ticket: assign it to a team member, change its status (close, resolve, reopen) or its priority. Defaults to the currently open ticket. The user must press Confirm before anything changes.",
            "parameters": {
                "type": "object",
                "properties": {
                    "ticket_query": {"type": "string", "description": "Subject keyword, only when no ticket is open"},
                    "status": {"type": "string", "enum": ["open", "in_progress", "waiting", "resolved", "closed"]},
                    "priority": {"type": "string", "enum": ["low", "medium", "high", "urgent"]},
                    "assign_to": {"type": "string", "description": "Team member name, or 'me' for the current user"},
                },
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "create_contact",
            "description": "Propose creating a new contact. The user must press Confirm before anything is created.",
            "parameters": {
                "type": "object",
                "properties": {
                    "full_name": {"type": "string"},
                    "email": {"type": "string"},
                    "phone": {"type": "string"},
                    "company": {"type": "string", "description": "Company name, when mentioned"},
                },
                "required": ["full_name"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "create_calendar_event",
            "description": "Propose creating a calendar event or meeting. Compute datetimes from the current UTC time in your instructions. The user must press Confirm before anything is created.",
            "parameters": {
                "type": "object",
                "properties": {
                    "title": {"type": "string"},
                    "start_at": {"type": "string", "description": "ISO 8601 UTC datetime"},
                    "end_at": {"type": "string", "description": "ISO 8601 UTC datetime; defaults to one hour after start"},
                    "all_day": {"type": "boolean"},
                    "contact_name": {"type": "string", "description": "Customer to link the event to, when mentioned"},
                },
                "required": ["title", "start_at"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "move_pipeline_stage",
            "description": "Propose moving a contact to another pipeline (kanban) stage. Defaults to the currently open contact. The user must press Confirm before anything moves.",
            "parameters": {
                "type": "object",
                "properties": {
                    "stage_name": {"type": "string"},
                    "contact_name": {"type": "string", "description": "Only when different from the open contact"},
                },
                "required": ["stage_name"],
            },
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


# [YIP-GATE] Tool → module that must be in tenant.enabled_modules (None = always
# available; contacts/inbox/activity are core modules and never disabled).
TOOL_MODULES: dict[str, str | None] = {
    "search_contacts": None,
    "get_contact_briefing": None,
    "search_tickets": "tickets",
    "list_open_tickets": "tickets",
    "get_ticket_thread": "tickets",
    "add_ticket_note": "tickets",
    "track_shipments": "tracking",
    "list_calendar_events": "calendar",
    "create_reminder": None,
    "add_contact_note": None,
    "open_page": None,
    "compose_email": None,
    "draft_reply": None,  # fresh-email path needs only core inbox; ticket path degrades gracefully
    "get_platform_manual": None,
    "save_memory": None,
    # [YIP4] read tools
    "list_pending_drafts": None,  # inbox is core
    "list_waiting_chats": "chat",
    "check_email_engagement": None,  # emailtracking has no module key — core inbox plumbing
    "get_ticket_stats": "tickets",
    "get_revenue_summary": "contracts",
    "list_todays_bookings": "calendar",
    # [YIP3] write tools
    "create_ticket": "tickets",
    "update_ticket": "tickets",
    "create_contact": None,
    "create_calendar_event": "calendar",
    "move_pipeline_stage": "pipeline",
}


def _tools_for_tenant(tenant: Tenant) -> list[dict]:
    """Filter TOOL_DEFS down to the tenant's enabled modules."""
    enabled = set(tenant.enabled_modules or [])
    tools = []
    for t in TOOL_DEFS:
        required = TOOL_MODULES.get(t["function"]["name"])
        if required is None or required in enabled:
            tools.append(t)
    return tools


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
        # CTA buttons rendered under the reply: {label, kind: navigate|compose, ...}
        self.actions: list[dict] = []

    def add_action(self, label: str, **fields) -> None:
        """Attach a CTA button (max 3, deduped by label)."""
        if len(self.actions) >= 3 or any(a["label"] == label for a in self.actions):
            return
        self.actions.append({"label": label, **fields})


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
        f"The current UTC time is {now.isoformat()} ({now.strftime('%A')}).",
        screen,
        "",
        "Rules:",
        "- Be resourceful: ALWAYS try your tools before saying you can't do something. Chain them — search first, then act on what you find.",
        "- Use tools to look up real data before answering questions about contacts, tickets, shipments or the calendar. Never invent records.",
        "- Take the action the user asks for (reminder, note, navigation, email) via tools, then confirm in one short sentence.",
        "- If something is truly outside your tools, say so in ONE short sentence and immediately do the closest helpful thing instead (look up related data, or navigate the user there). Never explain how to use the interface and never apologise at length.",
        "- Answer in plain text only — no markdown, asterisks or bullet symbols.",
        "- Be brief: one to three sentences unless the user asks for detail. Lead with the answer, not with caveats.",
        "- When asked to draft, write or answer a reply or email, use draft_reply — the draft opens in the compose window for the user to review; it is never sent by you. Confirm in one sentence.",
        "- For 'brief me on this ticket', thread summaries or translating what a customer wrote, fetch the conversation with get_ticket_thread first, then summarise or translate it yourself.",
        "- Write tools (create_ticket, update_ticket, create_contact, create_calendar_event, move_pipeline_stage) only PROPOSE the change: the user gets Confirm and Cancel buttons and nothing happens until they press Confirm. After proposing, say in one sentence what will happen once they confirm — never claim it is already done. Propose at most one write action per turn.",
        "- When the user states a lasting preference or says 'remember', use save_memory.",
        "- If a tool reports an error or no match, say what you found (or didn't) in one sentence and suggest the next step.",
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
    for c in contacts[:2]:
        ctx.add_action(f"Open {c.full_name}", kind="navigate", path=f"/contacts/{c.id}")
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
    ctx.add_action(f"Open {contact.full_name}", kind="navigate", path=f"/contacts/{contact.id}")
    if contact.email:
        ctx.add_action(f"Email {contact.full_name}", kind="compose", email=contact.email, name=contact.full_name)
    return facts


async def _tool_list_open_tickets(ctx: AgentContext, args: dict) -> dict:
    filters = [
        Ticket.tenant_id == ctx.tenant.id,
        Ticket.deleted_at.is_(None),
        Ticket.status.in_((TicketStatus.open, TicketStatus.in_progress)),
    ]
    if args.get("assigned_to_me"):
        filters.append(Ticket.assigned_to == ctx.user.id)
    result = await ctx.db.execute(
        select(Ticket, Contact.full_name)
        .outerjoin(Contact, Contact.id == Ticket.contact_id)
        .where(*filters)
        .order_by(Ticket.sla_due_at.asc().nulls_last(), Ticket.created_at.desc())
        .limit(15)
    )
    rows = result.all()
    for t, _name in rows[:2]:
        subject = t.subject if len(t.subject) <= 32 else t.subject[:29] + "…"
        ctx.add_action(f"Open “{subject}”", kind="navigate", path=f"/tickets/{t.id}")
    if rows:
        ctx.add_action("All tickets", kind="navigate", path="/tickets")
    return {
        "tickets": [
            {
                "ticket_id": str(t.id),
                "subject": t.subject,
                "status": t.status.value,
                "priority": t.priority.value if t.priority else None,
                "contact": contact_name,
                "sla_due_at": t.sla_due_at.isoformat() if t.sla_due_at else None,
                "assigned_to_me": t.assigned_to == ctx.user.id,
            }
            for t, contact_name in rows
        ],
        "count": len(rows),
    }


async def _tool_track_shipments(ctx: AgentContext, args: dict) -> dict:
    from app.modules.shipments.models import Shipment

    query = (args.get("query") or "").strip()
    if not query:
        return {"error": "empty query"}
    result = await ctx.db.execute(
        select(Shipment, Contact.full_name)
        .outerjoin(Contact, Contact.id == Shipment.contact_id)
        .where(
            Shipment.tenant_id == ctx.tenant.id,
            Shipment.deleted_at.is_(None),
            Shipment.tracking_number.ilike(f"%{query}%")
            | Shipment.order_reference.ilike(f"%{query}%")
            | Contact.full_name.ilike(f"%{query}%"),
        )
        .order_by(Shipment.created_at.desc())
        .limit(5)
    )
    rows = result.all()
    if rows:
        ctx.add_action("Open tracking", kind="navigate", path="/tracking")
    return {
        "shipments": [
            {
                "tracking_number": s.tracking_number,
                "order_reference": s.order_reference,
                "carrier": s.carrier.value if s.carrier else None,
                "status": s.status.value if s.status else None,
                "contact": contact_name,
                "last_event": s.last_event_description,
                "last_event_at": s.last_event_at.isoformat() if s.last_event_at else None,
                "estimated_delivery": s.estimated_delivery.isoformat() if s.estimated_delivery else None,
            }
            for s, contact_name in rows
        ]
    }


async def _resolve_context_ticket(ctx: AgentContext, query: str | None) -> Ticket | None:
    """The open ticket first, then a subject-keyword lookup."""
    if ctx.context_type == "ticket" and ctx.context_id:
        ticket = await service._resolve_ticket(ctx.db, ctx.tenant.id, ctx.context_id)
        if ticket:
            return ticket
    return await service._resolve_ticket_by_query(ctx.db, ctx.tenant.id, query)


async def _tool_get_ticket_thread(ctx: AgentContext, args: dict) -> dict:
    ticket = await _resolve_context_ticket(ctx, args.get("ticket_query"))
    if not ticket:
        return {"error": "no ticket is open and no ticket matched that query"}
    thread = await service.load_ticket_thread(ctx.db, ticket)
    contact = await ctx.db.get(Contact, ticket.contact_id) if ticket.contact_id else None
    subject = ticket.subject if len(ticket.subject) <= 32 else ticket.subject[:29] + "…"
    ctx.add_action(f"Open “{subject}”", kind="navigate", path=f"/tickets/{ticket.id}")
    return {
        "ticket": {
            "ticket_id": str(ticket.id),
            "subject": ticket.subject,
            "status": ticket.status.value if hasattr(ticket.status, "value") else str(ticket.status),
            "priority": ticket.priority.value if ticket.priority else None,
            "contact": contact.full_name if contact else None,
            "created_at": ticket.created_at.isoformat() if ticket.created_at else None,
        },
        "messages": thread,
    }


async def _tool_draft_reply(ctx: AgentContext, args: dict) -> dict:
    from app.core.customer_context import render_context_block

    instructions = (args.get("instructions") or "").strip()

    # An explicitly named contact wins over the open-ticket context ("draft an
    # email to Jan" while a ticket is open) — unless a ticket was also named.
    ticket = None
    if args.get("ticket_query") or not args.get("contact_name"):
        ticket = await _resolve_context_ticket(ctx, args.get("ticket_query"))
    if ticket:
        contact = await ctx.db.get(Contact, ticket.contact_id) if ticket.contact_id else None
        if not contact or contact.tenant_id != ctx.tenant.id or not contact.email:
            return {"error": "this ticket has no contact with an email address to reply to"}
        thread = await service.load_ticket_thread(ctx.db, ticket)
        context_block = render_context_block(await service.collect_contact_facts(ctx.db, ctx.tenant, contact) or None)
        body = await service.draft_ticket_reply(ctx.tenant, ticket, thread, contact, context_block, instructions)
        subject = ticket.subject if ticket.subject.lower().startswith("re:") else f"Re: {ticket.subject}"
    else:
        raw_id = ctx.context_id if ctx.context_type == "contact" and not args.get("contact_name") else None
        contact = await service._resolve_contact(ctx.db, ctx.tenant.id, raw_id, args.get("contact_name"))
        if not contact:
            return {"error": "no ticket or contact found to draft for — ask who the reply is for"}
        if not contact.email:
            return {"error": f"{contact.full_name} has no email address on file"}
        context_block = render_context_block(await service.collect_contact_facts(ctx.db, ctx.tenant, contact) or None)
        draft = await service.draft_fresh_email(ctx.tenant, contact, context_block, instructions)
        body, subject = draft["body"], draft["subject"]

    ctx.action_taken = "draft_reply"
    ctx.inline_data = {"email": contact.email, "name": contact.full_name, "subject": subject, "body": body}
    return {"ok": True, "draft_for": contact.full_name, "note": "the draft opens in the compose window for review"}


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
    for t in tickets[:2]:
        subject = t.subject if len(t.subject) <= 32 else t.subject[:29] + "…"
        ctx.add_action(f"Open “{subject}”", kind="navigate", path=f"/tickets/{t.id}")
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


def _parse_tool_date(raw: str | None) -> datetime | None:
    if not raw:
        return None
    try:
        dt = datetime.fromisoformat(raw.strip().replace("Z", "+00:00"))
    except (ValueError, TypeError):
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt


async def _tool_list_calendar_events(ctx: AgentContext, args: dict) -> dict:
    from datetime import timedelta

    from app.modules.calendar import service as calendar_service

    start = _parse_tool_date(args.get("start_date"))
    if start is None:
        return {"error": "invalid or missing start_date (use YYYY-MM-DD)"}
    end = _parse_tool_date(args.get("end_date")) or (start + timedelta(days=7))
    if end <= start:
        return {"error": "end_date must be after start_date"}

    items = await calendar_service.list_calendar_items(ctx.db, ctx.tenant.id, start, end, None, ctx.user.id)
    # Hide other users' personal events — same visibility as the calendar UI.
    visible = [
        i for i in items
        if getattr(i, "calendar_type", None) != "personal" or getattr(i, "created_by", None) == ctx.user.id
    ]
    ctx.add_action("Open calendar", kind="navigate", path="/calendar")
    return {
        "events": [
            {
                "kind": i.kind,
                "title": i.title,
                "start_at": i.start_at.isoformat() if i.start_at else None,
                "end_at": i.end_at.isoformat() if getattr(i, "end_at", None) else None,
                "all_day": getattr(i, "all_day", False),
                "contact": getattr(i, "contact_name", None),
                "ticket": getattr(i, "ticket_subject", None),
                "calendar": getattr(i, "calendar_type", None),
            }
            for i in visible[:30]
        ],
        "count": len(visible),
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


# ---------------------------------------------------------------------------
# [YIP4] Read tool expansion — workload/stats questions.
# ---------------------------------------------------------------------------

async def _tool_list_pending_drafts(ctx: AgentContext, args: dict) -> dict:
    from app.modules.inbox import service as inbox_service
    from app.modules.inbox.models import DraftStatus, DraftTicket, InboundMessage

    count = await inbox_service.count_pending_drafts(ctx.db, ctx.tenant.id)
    now = datetime.now(timezone.utc)
    # Same pending semantics as count_pending_drafts, plus sender for the summary.
    result = await ctx.db.execute(
        select(DraftTicket, InboundMessage.subject, InboundMessage.sender)
        .join(InboundMessage, DraftTicket.inbound_message_id == InboundMessage.id)
        .where(
            DraftTicket.tenant_id == ctx.tenant.id,
            (DraftTicket.status == DraftStatus.pending)
            | (
                (DraftTicket.status == DraftStatus.approved)
                & DraftTicket.follow_up_at.isnot(None)
                & (DraftTicket.follow_up_at <= now)
            ),
        )
        .order_by(DraftTicket.created_at.desc())
        .limit(5)
    )
    rows = result.all()
    if count:
        ctx.add_action("Open inbox", kind="navigate", path="/inbox")
    return {
        "pending_count": count,
        "latest": [
            {
                "subject": d.final_subject or d.ai_suggested_subject or inbound_subject,
                "sender": sender,
                "unread": d.opened_at is None,
                "age_hours": round((now - d.created_at).total_seconds() / 3600, 1) if d.created_at else None,
            }
            for d, inbound_subject, sender in rows
        ],
    }


async def _tool_list_waiting_chats(ctx: AgentContext, args: dict) -> dict:
    from app.modules.chat.models import ChatSession

    result = await ctx.db.execute(
        select(ChatSession)
        .where(
            ChatSession.tenant_id == ctx.tenant.id,
            ChatSession.status.in_(("open", "assigned")),
            ChatSession.assigned_to.is_(None) | (ChatSession.unread_count > 0),
        )
        .order_by(ChatSession.started_at.desc())
        .limit(10)
    )
    sessions = result.scalars().all()
    if sessions:
        ctx.add_action("Open live chat", kind="navigate", path="/chat")
    return {
        "waiting": [
            {
                "visitor": s.visitor_name or s.visitor_email or s.whatsapp_phone or "visitor",
                "source": s.source,
                "assigned": s.assigned_to is not None,
                "unread_messages": s.unread_count,
                "started_at": s.started_at.isoformat() if s.started_at else None,
            }
            for s in sessions
        ],
        "count": len(sessions),
    }


async def _tool_check_email_engagement(ctx: AgentContext, args: dict) -> dict:
    from app.modules.emailtracking.models import OutboundEmail

    email = (args.get("email") or "").strip()
    name = (args.get("contact_name") or "").strip()
    if not email:
        raw_id = ctx.context_id if ctx.context_type == "contact" and not name else None
        contact = await service._resolve_contact(ctx.db, ctx.tenant.id, raw_id, name or None)
        if not contact:
            return {"error": "no contact found — ask for a contact name or email address"}
        if not contact.email:
            return {"error": f"{contact.full_name} has no email address on file"}
        email = contact.email
    result = await ctx.db.execute(
        select(OutboundEmail)
        .where(OutboundEmail.tenant_id == ctx.tenant.id, OutboundEmail.to_email.ilike(email))
        .order_by(OutboundEmail.created_at.desc())
        .limit(5)
    )
    emails = result.scalars().all()
    if not emails:
        return {"recipient": email, "emails": [], "note": "no tracked outbound emails to this address"}
    return {
        "recipient": email,
        "emails": [
            {
                "subject": e.subject,
                "sent_at": e.created_at.isoformat() if e.created_at else None,
                "status": e.status,
                "opened_at": e.opened_at.isoformat() if e.opened_at else None,
                "clicks": e.clicked_count,
                "bounced": e.bounce_type if e.bounced_at else None,
            }
            for e in emails
        ],
    }


async def _tool_get_ticket_stats(ctx: AgentContext, args: dict) -> dict:
    from sqlalchemy import func

    from app.modules.tickets import service as tickets_service

    stats = await tickets_service.get_ticket_stats(ctx.db, ctx.tenant.id)
    now = datetime.now(timezone.utc)

    async def _resolved_since(boundary: datetime) -> int:
        return (
            await ctx.db.scalar(
                select(func.count())
                .select_from(Ticket)
                .where(
                    Ticket.tenant_id == ctx.tenant.id,
                    Ticket.deleted_at.is_(None),
                    Ticket.resolved_at >= boundary,
                )
            )
        ) or 0

    stats["resolved_today"] = await _resolved_since(now.replace(hour=0, minute=0, second=0, microsecond=0))
    stats["resolved_last_7_days"] = await _resolved_since(now - timedelta(days=7))
    ctx.add_action("All tickets", kind="navigate", path="/tickets")
    return stats


async def _tool_get_revenue_summary(ctx: AgentContext, args: dict) -> dict:
    from app.modules.contracts import service as contracts_service

    s = await contracts_service.renewals_summary(ctx.db, ctx.tenant.id)
    ctx.add_action("Open contracts", kind="navigate", path="/contracts")
    return {
        "mrr": s.mrr,
        "arr": s.arr,
        "one_off_total": s.one_off_total,
        "currency": s.currency,
        "active_contracts": s.active_count,
        "expiring_soon": s.expiring_soon_count,
        "auto_renewing": s.auto_renewing_count,
        "expired": s.expired_count,
        "note": "figures are active contract values from the contracts module",
    }


async def _tool_list_todays_bookings(ctx: AgentContext, args: dict) -> dict:
    from zoneinfo import ZoneInfo

    from app.modules.booking.models import CalendarSettings
    from app.modules.calendar import service as calendar_service

    tz_name = (
        await ctx.db.scalar(
            select(CalendarSettings.timezone).where(CalendarSettings.tenant_id == ctx.tenant.id)
        )
    ) or "Europe/Amsterdam"
    try:
        tz = ZoneInfo(tz_name)
    except Exception:
        tz, tz_name = ZoneInfo("Europe/Amsterdam"), "Europe/Amsterdam"
    day_start_local = datetime.now(tz).replace(hour=0, minute=0, second=0, microsecond=0)
    start = day_start_local.astimezone(timezone.utc)
    end = (day_start_local + timedelta(days=1)).astimezone(timezone.utc)

    items = await calendar_service.list_calendar_items(ctx.db, ctx.tenant.id, start, end, None, ctx.user.id)
    # Hide other users' personal events — same visibility as the calendar UI.
    visible = [
        i for i in items
        if getattr(i, "calendar_type", None) != "personal" or getattr(i, "created_by", None) == ctx.user.id
    ]
    ctx.add_action("Open calendar", kind="navigate", path="/calendar")
    return {
        "timezone": tz_name,
        "date": day_start_local.strftime("%Y-%m-%d"),
        "items": [
            {
                "kind": i.kind,
                "title": i.title,
                "start_at": i.start_at.isoformat() if i.start_at else None,
                "end_at": i.end_at.isoformat() if getattr(i, "end_at", None) else None,
                "all_day": getattr(i, "all_day", False),
                "contact": getattr(i, "contact_name", None),
                "ticket": getattr(i, "ticket_subject", None),
            }
            for i in visible[:20]
        ],
        "count": len(visible),
    }


# ---------------------------------------------------------------------------
# [YIP3] Write actions — the tool loop only PROPOSES (confirm_action + a
# Confirm/Cancel card in the popup); the actual write runs through
# execute_confirmed() when the user presses Confirm.
# ---------------------------------------------------------------------------

def _parse_uuid(raw) -> uuid.UUID | None:
    try:
        return uuid.UUID(str(raw)) if raw else None
    except (ValueError, TypeError):
        return None


async def _resolve_team_member(ctx: AgentContext, name: str) -> User | None:
    """A workspace user by name; 'me' resolves to the current user."""
    if name.strip().lower() in ("me", "myself"):
        return ctx.user
    result = await ctx.db.execute(
        select(User)
        .where(User.tenant_id == ctx.tenant.id, User.full_name.ilike(f"%{name.strip()}%"))
        .limit(1)
    )
    return result.scalar_one_or_none()


def _propose(ctx: AgentContext, tool: str, args: dict, title: str, details: list[dict]) -> dict:
    """Stage a write action for user confirmation instead of executing it."""
    if ctx.action_taken == "confirm_action":
        return {"error": "an action is already awaiting the user's confirmation — wait for them to confirm or cancel it first"}
    ctx.action_taken = "confirm_action"
    ctx.inline_data = {"tool": tool, "args": args, "title": title, "details": details}
    return {
        "pending_confirmation": True,
        "proposed": title,
        "note": "the user now sees a Confirm/Cancel card — tell them in one sentence what will happen once they confirm",
    }


async def _tool_create_ticket(ctx: AgentContext, args: dict) -> dict:
    subject = (args.get("subject") or "").strip()
    if not subject:
        return {"error": "subject is required"}
    try:
        priority = TicketPriority(args.get("priority") or "medium")
    except ValueError:
        priority = TicketPriority.medium
    contact = None
    raw_id = ctx.context_id if ctx.context_type == "contact" and not args.get("contact_name") else None
    if raw_id or args.get("contact_name"):
        contact = await service._resolve_contact(ctx.db, ctx.tenant.id, raw_id, args.get("contact_name"))
        if args.get("contact_name") and not contact:
            return {"error": f"no contact found matching '{args['contact_name']}' — ask whether to create the ticket without one"}
    description = (args.get("description") or "").strip()
    confirm_args = {
        "subject": subject,
        "description": description or None,
        "priority": priority.value,
        "contact_id": str(contact.id) if contact else None,
    }
    details = [
        {"label": "Subject", "value": subject},
        {"label": "Priority", "value": priority.value},
    ]
    if contact:
        details.append({"label": "Contact", "value": contact.full_name})
    if description:
        details.append({"label": "Description", "value": description[:140]})
    return _propose(ctx, "create_ticket", confirm_args, "Create ticket", details)


async def _tool_update_ticket(ctx: AgentContext, args: dict) -> dict:
    ticket = await _resolve_context_ticket(ctx, args.get("ticket_query"))
    if not ticket:
        return {"error": "no ticket is open and no ticket matched that query"}
    changes: dict = {}
    details: list[dict] = []
    if args.get("status"):
        try:
            new_status = TicketStatus(args["status"])
        except ValueError:
            return {"error": f"invalid status '{args['status']}'"}
        changes["status"] = new_status.value
        details.append({"label": "Status", "value": f"{ticket.status.value} → {new_status.value}"})
    if args.get("priority"):
        try:
            new_priority = TicketPriority(args["priority"])
        except ValueError:
            return {"error": f"invalid priority '{args['priority']}'"}
        changes["priority"] = new_priority.value
        details.append({"label": "Priority", "value": f"{ticket.priority.value} → {new_priority.value}"})
    if args.get("assign_to"):
        member = await _resolve_team_member(ctx, args["assign_to"])
        if not member:
            return {"error": f"no team member found matching '{args['assign_to']}'"}
        changes["assigned_to"] = str(member.id)
        details.append({"label": "Assign to", "value": member.full_name or member.email})
    if not changes:
        return {"error": "nothing to change — provide a status, priority or assignee"}
    subject = ticket.subject if len(ticket.subject) <= 40 else ticket.subject[:37] + "…"
    confirm_args = {"ticket_id": str(ticket.id), **changes}
    return _propose(ctx, "update_ticket", confirm_args, f"Update “{subject}”", details)


async def _tool_create_contact(ctx: AgentContext, args: dict) -> dict:
    from app.modules.contacts.models import Company

    full_name = (args.get("full_name") or "").strip()
    if not full_name:
        return {"error": "full_name is required"}
    email = (args.get("email") or "").strip() or None
    phone = (args.get("phone") or "").strip() or None
    company_name = (args.get("company") or "").strip() or None
    confirm_args = {"full_name": full_name, "email": email, "phone": phone, "company_id": None, "company_name": None}
    details = [{"label": "Name", "value": full_name}]
    if email:
        details.append({"label": "Email", "value": email})
    if phone:
        details.append({"label": "Phone", "value": phone})
    if company_name:
        existing = await ctx.db.scalar(
            select(Company).where(Company.tenant_id == ctx.tenant.id, Company.name.ilike(company_name)).limit(1)
        )
        if existing:
            confirm_args["company_id"] = str(existing.id)
            details.append({"label": "Company", "value": existing.name})
        else:
            confirm_args["company_name"] = company_name
            details.append({"label": "Company", "value": f"{company_name} (new)"})
    # Surface likely duplicates on the card — the user decides, not Yip.
    dup = await service._resolve_contact(ctx.db, ctx.tenant.id, None, full_name)
    if dup:
        details.append({"label": "Heads up", "value": f"a contact named {dup.full_name} already exists"})
    return _propose(ctx, "create_contact", confirm_args, "Create contact", details)


async def _tool_create_calendar_event(ctx: AgentContext, args: dict) -> dict:
    title = (args.get("title") or "").strip()
    if not title:
        return {"error": "title is required"}
    start = _parse_tool_date(args.get("start_at"))
    if start is None:
        return {"error": "invalid or missing start_at (use ISO 8601)"}
    all_day = bool(args.get("all_day"))
    end = _parse_tool_date(args.get("end_at"))
    if end is None and not all_day:
        end = start + timedelta(hours=1)
    if end is not None and end <= start:
        return {"error": "end_at must be after start_at"}
    contact = None
    raw_id = ctx.context_id if ctx.context_type == "contact" and not args.get("contact_name") else None
    if raw_id or args.get("contact_name"):
        contact = await service._resolve_contact(ctx.db, ctx.tenant.id, raw_id, args.get("contact_name"))
        if args.get("contact_name") and not contact:
            return {"error": f"no contact found matching '{args['contact_name']}'"}
    confirm_args = {
        "title": title,
        "start_at": start.isoformat(),
        "end_at": end.isoformat() if end else None,
        "all_day": all_day,
        "contact_id": str(contact.id) if contact else None,
    }
    when = start.strftime("%a %d %b %Y") if all_day else start.strftime("%a %d %b %Y %H:%M UTC")
    details = [
        {"label": "Title", "value": title},
        {"label": "When", "value": when},
    ]
    if contact:
        details.append({"label": "Contact", "value": contact.full_name})
    return _propose(ctx, "create_calendar_event", confirm_args, "Create calendar event", details)


async def _tool_move_pipeline_stage(ctx: AgentContext, args: dict) -> dict:
    from app.modules.pipeline import service as pipeline_service
    from app.modules.pipeline.models import PipelineStage

    stage_name = (args.get("stage_name") or "").strip()
    if not stage_name:
        return {"error": "stage_name is required"}
    raw_id = ctx.context_id if ctx.context_type == "contact" and not args.get("contact_name") else None
    contact = await service._resolve_contact(ctx.db, ctx.tenant.id, raw_id, args.get("contact_name"))
    if not contact:
        return {"error": "no contact in context or matching that name"}
    stage = await pipeline_service.find_stage_by_name(ctx.db, ctx.tenant.id, stage_name)
    if stage is None:
        stage = await ctx.db.scalar(
            select(PipelineStage)
            .where(PipelineStage.tenant_id == ctx.tenant.id, PipelineStage.name.ilike(f"%{stage_name}%"))
            .order_by(PipelineStage.display_order)
            .limit(1)
        )
    if stage is None:
        names = await ctx.db.execute(
            select(PipelineStage.name)
            .where(PipelineStage.tenant_id == ctx.tenant.id)
            .order_by(PipelineStage.display_order)
        )
        return {"error": f"no stage matches '{stage_name}'", "available_stages": list(names.scalars().all())}
    confirm_args = {"contact_id": str(contact.id), "stage_id": str(stage.id)}
    details = [
        {"label": "Contact", "value": contact.full_name},
        {"label": "Stage", "value": stage.name},
    ]
    return _propose(ctx, "move_pipeline_stage", confirm_args, f"Move {contact.full_name} to {stage.name}", details)


# --- Confirmed write executors — run only after the user presses Confirm. ---

async def _confirm_create_ticket(ctx: AgentContext, args: dict) -> dict:
    from app.modules.tickets import service as tickets_service
    from app.modules.tickets.schemas import TicketCreate

    subject = str(args.get("subject") or "").strip()[:500]
    if not subject:
        return {"error": "subject is required"}
    try:
        priority = TicketPriority(args.get("priority") or "medium")
    except ValueError:
        priority = TicketPriority.medium
    data = TicketCreate(
        subject=subject,
        description=(args.get("description") or None),
        priority=priority,
        contact_id=_parse_uuid(args.get("contact_id")),
    )
    try:
        ticket = await tickets_service.create_ticket(ctx.db, ctx.tenant.id, ctx.user.id, data)
    except tickets_service.TenantScopeError as e:
        return {"error": str(e)}
    await activity_service.log_event(
        ctx.db, ctx.tenant.id,
        module="tickets", event_type="ticket_created", entity_type="ticket",
        entity_id=ticket.id, contact_id=ticket.contact_id, actor_id=ctx.user.id,
        payload={"subject": ticket.subject, "priority": priority.value, "source": "jarvis"},
    )
    await ctx.db.commit()
    ctx.add_action("Open ticket", kind="navigate", path=f"/tickets/{ticket.id}")
    return {"ok": True, "summary": f"Ticket “{ticket.subject}” created."}


async def _confirm_update_ticket(ctx: AgentContext, args: dict) -> dict:
    ticket = await service._resolve_ticket(ctx.db, ctx.tenant.id, args.get("ticket_id"))
    if not ticket:
        return {"error": "ticket not found"}
    changed: list[str] = []
    if args.get("status"):
        try:
            new_status = TicketStatus(args["status"])
        except ValueError:
            return {"error": "invalid status"}
        ticket.status = new_status
        if new_status in (TicketStatus.resolved, TicketStatus.closed):
            ticket.resolved_at = datetime.now(timezone.utc)
        changed.append(f"status → {new_status.value}")
    if args.get("priority"):
        try:
            ticket.priority = TicketPriority(args["priority"])
        except ValueError:
            return {"error": "invalid priority"}
        changed.append(f"priority → {ticket.priority.value}")
    assigned_id = _parse_uuid(args.get("assigned_to"))
    if assigned_id:
        member = await ctx.db.get(User, assigned_id)
        if not member or member.tenant_id != ctx.tenant.id:
            return {"error": "assignee not found in this workspace"}
        ticket.assigned_to = member.id
        changed.append(f"assigned to {member.full_name or member.email}")
    if not changed:
        return {"error": "nothing to change"}
    await ctx.db.commit()
    subject = ticket.subject if len(ticket.subject) <= 40 else ticket.subject[:37] + "…"
    ctx.add_action("Open ticket", kind="navigate", path=f"/tickets/{ticket.id}")
    return {"ok": True, "summary": f"Ticket “{subject}” updated: {', '.join(changed)}."}


async def _confirm_create_contact(ctx: AgentContext, args: dict) -> dict:
    from app.modules.contacts import service as contacts_service
    from app.modules.contacts.models import Company
    from app.modules.contacts.schemas import ContactCreate

    full_name = str(args.get("full_name") or "").strip()[:255]
    if not full_name:
        return {"error": "full_name is required"}
    company_id = _parse_uuid(args.get("company_id"))
    company_name = str(args.get("company_name") or "").strip()[:255]
    if company_id is None and company_name:
        # Get-or-create keeps a Confirm pressed twice from duplicating companies.
        company = await ctx.db.scalar(
            select(Company).where(Company.tenant_id == ctx.tenant.id, Company.name.ilike(company_name)).limit(1)
        )
        if company is None:
            company = Company(tenant_id=ctx.tenant.id, name=company_name)
            ctx.db.add(company)
            await ctx.db.flush()
        company_id = company.id
    data = ContactCreate(
        full_name=full_name,
        email=(str(args.get("email") or "").strip()[:255] or None),
        phone=(str(args.get("phone") or "").strip()[:50] or None),
        company_id=company_id,
    )
    contact = await contacts_service.create_contact(ctx.db, ctx.tenant.id, ctx.user.id, data)
    ctx.add_action(f"Open {contact.full_name}", kind="navigate", path=f"/contacts/{contact.id}")
    return {"ok": True, "summary": f"Contact {contact.full_name} created."}


async def _confirm_create_calendar_event(ctx: AgentContext, args: dict) -> dict:
    from app.modules.calendar.models import CalendarEvent
    from app.modules.calendar.service import TenantScopeError, _validate_event_fks

    title = str(args.get("title") or "").strip()[:255]
    start = _parse_tool_date(args.get("start_at"))
    if not title or start is None:
        return {"error": "title and start_at are required"}
    end = _parse_tool_date(args.get("end_at"))
    if end is not None and end <= start:
        return {"error": "end_at must be after start_at"}
    contact_id = _parse_uuid(args.get("contact_id"))
    try:
        await _validate_event_fks(ctx.db, ctx.tenant.id, contact_id=contact_id)
    except TenantScopeError as e:
        return {"error": str(e)}
    event = CalendarEvent(
        tenant_id=ctx.tenant.id,
        title=title,
        start_at=start,
        end_at=end,
        all_day=bool(args.get("all_day")),
        contact_id=contact_id,
        created_by=ctx.user.id,
    )
    ctx.db.add(event)
    await ctx.db.commit()
    ctx.add_action("Open calendar", kind="navigate", path="/calendar")
    when = start.strftime("%a %d %b") if event.all_day else start.strftime("%a %d %b %H:%M UTC")
    return {"ok": True, "summary": f"Event “{title}” created for {when}."}


async def _confirm_move_pipeline_stage(ctx: AgentContext, args: dict) -> dict:
    from app.modules.pipeline import service as pipeline_service

    contact_id = _parse_uuid(args.get("contact_id"))
    stage_id = _parse_uuid(args.get("stage_id"))
    if not contact_id or not stage_id:
        return {"error": "contact_id and stage_id are required"}
    try:
        await pipeline_service.move_contact_to_stage(ctx.db, ctx.tenant.id, contact_id, stage_id, actor_id=ctx.user.id)
    except ValueError as e:
        return {"error": str(e)}
    contact = await ctx.db.get(Contact, contact_id)
    stage = await pipeline_service.get_stage(ctx.db, ctx.tenant.id, stage_id)
    ctx.add_action("Open kanban", kind="navigate", path="/pipeline")
    return {"ok": True, "summary": f"{contact.full_name if contact else 'Contact'} moved to {stage.name if stage else 'the new stage'}."}


_CONFIRM_EXECUTORS = {
    "create_ticket": _confirm_create_ticket,
    "update_ticket": _confirm_update_ticket,
    "create_contact": _confirm_create_contact,
    "create_calendar_event": _confirm_create_calendar_event,
    "move_pipeline_stage": _confirm_move_pipeline_stage,
}


async def execute_confirmed(
    db: AsyncSession, user: User, tenant: Tenant, tool: str, args: dict
) -> dict:
    """[YIP3] Run a write action the user confirmed in the popup.

    The proposal turn already resolved every entity to tenant-scoped ids; this
    executes the write when Confirm is pressed. The payload comes back from the
    client, so the same module gate applies and every executor re-validates
    tenant ownership — it is never trusted.
    """
    executor = _CONFIRM_EXECUTORS.get(tool)
    if executor is None:
        return {"error": f"unknown action '{tool}'"}
    required = TOOL_MODULES.get(tool)
    if required is not None and required not in (tenant.enabled_modules or []):
        return {"error": f"the {required} module is not enabled for this workspace"}
    ctx = AgentContext(db, user, tenant, "none", None)
    try:
        result = await executor(ctx, args or {})
    except Exception:
        await db.rollback()
        return {"error": "the action failed. Nothing was changed"}
    if result.get("error"):
        return result
    out: dict = {"action_taken": "write_done", "summary": result["summary"]}
    if ctx.actions:
        out["actions"] = ctx.actions
    return out


_EXECUTORS = {
    "search_contacts": _tool_search_contacts,
    "get_contact_briefing": _tool_get_contact_briefing,
    "search_tickets": _tool_search_tickets,
    "list_open_tickets": _tool_list_open_tickets,
    "get_ticket_thread": _tool_get_ticket_thread,
    "draft_reply": _tool_draft_reply,
    "track_shipments": _tool_track_shipments,
    "list_calendar_events": _tool_list_calendar_events,
    "create_reminder": _tool_create_reminder,
    "add_contact_note": _tool_add_contact_note,
    "add_ticket_note": _tool_add_ticket_note,
    "open_page": _tool_open_page,
    "compose_email": _tool_compose_email,
    "get_platform_manual": _tool_get_platform_manual,
    "save_memory": _tool_save_memory,
    # [YIP4] read tools
    "list_pending_drafts": _tool_list_pending_drafts,
    "list_waiting_chats": _tool_list_waiting_chats,
    "check_email_engagement": _tool_check_email_engagement,
    "get_ticket_stats": _tool_get_ticket_stats,
    "get_revenue_summary": _tool_get_revenue_summary,
    "list_todays_bookings": _tool_list_todays_bookings,
    # [YIP3] proposal-only write tools
    "create_ticket": _tool_create_ticket,
    "update_ticket": _tool_update_ticket,
    "create_contact": _tool_create_contact,
    "create_calendar_event": _tool_create_calendar_event,
    "move_pipeline_stage": _tool_move_pipeline_stage,
}


async def _execute_tool(ctx: AgentContext, name: str, args: dict) -> dict:
    executor = _EXECUTORS.get(name)
    if executor is None:
        return {"error": f"unknown tool '{name}'"}
    # [YIP-GATE] belt-and-braces: refuse tools for modules the tenant doesn't have,
    # even if the model calls one that wasn't offered.
    required = TOOL_MODULES.get(name)
    if required is not None and required not in (ctx.tenant.enabled_modules or []):
        return {"error": f"the {required} module is not enabled for this workspace"}
    try:
        return await executor(ctx, args)
    except Exception as exc:  # tool failures go back to the model, not to a 500
        await ctx.db.rollback()
        return {"error": f"tool failed: {exc}"}


# ---------------------------------------------------------------------------
# Agent loop
# ---------------------------------------------------------------------------

async def run_agent_stream(
    db: AsyncSession,
    user: User,
    tenant: Tenant,
    body: str,
    context_type: str,
    context_id: str | None,
    route: str | None = None,
    history: list[dict] | None = None,
):
    """[YIP-STREAM] The tool loop as an event stream.

    Yields event dicts:
      {"type": "status", "tool": <name>}   — a tool call is about to run
      {"type": "delta",  "text": <token>}  — assistant text as it is generated
      {"type": "result", "data": <CaptureResponse-shaped dict>} — terminal, always last

    Providers may emit preamble text before deciding to call tools (Mistral does);
    the frontend discards streamed text whenever a status event arrives, and the
    terminal result's summary is always authoritative.
    """
    # Fast path: plain arithmetic never needs the model.
    math_result = service._safe_eval(body)
    if math_result is not None:
        yield {"type": "result", "data": {"action_taken": "math", "summary": str(math_result)}}
        return

    ctx = AgentContext(db, user, tenant, context_type, context_id)
    memories = await _load_memories(db, tenant.id, user.id)

    messages: list[dict] = [{"role": "system", "content": _build_system_prompt(ctx, route, memories)}]
    for m in (history or [])[-MAX_HISTORY:]:
        role = m.get("role")
        content = (m.get("content") or "").strip()
        if role in ("user", "assistant") and content:
            messages.append({"role": role, "content": content})
    messages.append({"role": "user", "content": body})

    tools = _tools_for_tenant(tenant)
    final_text = ""
    for _ in range(MAX_ITERATIONS):
        stream = await ai_stream_tools(messages, tools=tools)
        chunks = []
        async for chunk in stream:
            chunks.append(chunk)
            try:
                delta = chunk.choices[0].delta
            except (AttributeError, IndexError):
                continue
            text = getattr(delta, "content", None)
            if text:
                yield {"type": "delta", "text": text}
        full = litellm.stream_chunk_builder(chunks)
        msg = full.choices[0].message if full and full.choices else None
        tool_calls = getattr(msg, "tool_calls", None) if msg is not None else None
        if not tool_calls:
            final_text = ((msg.content if msg is not None else "") or "").strip()
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
            yield {"type": "status", "tool": tc.function.name}
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
    if ctx.actions:
        out["actions"] = ctx.actions
    yield {"type": "result", "data": out}


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
    """Run the tool loop and return a CaptureResponse-shaped dict (JSON path).

    Thin wrapper over run_agent_stream — consumes the events and returns only
    the terminal result, so the non-streaming /capture endpoint is unchanged.
    """
    result: dict = {"action_taken": "answer", "summary": "Done."}
    async for event in run_agent_stream(
        db, user, tenant, body, context_type, context_id, route=route, history=history
    ):
        if event["type"] == "result":
            result = event["data"]
    return result
