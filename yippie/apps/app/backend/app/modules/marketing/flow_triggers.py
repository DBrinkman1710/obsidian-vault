"""[FLOW7] Marketing module trigger declarations for the flow registry."""
from __future__ import annotations

from app.modules.contacts.flow_triggers import contact_fields

TRIGGERS: dict[str, dict] = {
    "campaign_button_clicked": {
        "label": "Campaign email button clicked",
        "module": "marketing",
        "fields": [
            {"key": "action_type", "label": "Action type", "type": "select",
             "options": ["label", "pipeline_stage"]},
            {"key": "button_id", "label": "Button id", "type": "text"},
            {"key": "stage_id", "label": "Stage", "type": "stage_select"},
        ],
        "fetch_fields": contact_fields,
        "example_payload": {
            "action_type": "", "button_id": "", "stage_id": None,
            "label_id": None, "contact_id": None,
        },
    },
    "campaign_email_bounced": {
        "label": "Campaign email bounced",
        "module": "marketing",
        "fields": [
            {"key": "bounce_type", "label": "Bounce type", "type": "select",
             "options": ["hard", "soft"]},
            {"key": "to_email", "label": "To email", "type": "text"},
        ],
        "fetch_fields": contact_fields,
        "example_payload": {"bounce_type": "", "to_email": "", "contact_id": None},
    },
}
