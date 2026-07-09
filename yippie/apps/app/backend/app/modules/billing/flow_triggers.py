"""[FLOW7] Billing module trigger declarations for the flow registry."""
from __future__ import annotations

from app.modules.contacts.flow_triggers import contact_fields

TRIGGERS: dict[str, dict] = {
    "invoice_overdue": {
        "label": "Invoice became overdue",
        "module": "billing",
        "fields": [
            {"key": "invoice_number", "label": "Invoice number", "type": "text"},
            {"key": "total", "label": "Total", "type": "number"},
        ],
        "fetch_fields": contact_fields,
        "example_payload": {
            "invoice_number": "", "total": 0, "currency": "",
            "due_date": None, "contact_id": None,
        },
    },
}
