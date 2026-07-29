"""Flow action executors.

Each executor is a plain async function ``(db, tenant, event, config) -> dict``
running in its own tenant-scoped session (the engine sets the tenant context).
They reuse the same module service calls Yip's confirm executors trust, always
passing ``source="flow"`` so mutations they cause never trigger further flows.

``event`` is the engine's snapshot dict:
    {"event_type", "entity_type", "entity_id", "contact_id", "actor_id", "fields": {...}}

Executors return {"ok": bool, "skipped": bool, "summary": str}. Raising marks
the action (and the run) failed; ``skipped`` is for soft misses (no contact on
the event, module since disabled) that shouldn't read as errors.
"""
from __future__ import annotations

import re
import uuid
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.models import Tenant, User, UserReminder

# Same idea as Yip's TOOL_MODULES gate: an action is only executable while the
# tenant still has the module it writes into.
ACTION_MODULES: dict[str, Optional[str]] = {
    "create_ticket": "tickets",
    "update_ticket": "tickets",
    "move_pipeline_stage": "pipeline",
    "notify_user": None,
    "send_email": "inbox",
    "send_webhook": None,  # [FLOW5] posts to an external URL — no internal module
    "wait": None,  # [FLOW2] engine-special-cased pseudo action (no executor)
}

# Action catalogue for the builder UI (config fields per action).
ACTION_META: dict[str, dict] = {
    "create_ticket": {
        "label": "Create a ticket",
        "module": "tickets",
        "config_fields": [
            {"key": "subject", "label": "Subject", "type": "text", "required": True},
            {"key": "description", "label": "Description", "type": "textarea"},
            {"key": "priority", "label": "Priority", "type": "select",
             "options": ["low", "medium", "high", "urgent"]},
            {"key": "assigned_to", "label": "Assign to", "type": "user_select"},
        ],
    },
    "update_ticket": {
        "label": "Update the ticket",
        "module": "tickets",
        "config_fields": [
            {"key": "status", "label": "Set status", "type": "select",
             "options": ["open", "in_progress", "waiting", "resolved", "closed"]},
            {"key": "priority", "label": "Set priority", "type": "select",
             "options": ["low", "medium", "high", "urgent"]},
            {"key": "assigned_to", "label": "Assign to", "type": "user_select"},
        ],
    },
    "move_pipeline_stage": {
        "label": "Move contact to pipeline stage",
        "module": "pipeline",
        "config_fields": [
            {"key": "stage_id", "label": "Stage", "type": "stage_select", "required": True},
        ],
    },
    "notify_user": {
        "label": "Notify a team member",
        "module": None,
        "config_fields": [
            # [FLOW8] recipient picks WHO gets the reminder. "assigned agent"
            # resolves the target from the event's assigned_to at run time (so a
            # single flow notifies whoever owns the ticket); "specific user"
            # falls back to the user_id below.
            {"key": "recipient", "label": "Send to", "type": "select",
             "options": ["specific user", "assigned agent"]},
            {"key": "user_id", "label": "Team member", "type": "user_select", "required": True},
            {"key": "message", "label": "Message", "type": "textarea", "required": True},
        ],
    },
    "send_email": {
        "label": "Email the contact",
        "module": "inbox",
        "config_fields": [
            {"key": "subject", "label": "Subject", "type": "text", "required": True},
            {"key": "body", "label": "Body", "type": "textarea"},
            {"key": "template_id", "label": "Or use a template", "type": "template_select"},
        ],
    },
    # [FLOW5] POST event data to an external URL, signed with the tenant's
    # webhook secret. SSRF-guarded; delivery failures ride the retry ladder.
    "send_webhook": {
        "label": "Send a webhook",
        "module": None,
        "config_fields": [
            {"key": "url", "label": "Destination URL", "type": "text", "required": True},
        ],
    },
    # [FLOW2] Pause the flow before the next action. The builder renders this
    # with a bespoke "number + unit" control (frontend), but the three keys are
    # listed so the config whitelist (schemas._ACTION_CONFIG_KEYS) accepts them.
    # Deliberately NOT in ACTION_EXECUTORS — the engine special-cases it.
    "wait": {
        "label": "Wait",
        "module": None,
        "config_fields": [
            {"key": "minutes", "label": "Minutes", "type": "number"},
            {"key": "hours", "label": "Hours", "type": "number"},
            {"key": "days", "label": "Days", "type": "number"},
        ],
    },
}

