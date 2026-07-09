"""[FLOW7] Shipments (module id "tracking") trigger declarations for the flow registry."""
from __future__ import annotations

from app.modules.contacts.flow_triggers import contact_fields

# Mirrors ShipmentStatus in shipments/models.py.
_STATUSES = [
    "registered", "in_transit", "out_for_delivery",
    "delivered", "exception", "returned", "cancelled",
]

TRIGGERS: dict[str, dict] = {
    "order_received": {
        "label": "Order received (ERP)",
        "module": "tracking",
        "fields": [
            {"key": "status", "label": "Status", "type": "select", "options": _STATUSES},
            {"key": "order_number", "label": "Order number", "type": "text"},
            {"key": "carrier", "label": "Carrier", "type": "text"},
        ],
        "fetch_fields": contact_fields,
        "example_payload": {
            "order_number": "", "status": "", "carrier": "",
            "tracking_number": "", "contact_id": None,
        },
    },
}
