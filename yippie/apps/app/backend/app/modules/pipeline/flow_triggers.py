"""[FLOW7] Pipeline module trigger declarations for the flow registry."""
from __future__ import annotations

from app.modules.contacts.flow_triggers import contact_fields

TRIGGERS: dict[str, dict] = {
    "pipeline_stage_changed": {
        "label": "Pipeline stage changed",
        "module": "pipeline",
        "fields": [
            {"key": "stage_id", "label": "New stage", "type": "stage_select"},
            {"key": "from_stage_id", "label": "Previous stage", "type": "stage_select"},
            {"key": "stage_name", "label": "New stage name", "type": "text"},
        ],
        "fetch_fields": contact_fields,
        "example_payload": {"stage_id": "", "stage_name": "", "from_stage_id": "", "contact_id": ""},
    },
}
