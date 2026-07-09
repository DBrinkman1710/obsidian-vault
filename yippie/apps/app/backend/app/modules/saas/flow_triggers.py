"""[FLOW7] SaaS analytics module trigger declarations for the flow registry."""
from __future__ import annotations

from app.modules.contacts.flow_triggers import contact_fields

TRIGGERS: dict[str, dict] = {
    "saas_health_dropped": {
        "label": "SaaS health score dropped",
        "module": "saas",
        "fields": [
            {"key": "score", "label": "Current score", "type": "number"},
            {"key": "previous_score", "label": "Previous score", "type": "number"},
            {"key": "drop", "label": "Points dropped", "type": "number"},
        ],
        "fetch_fields": contact_fields,
        "example_payload": {"score": 0, "previous_score": 0, "drop": 0},
    },
    "saas_signup": {
        "label": "SaaS signup tracked",
        "module": "saas",
        "fields": [
            {"key": "email", "label": "Email", "type": "text"},
            {"key": "anonymous_id", "label": "Anonymous id", "type": "text"},
        ],
        "fetch_fields": contact_fields,
        "example_payload": {"email": "", "anonymous_id": "", "contact_id": None},
    },
}
