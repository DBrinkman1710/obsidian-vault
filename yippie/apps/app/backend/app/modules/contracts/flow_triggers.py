"""[FLOW7] Contracts module trigger declarations for the flow registry."""
from __future__ import annotations

from app.modules.contacts.flow_triggers import contact_fields

TRIGGERS: dict[str, dict] = {
    "contract_expiring": {
        "label": "Contract expiring soon",
        "module": "contracts",
        "fields": [
            {"key": "days_left", "label": "Days left", "type": "number"},
            {"key": "title", "label": "Title", "type": "text"},
            {"key": "counterparty", "label": "Counterparty", "type": "text"},
        ],
        "fetch_fields": contact_fields,
        "example_payload": {
            "title": "", "counterparty": "", "days_left": 0,
            "end_date": "", "contact_id": None,
        },
    },
}
