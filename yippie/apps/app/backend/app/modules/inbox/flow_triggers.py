"""[FLOW7] Inbox module trigger declarations for the flow registry."""
from __future__ import annotations

from app.modules.contacts.flow_triggers import contact_fields

TRIGGERS: dict[str, dict] = {
    "draft_approved": {
        "label": "Inbox draft approved",
        "module": "inbox",
        "fields": [
            {"key": "priority", "label": "Priority", "type": "select",
             "options": ["low", "medium", "high", "urgent"]},
            {"key": "subject", "label": "Subject", "type": "text"},
        ],
        # Entity is a draft_ticket, so only the contact's state is fresh loadable —
        # this preserves the pre-[FLOW7] behaviour exactly.
        "fetch_fields": contact_fields,
        "example_payload": {
            "draft_id": None, "ticket_id": None, "subject": "",
            "priority": "", "contact_id": None,
        },
    },
}