_PLACEHOLDER_RE = re.compile(r"\{([a-z_]+)\}")


def render_placeholders(text: str, fields: dict) -> str:
    """Replace {payload_key} placeholders with event values; unknown keys stay."""

    def _sub(match: re.Match) -> str:
        value = fields.get(match.group(1))
        if value is None:
            return match.group(0)
        if isinstance(value, list):
            return ", ".join(str(v) for v in value)
        return str(value)

    return _PLACEHOLDER_RE.sub(_sub, text or "")


def _ok(summary: str) -> dict:
    return {"ok": True, "skipped": False, "summary": summary}


def _skip(summary: str) -> dict:
    return {"ok": False, "skipped": True, "summary": summary}


def _event_contact_id(event: dict) -> Optional[uuid.UUID]:
    raw = event.get("contact_id")
    return uuid.UUID(str(raw)) if raw else None


async def _act_create_ticket(db: AsyncSession, tenant: Tenant, event: dict, config: dict) -> dict:
    from app.modules.tickets.models import TicketPriority
    from app.modules.tickets.schemas import TicketCreate
    from app.modules.tickets import service as tickets_service

    fields = event["fields"]
    data = TicketCreate(
        subject=render_placeholders(config["subject"], fields)[:500],
        description=render_placeholders(config.get("description") or "", fields) or None,
        priority=TicketPriority(config.get("priority") or "medium"),
        contact_id=_event_contact_id(event),
        assigned_to=uuid.UUID(config["assigned_to"]) if config.get("assigned_to") else None,
    )
    ticket = await tickets_service.create_ticket(db, tenant.id, None, data, source="flow")
    return _ok(f"Created ticket '{ticket.subject}'")


async def _act_update_ticket(db: AsyncSession, tenant: Tenant, event: dict, config: dict) -> dict:
    from app.modules.tickets.models import TicketStatus
    from app.modules.tickets.schemas import TicketUpdate
    from app.modules.tickets import service as tickets_service

    if event.get("entity_type") != "ticket" or not event.get("entity_id"):
        return _skip("Event has no ticket to update")
    ticket = await tickets_service.get_ticket_orm(db, tenant.id, uuid.UUID(str(event["entity_id"])))
    if ticket is None:
        return _skip("Ticket no longer exists")

    changes: list[str] = []
    update_fields: dict = {}
    if config.get("priority"):
        update_fields["priority"] = config["priority"]
        changes.append(f"priority → {config['priority']}")
    if config.get("assigned_to"):
        update_fields["assigned_to"] = uuid.UUID(config["assigned_to"])
        changes.append("assignee set")
    if update_fields:
        await tickets_service.update_ticket(db, ticket, TicketUpdate(**update_fields), source="flow")
    if config.get("status"):
        await tickets_service.change_status(db, ticket, TicketStatus(config["status"]), source="flow")
        changes.append(f"status → {config['status']}")
    if not changes:
        return _skip("Nothing to change")
    return _ok(f"Updated ticket ({', '.join(changes)})")


async def _act_move_pipeline_stage(db: AsyncSession, tenant: Tenant, event: dict, config: dict) -> dict:
    from app.modules.pipeline import service as pipeline_service

    contact_id = _event_contact_id(event)
    if contact_id is None:
        return _skip("Event has no contact to move")
    try:
        await pipeline_service.move_contact_to_stage(
            db, tenant.id, contact_id, uuid.UUID(config["stage_id"]), actor_id=None, source="flow"
        )
    except ValueError as exc:
        return _skip(str(exc))
    return _ok("Moved contact to stage")


