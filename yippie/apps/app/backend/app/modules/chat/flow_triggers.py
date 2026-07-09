"""[FLOW7] Live chat module trigger declarations for the flow registry."""
from __future__ import annotations

from app.modules.contacts.flow_triggers import contact_fields

_SOURCES = ["whatsapp", "websocket"]

TRIGGERS: dict[str, dict] = {
    "conversation_started": {
        "label": "Live chat conversation started",
        "module": "chat",
        "fields": [
            {"key": "source", "label": "Source", "type": "select", "options": _SOURCES},
            {"key": "visitor_name", "label": "Visitor name", "type": "text"},
        ],
        "fetch_fields": contact_fields,
        "example_payload": {"source": "", "visitor_name": "", "contact_id": None},
    },
    "conversation_solved": {
        "label": "Live chat conversation solved",
        "module": "chat",
        "fields": [
            {"key": "source", "label": "Source", "type": "select", "options": _SOURCES},
            {"key": "assigned_to", "label": "Assigned to", "type": "text"},
        ],
        "fetch_fields": contact_fields,
        "example_payload": {"source": "", "assigned_to": None, "contact_id": None},
    },
}
