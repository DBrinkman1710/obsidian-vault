// DO NOT EDIT — generated from packages/config/modules.json by packages/config/sync.mjs.
// Run `pnpm sync:config` after editing modules.json.
export const PLAN_LIMITS = {
  founder:    { users: 10, contacts: null, aiScans: 500, priceMonthly: 9, priceAnnual: 97, moduleDiscount: 0.5 },
  starter:    { users: 3, contacts: null, aiScans: 2000, priceMonthly: 19, priceAnnual: 205, moduleDiscount: 0 },
  growth:     { users: 10, contacts: null, aiScans: 5000, priceMonthly: 39, priceAnnual: 421, moduleDiscount: 0 },
  pro:        { users: 25, contacts: null, aiScans: 10000, priceMonthly: 69, priceAnnual: 745, moduleDiscount: 0 },
  enterprise: { users: null, contacts: null, aiScans: null, priceMonthly: null, priceAnnual: null, moduleDiscount: 0 },
} as const;

export const MODULE_PRICES = {
  tickets: 9,
  calendar: 7,
  pipeline: 7,
  billing: 7,
  contracts: 9,
  chat: 9,
  departments: 7,
  marketing: 9,
  tracking: 9,
  sales: 20,
  saas: 20,
  ai: 15,
} as const;

// Ordered module catalogue (id, label, icon, desc, core, price, recName).
export const MODULE_LIST = [
  { id: "inbox", label: "Inbox", icon: "📥", desc: "Shared inbox for email and messages, all in one place.", core: true, price: null, recName: null },
  { id: "contacts", label: "Contacts", icon: "👥", desc: "Customer profiles and company records.", core: true, price: null, recName: null },
  { id: "tickets", label: "Tickets", icon: "🎫", desc: "Track, assign, and close support requests with SLA alerts.", core: false, price: 9, recName: "Tickets" },
  { id: "calendar", label: "Calendar", icon: "📅", desc: "Booking links, availability grids, and appointment management.", core: false, price: 7, recName: "Calendar" },
  { id: "pipeline", label: "Pipeline", icon: "📌", desc: "Drag-and-drop Kanban to move leads and clients through custom stages.", core: false, price: 7, recName: "Pipeline" },
  { id: "booking", label: "Booking", icon: "🗓", desc: "Public booking pages and appointment scheduling (included with Calendar).", core: false, price: null, recName: null },
  { id: "activity", label: "Activity", icon: "📊", desc: "Unified timeline of emails, tickets, and pipeline moves.", core: true, price: null, recName: null },
  { id: "billing", label: "Billing", icon: "🧾", desc: "Issue invoices, track payments, and manage subscriptions.", core: false, price: 7, recName: "Billing" },
  { id: "contracts", label: "Contracts", icon: "📄", desc: "Store signed contracts, track renewals and notice periods, and get reminded before they expire.", core: false, price: 9, recName: "Contracts" },
  { id: "chat", label: "Live Chat", icon: "💬", desc: "Web chat widget + WhatsApp. All conversations in one inbox.", core: false, price: 9, recName: "Live Chat" },
  { id: "departments", label: "Departments", icon: "🏢", desc: "Route tickets and chats to the right team automatically.", core: false, price: 7, recName: "Departments" },
  { id: "marketing", label: "Marketing", icon: "📣", desc: "Email campaigns, A/B testing, drip sequences, and shared reply templates.", core: false, price: 9, recName: "Marketing" },
  { id: "tracking", label: "Shipment Tracking", icon: "📦", desc: "Live carrier updates for DHL, UPS, PostNL, and FedEx, linked to contacts.", core: false, price: 9, recName: "Shipment Tracking" },
  { id: "sales", label: "Sales", icon: "📈", desc: "Track product views, add-to-cart, and purchases. Identify high-intent buyers.", core: false, price: 20, recName: "Sales" },
  { id: "saas", label: "SaaS Analytics", icon: "🔁", desc: "Recurring subscriptions, MRR/churn tracking, linked to contacts.", core: false, price: 20, recName: "SaaS Analytics" },
  { id: "ai", label: "AI Inbox", icon: "✦", desc: "AI reads every message and drafts the ticket for you. One click to approve.", core: false, price: 15, recName: "AI Inbox" },
] as const;

export type PlanTier = keyof typeof PLAN_LIMITS;
export type ModuleId = (typeof MODULE_LIST)[number]["id"];
