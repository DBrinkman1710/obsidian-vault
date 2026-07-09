"""[FLOW7] Tickets module trigger declarations for the flow registry.

Owns the shared field-option constants (_PRIORITIES/_STATUSES/_CHANNELS) that the
ticket triggers pick from, and `ticket_fields` — the fresh-state loader ([FLOW4])
that reads the ticket's CURRENT status/priority/assignee/subject and merges the
contact's live fields on top, so a post-wait branch ("if STILL open") sees reality.

Model imports are deferred inside the loader to keep the registry import light.
"""
from __future__ import annotations

import uuid

from app.modules.contacts.flow_triggers import contact_fields

_PRIORITIES = ["low", "medium", "high", "urgent"]
_STATUSES = ["open", "in_progress", "waiting", "resolved", "closed"]
_CHANNELS = ["manual", "email", "whatsapp", "chat", "portal"]


async def ticket_fields(db, tenant, event) -> dict:
    """Current ticket state (status/priority/assigned_to/subject) merged with the
    contact's live fields — so ticket AND contact conditions evaluate against
    reality on any ticket trigger. Returns just the contact fields when the event
    isn't a ticket (or the ticket is gone)."""
    fields = await contact_fields(db, tenant, event)
    if event.get("entity_type") == "ticket" and event.get("entity_id"):
        from app.modules.tickets.models import Ticket

        ticket = await db.get(Ticket, uuid.UUID(str(event["entity_id"])))
        if ticket is not None and ticket.tenant_id == tenant.id and ticket.deleted_at is None:
            fields.update({
                "status": getattr(ticket.status, "value", ticket.status),
                "priority": getattr(ticket.priority, "value", ticket.priority),
                "assigned_to": str(ticket.assigned_to) if ticket.assigned_to else None,
                "subject": ticket.subject,
            })
    return fields


TRIGGERS: dict[str, dict] = {
    "ticket_created": {
        "label": "Ticket created",
        "module": "tickets",
        "fields": [
            {"key": "priority", "label": "Priority", "type": "select", "options": _PRIORITIES},
            {"key": "channel", "label": "Channel", "type": "select", "options": _CHANNELS},
            {"key": "subject", "label": "Subject", "type": "text"},
        ],
        "fetch_fields": ticket_fields,
        "example_payload": {
            "subject": "", "priority": "", "status": "", "channel": "",
            "contact_id": None, "assigned_to": None, "department_id": None,
        },
    },
    "ticket_status_changed": {
        "label": "Ticket status changed",
        "module": "tickets",
        "fields": [
            {"key": "status", "label": "New status", "type": "select", "options": _STATUSES},
            {"key": "old_status", "label": "Previous status", "type": "select", "options": _STATUSES},
            {"key": "priority", "label": "Priority", "type": "select", "options": _PRIORITIES},
            {"key": "subject", "label": "Subject", "type": "text"},
        ],
        "fetch_fields": ticket_fields,
        "example_payload": {
            "subject": "", "old_status": "", "status": "", "priority": "",
            "contact_id": None, "assigned_to": None,
        },
    },
    "ticket_sla_due_soon": {
        "label": "Ticket SLA due soon",
        "module": "tickets",
        "fields": [
            {"key": "due_in_minutes", "label": "Due within (minutes)", "type": "number"},
            {"key": "priority", "label": "Priority", "type": "select", "options": _PRIORITIES},
            {"key": "status", "label": "Status", "type": "select",
             "options": ["open", "in_progress"]},
            {"key": "subject", "label": "Subject", "type": "text"},
        ],
        "fetch_fields": ticket_fields,
        "example_payload": {
            "subject": "", "priority": "", "status": "", "due_in_minutes": 0,
            "assigned_to": None, "sla_due_at": "",
        },
    },
}
