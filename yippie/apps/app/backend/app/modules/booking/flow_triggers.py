"""[FLOW7] Booking module trigger declarations for the flow registry."""
from __future__ import annotations

from app.modules.contacts.flow_triggers import contact_fields

TRIGGERS: dict[str, dict] = {
    "booking_created": {
        "label": "Booking confirmed",
        "module": "booking",
        "fields": [
            {"key": "title", "label": "Title", "type": "text"},
            {"key": "assigned_to", "label": "Assigned to", "type": "text"},
        ],
        "fetch_fields": contact_fields,
        "example_payload": {
            "title": "", "start_at": "", "end_at": "",
            "assigned_to": "", "contact_id": None,
        },
    },
    "booking_cancelled": {
        "label": "Booking cancelled",
        "module": "booking",
        "fields": [
            {"key": "title", "label": "Title", "type": "text"},
        ],
        "fetch_fields": contact_fields,
        "example_payload": {"title": "", "start_at": "", "contact_id": None},
    },
}
