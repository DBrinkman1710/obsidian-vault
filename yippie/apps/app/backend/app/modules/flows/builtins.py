"""[FLOW8] The built-in automations catalogue.

A static, read-only inventarisation of everything Yippie does automatically for a
tenant WITHOUT them wiring up a flow — the always-on platform automations. It's
surfaced on the /flows page ("Platform automations") so the value is visible, and
it's the counterpart to the four automations that FLOW8 migrated INTO editable
flows (those are gone from here — a flow now owns them).

Each entry:
    key          snake_case, unique
    name         short human title
    description  one plain sentence: what Yippie does automatically
    module       module id whose enablement shows the card (None → always shown)
    cadence      human string ("hourly", "on arrival", "realtime", …)
    settings_path (optional) frontend route to configure it, when one exists

NEVER list platform-internal jobs here (demo/trial/subscription expiry, retention
purge, onboarding drip, calendar sync, engine ticks) — those aren't customer value.
"""
from __future__ import annotations

BUILTINS: list[dict] = [
    {
        "key": "inbox_ai_scan",
        "name": "AI drafts your tickets",
        "description": "Inbound email and WhatsApp is scanned by AI and turned into a draft ticket for review.",
        "module": "inbox",
        "cadence": "on arrival",
    },
    {
        "key": "ticket_auto_close",
        "name": "Stale tickets close themselves",
        "description": "Tickets waiting on a customer are closed automatically after your configured quiet period.",
        "module": "tickets",
        "cadence": "hourly",
    },
    {
        "key": "erp_contact_sync",
        "name": "Orders sync your contacts",
        "description": "Incoming ERP orders create or update the matching contact, tagged order system.",
        "module": "tracking",
        "cadence": "on arrival",
    },
    {
        "key": "campaign_button_actions",
        "name": "Campaign buttons take action",
        "description": "Campaign email buttons apply their configured label or pipeline stage when clicked.",
        "module": "marketing",
        "cadence": "on click",
    },
    {
        "key": "booking_invitation_email",
        "name": "Booking links invite the customer",
        "description": "Booking links email the customer a calendar invitation automatically.",
        "module": "booking",
        "cadence": "on send",
    },
    {
        "key": "contract_lifecycle",
        "name": "Contracts renew and expire on time",
        "description": "Contracts auto expire or auto renew at term end, with notice and expiry reminders.",
        "module": "contracts",
        "cadence": "every 6 hours",
    },
    {
        "key": "invoice_overdue_flip",
        "name": "Overdue invoices flag themselves",
        "description": "Sent invoices flip to overdue once their due date passes.",
        "module": "billing",
        "cadence": "daily",
    },
    {
        "key": "campaign_scheduler",
        "name": "Campaigns run on their own",
        "description": "Scheduled sends, A/B winner selection, drip sequences and engagement decay run on their own schedules.",
        "module": "marketing",
        "cadence": "continuous",
    },
    {
        "key": "saas_health_compute",
        "name": "Health scores stay current",
        "description": "Customer health scores are recomputed hourly, with a Monday at risk digest.",
        "module": "saas",
        "cadence": "hourly",
    },
    {
        "key": "livechat_auto_claim",
        "name": "Live chats auto assign",
        "description": "A live chat conversation is claimed by the first agent who replies.",
        "module": "chat",
        "cadence": "realtime",
    },
    {
        "key": "yip_morning_briefing",
        "name": "Yip's morning briefing",
        "description": "Yip prepares a morning briefing at each user's configured time.",
        "module": None,
        "cadence": "daily",
    },
]


def builtins_for(enabled_modules: list[str]) -> list[dict]:
    """The catalogue entries visible to a tenant: module None is always shown,
    otherwise the tenant must have the entry's module enabled."""
    enabled = set(enabled_modules or [])
    return [b for b in BUILTINS if b["module"] is None or b["module"] in enabled]
