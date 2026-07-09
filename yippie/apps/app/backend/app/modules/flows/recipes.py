"""Pre-built flow recipes — installed as normal, editable flows.

Recipes install disabled with tenant-specific ids (stage, user, template) left
blank; the builder opens prefilled and enabling validates completeness, so a
recipe can never half-run with dangling references.
"""
from __future__ import annotations

RECIPES: list[dict] = [
    {
        "key": "urgent_ticket_notify",
        "name": "Urgent ticket alert",
        "description": "When a high or urgent ticket comes in, notify a team member instantly.",
        "trigger_type": "ticket_created",
        "conditions": [{"field": "priority", "op": "in", "value": ["high", "urgent"]}],
        "actions": [
            {"type": "notify_user", "config": {"message": "Urgent ticket needs attention: {subject}"}},
        ],
    },
    {
        "key": "welcome_new_contact",
        "name": "Welcome new contacts",
        "description": "Send every new contact a welcome email and drop them into your pipeline.",
        "trigger_type": "contact_created",
        "conditions": [],
        "actions": [
            {"type": "send_email", "config": {
                "subject": "Welcome!",
                "body": "Hi {full_name},\n\nThanks for getting in touch. We will get back to you shortly.",
            }},
            {"type": "move_pipeline_stage", "config": {}},
        ],
    },
    {
        "key": "draft_approved_move_stage",
        "name": "Approved inbox draft moves the deal",
        "description": "When an inbox draft is approved into a ticket, move the contact to a pipeline stage.",
        "trigger_type": "draft_approved",
        "conditions": [],
        "actions": [
            {"type": "move_pipeline_stage", "config": {}},
        ],
    },
    {
        "key": "resolved_ticket_move_stage",
        "name": "Resolved ticket moves the deal",
        "description": "When a ticket is resolved, move the contact to a pipeline stage.",
        "trigger_type": "ticket_status_changed",
        "conditions": [{"field": "status", "op": "equals", "value": "resolved"}],
        "actions": [
            {"type": "move_pipeline_stage", "config": {}},
        ],
    },
    {
        "key": "review_request",
        "name": "Ask for a review",
        "description": "When a ticket is resolved, thank the customer and ask them to leave a review. Adjust the email text or pick one of your own templates before enabling.",
        "trigger_type": "ticket_status_changed",
        "conditions": [{"field": "status", "op": "equals", "value": "resolved"}],
        "actions": [
            {"type": "send_email", "config": {
                "subject": "How did we do, {full_name}?",
                "body": (
                    "Hi {full_name},\n\n"
                    "We just wrapped up your request \"{subject}\" and hope everything "
                    "is taken care of.\n\n"
                    "Would you take a minute to share your experience? It really helps "
                    "us out:\n[add your review link here]\n\n"
                    "Thanks!"
                ),
            }},
        ],
    },
    {
        "key": "new_contact_follow_up",
        "name": "Follow up on new contacts",
        "description": "Create a follow-up ticket whenever a new contact is added.",
        "trigger_type": "contact_created",
        "conditions": [],
        "actions": [
            {"type": "create_ticket", "config": {
                "subject": "Follow up with {full_name}",
                "priority": "medium",
            }},
        ],
    },
]

RECIPES_BY_KEY = {r["key"]: r for r in RECIPES}