async def _act_notify_user(db: AsyncSession, tenant: Tenant, event: dict, config: dict) -> dict:
    # [FLOW8] "assigned agent" resolves the recipient from the event's
    # assigned_to at run time; otherwise the configured user_id is used.
    if config.get("recipient") == "assigned agent":
        assignee = event.get("fields", {}).get("assigned_to")
        if not assignee:
            return _skip("Ticket has no assigned agent")
        user_id = uuid.UUID(str(assignee))
    else:
        if not config.get("user_id"):
            return _skip("No team member configured")
        user_id = uuid.UUID(config["user_id"])
    exists = await db.scalar(
        select(User.id).where(User.id == user_id, User.tenant_id == tenant.id)
    )
    if exists is None:
        return _skip("User no longer exists")
    db.add(UserReminder(
        user_id=user_id,
        tenant_id=tenant.id,
        body=render_placeholders(config["message"], event["fields"])[:2000],
        remind_at=datetime.now(timezone.utc),
    ))
    await db.commit()
    return _ok("Notified team member")


async def _act_send_email(db: AsyncSession, tenant: Tenant, event: dict, config: dict) -> dict:
    from app.modules.contacts.models import Contact
    from app.modules.inbox.service import queue_send
    from app.modules.tickets.models import ResponseTemplate

    contact_id = _event_contact_id(event)
    if contact_id is None:
        return _skip("Event has no contact to email")
    contact = await db.scalar(
        select(Contact).where(Contact.id == contact_id, Contact.tenant_id == tenant.id)
    )
    if contact is None or not contact.email:
        return _skip("Contact has no email address")

    fields = event["fields"]
    body, prerendered_html = "", None
    if config.get("template_id"):
        template = await db.scalar(
            select(ResponseTemplate).where(
                ResponseTemplate.id == uuid.UUID(config["template_id"]),
                ResponseTemplate.tenant_id == tenant.id,
            )
        )
        if template is None:
            return _skip("Template no longer exists")
        body = template.body
        prerendered_html = template.html_body
    else:
        body = render_placeholders(config.get("body") or "", fields)
    if not body:
        return _skip("Nothing to send: empty body")

    await queue_send(
        db,
        draft_id=uuid.uuid4(),
        tenant_id=tenant.id,
        to_email=contact.email,
        subject=render_placeholders(config["subject"], fields)[:500],
        reply_text=body,
        send_at=datetime.now(timezone.utc),
        contact_id=contact.id,
        kind="compose",
        prerendered_html=prerendered_html,
    )
    return _ok(f"Emailed {contact.email}")


async def _ensure_webhook_secret(db: AsyncSession, tenant: Tenant) -> str:
    """The tenant's outbound signing secret, minted on first use. Persisted so a
    receiver's configured secret stays stable across sends."""
    if tenant.flow_webhook_secret:
        return tenant.flow_webhook_secret
    import secrets as _secrets
    from sqlalchemy import update as _update

    secret = _secrets.token_urlsafe(32)
    await db.execute(
        _update(Tenant).where(Tenant.id == tenant.id).values(flow_webhook_secret=secret)
    )
    await db.commit()
    tenant.flow_webhook_secret = secret
    return secret


async def _act_send_webhook(db: AsyncSession, tenant: Tenant, event: dict, config: dict) -> dict:
    import httpx

    from app.modules.flows import webhooks

    url = render_placeholders(config.get("url") or "", event["fields"]).strip()
    if not url:
        return _skip("No destination URL set")
    secret = await _ensure_webhook_secret(db, tenant)
    payload = {
        "flow": {"tenant": str(tenant.id)},
        "event": {
            "type": event.get("event_type"),
            "entity_type": event.get("entity_type"),
            "entity_id": event.get("entity_id"),
            "contact_id": event.get("contact_id"),
            "fields": event.get("fields") or {},
        },
    }
    try:
        code = await webhooks.deliver(url, payload, secret)
    except webhooks.WebhookError as exc:
        # Permanent (bad/blocked URL) — a hard failure, not worth retrying.
        return {"ok": False, "skipped": False, "summary": str(exc)}
    except httpx.HTTPError as exc:
        # Transient (receiver down/slow/non-2xx) — raise into the retry ladder.
        raise RuntimeError(f"Webhook delivery failed: {exc}") from exc
    return _ok(f"Delivered webhook to {url} ({code})")


ACTION_EXECUTORS = {
    "create_ticket": _act_create_ticket,
    "update_ticket": _act_update_ticket,
    "move_pipeline_stage": _act_move_pipeline_stage,
    "notify_user": _act_notify_user,
    "send_email": _act_send_email,
    "send_webhook": _act_send_webhook,
}
