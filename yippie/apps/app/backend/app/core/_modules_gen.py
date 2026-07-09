# DO NOT EDIT — generated from packages/config/modules.json by packages/config/sync.mjs.
# Run `pnpm sync:config` after editing modules.json.
from __future__ import annotations

ALL_MODULES: list[str] = ["inbox","contacts","tickets","calendar","pipeline","booking","activity","flows","billing","contracts","chat","departments","marketing","tracking","sales","saas","ai"]

CORE_MODULES: list[str] = ["inbox","contacts","activity","flows"]

# Paid add-on prices (euros/month), keyed by module id.
MODULE_PRICES: dict[str, int] = {
    "tickets": 9,
    "calendar": 7,
    "pipeline": 7,
    "billing": 7,
    "contracts": 9,
    "chat": 9,
    "departments": 7,
    "marketing": 9,
    "tracking": 9,
    "sales": 20,
    "saas": 20,
    "ai": 15,
}

# Stripe Checkout price lookup_key -> module id (paid add-ons only).
MODULE_STRIPE_KEYS: dict[str, str] = {
    "yippie_module_tickets": "tickets",
    "yippie_module_calendar": "calendar",
    "yippie_module_pipeline": "pipeline",
    "yippie_module_billing": "billing",
    "yippie_module_contracts": "contracts",
    "yippie_module_chat": "chat",
    "yippie_module_departments": "departments",
    "yippie_module_marketing": "marketing",
    "yippie_module_tracking": "tracking",
    "yippie_module_sales": "sales",
    "yippie_module_saas": "saas",
    "yippie_module_ai": "ai",
}

PLAN_ORDER: list[str] = ["founder","starter","growth","pro","enterprise"]

PLAN_LIMITS: dict[str, dict] = {
    "founder": {"users": 10, "contacts": None, "ai_scans": 500, "flows": 10, "price_monthly": 9, "price_annual": 97, "module_discount": 0.5},
    "starter": {"users": 3, "contacts": None, "ai_scans": 2000, "flows": 3, "price_monthly": 19, "price_annual": 205, "module_discount": 0},
    "growth": {"users": 10, "contacts": None, "ai_scans": 5000, "flows": 10, "price_monthly": 39, "price_annual": 421, "module_discount": 0},
    "pro": {"users": 25, "contacts": None, "ai_scans": 10000, "flows": 25, "price_monthly": 69, "price_annual": 745, "module_discount": 0},
    "enterprise": {"users": None, "contacts": None, "ai_scans": None, "flows": None, "price_monthly": None, "price_annual": None, "module_discount": 0},
}

# Display metadata for pickers/pricing UIs.
MODULE_META: dict[str, dict] = {
    "inbox": {"label": "Inbox", "icon": "📥", "desc": "Shared inbox for email and messages, all in one place.", "core": True, "price": None},
    "contacts": {"label": "Contacts", "icon": "👥", "desc": "Customer profiles and company records.", "core": True, "price": None},
    "tickets": {"label": "Tickets", "icon": "🎫", "desc": "Track, assign, and close support requests with SLA alerts.", "core": False, "price": 9},
    "calendar": {"label": "Calendar", "icon": "📅", "desc": "Booking links, availability grids, and appointment management.", "core": False, "price": 7},
    "pipeline": {"label": "Pipeline", "icon": "📌", "desc": "Drag-and-drop Kanban to move leads and clients through custom stages.", "core": False, "price": 7},
    "booking": {"label": "Booking", "icon": "🗓", "desc": "Public booking pages and appointment scheduling (included with Calendar).", "core": False, "price": None},
    "activity": {"label": "Activity", "icon": "📊", "desc": "Unified timeline of emails, tickets, and pipeline moves.", "core": True, "price": None},
    "flows": {"label": "Flows", "icon": "⚡", "desc": "Automations that connect your modules: when something happens, Yippie moves stages, notifies your team, or sends an email.", "core": True, "price": None},
    "billing": {"label": "Billing", "icon": "🧾", "desc": "Issue invoices, track payments, and manage subscriptions.", "core": False, "price": 7},
    "contracts": {"label": "Contracts", "icon": "📄", "desc": "Store signed contracts, track renewals and notice periods, and get reminded before they expire.", "core": False, "price": 9},
    "chat": {"label": "Live Chat", "icon": "💬", "desc": "Web chat widget + WhatsApp. All conversations in one inbox.", "core": False, "price": 9},
    "departments": {"label": "Departments", "icon": "🏢", "desc": "Route tickets and chats to the right team automatically.", "core": False, "price": 7},
    "marketing": {"label": "Marketing", "icon": "📣", "desc": "Email campaigns, A/B testing, drip sequences, and shared reply templates.", "core": False, "price": 9},
    "tracking": {"label": "Shipment Tracking", "icon": "📦", "desc": "Live carrier updates for DHL, UPS, PostNL, and FedEx, linked to contacts.", "core": False, "price": 9},
    "sales": {"label": "Sales", "icon": "📈", "desc": "Track product views, add-to-cart, and purchases. Identify high-intent buyers.", "core": False, "price": 20},
    "saas": {"label": "SaaS Analytics", "icon": "🔁", "desc": "Recurring subscriptions, MRR/churn tracking, linked to contacts.", "core": False, "price": 20},
    "ai": {"label": "AI Inbox", "icon": "✦", "desc": "AI reads every message and drafts the ticket for you. One click to approve.", "core": False, "price": 15},
}
