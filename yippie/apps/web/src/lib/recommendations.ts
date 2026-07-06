// Shared questionnaire + module recommendation logic
// Used by /pricing, /request-demo, /custom, and /signup

export const TEAM_SIZES = ["1–3", "4–10", "11–25", "25+"];

export const INDUSTRIES = [
  "E-commerce",
  "SaaS / Tech",
  "Services / Agency",
  "Healthcare",
  "Retail",
  "Logistics / Wholesale",
  "Other",
];

export const TOOLS = [
  "Email only",
  "Zendesk / Freshdesk",
  "HubSpot / CRM",
  "Intercom / Drift",
  "WhatsApp / Social media",
  "None / Spreadsheets",
];

export const PAIN_POINTS = [
  "Too many support tickets",
  "Manual sorting & routing",
  "Slow response times",
  "Scattered channels (email, WhatsApp, chat)",
  "Missing automation",
  "Losing track of customers",
  "Shipment & order queries",
  "No follow-up on leads or deals",
  "Missed appointments or no-shows",
  "Chasing invoices or late payments",
  "Too many billing questions from customers",
  "Contracts or renewals slipping through",
  "No way to reach customers proactively",
  "No visibility into what customers are buying",
  "Too many how-to or onboarding questions from users",
];

export const MODULE_INFO: Record<string, { icon: string; desc: string }> = {
  "AI Inbox":         { icon: "✦",  desc: "AI reads every message and drafts the ticket for you. One click to approve." },
  "Tickets":          { icon: "🎫", desc: "Track, assign, and close support requests with SLA alerts" },
  "Live Chat":        { icon: "💬", desc: "Web chat widget + WhatsApp. All conversations in one inbox." },
  "Calendar":         { icon: "📅", desc: "Booking links, availability grids, and appointment management" },
  "Pipeline":         { icon: "📌", desc: "Drag-and-drop Kanban to move leads and clients through custom stages" },
  "Marketing":        { icon: "📣", desc: "Email campaigns, A/B testing, drip sequences, and shared reply templates" },
  "Departments":      { icon: "🏢", desc: "Route tickets and chats to the right team automatically" },
  "Billing":          { icon: "🧾", desc: "Issue invoices, track payments, and manage subscriptions" },
  "Contracts":        { icon: "📄", desc: "Store signed contracts, track renewals and notice periods, get reminded in time" },
  "Shipment Tracking":{ icon: "📦", desc: "Live carrier updates for DHL, UPS, PostNL, and FedEx, linked to contacts." },
  "Sales":            { icon: "📈", desc: "Track product views, add-to-cart, and purchases. Identify high-intent buyers." },
  "SaaS Analytics":   { icon: "🔁", desc: "Recurring subscriptions, MRR/churn tracking, linked to contacts" },
};

// Canonical display order — used as the tie-breaker when scores are equal.
const MODULE_ORDER = Object.keys(MODULE_INFO);

export const TOP_MODULES = ["AI Inbox", "Tickets", "Live Chat", "Pipeline"];

const PAIN_POINT_ALIASES: Record<string, string> = {
  "Ticket volume":        "Too many support tickets",
  "Slow responses":       "Slow response times",
  "Manual sorting":       "Manual sorting & routing",
  "No reporting":         "Too many support tickets",
  "Customer follow-up":   "Losing track of customers",
};

// Signal weights. An explicitly stated pain point is the strongest buying
// signal, the tools someone is replacing say a lot too, and industry is a
// generic guess. Scores only affect ordering — every module with at least
// one signal is recommended; nothing gets silently dropped.
const PAIN_WEIGHT = 3;
const TOOL_WEIGHT = 2;
const INDUSTRY_WEIGHT = 1;

const PAIN_POINT_MODULES: Record<string, string[]> = {
  "Too many support tickets":                           ["Tickets", "AI Inbox", "Departments"],
  "Manual sorting & routing":                           ["Departments", "AI Inbox"],
  "Slow response times":                                ["AI Inbox", "Tickets", "Live Chat"],
  "Scattered channels (email, WhatsApp, chat)":         ["Live Chat"],
  "Missing automation":                                 ["AI Inbox", "Marketing"],
  "Losing track of customers":                          ["Pipeline"],
  "Shipment & order queries":                           ["Shipment Tracking", "AI Inbox"],
  "No follow-up on leads or deals":                     ["Pipeline", "Marketing"],
  "Missed appointments or no-shows":                    ["Calendar"],
  "Chasing invoices or late payments":                  ["Billing"],
  "Too many billing questions from customers":          ["Billing", "AI Inbox"],
  "Contracts or renewals slipping through":             ["Contracts"],
  "No way to reach customers proactively":              ["Marketing", "Pipeline"],
  "No visibility into what customers are buying":       ["Sales", "Marketing"],
  "Too many how-to or onboarding questions from users": ["AI Inbox", "Marketing"],
};

const TOOL_MODULES: Record<string, string[]> = {
  "Email only":              ["Tickets", "Pipeline"],
  "Zendesk / Freshdesk":     ["Tickets", "AI Inbox"],
  "HubSpot / CRM":           ["Pipeline", "Marketing"],
  "Intercom / Drift":        ["Live Chat", "AI Inbox"],
  "WhatsApp / Social media": ["Live Chat"],
  "None / Spreadsheets":     ["Tickets", "Pipeline"],
};

const INDUSTRY_MODULES: Record<string, string[]> = {
  "E-commerce":           ["Shipment Tracking", "Sales", "Marketing", "Tickets"],
  "Retail":               ["Shipment Tracking", "Sales", "Marketing", "Tickets"],
  "SaaS / Tech":          ["SaaS Analytics", "Live Chat"],
  "Services / Agency":    ["Calendar", "Billing", "Pipeline", "Contracts"],
  "Healthcare":           ["Calendar", "Departments"],
  "Logistics / Wholesale":["Shipment Tracking", "Departments", "Contracts"],
};

export function computeRecommendations(
  industry: string,
  currentTools: string[],
  painPoints: string[],
): string[] {
  const normalized = painPoints.map(p => PAIN_POINT_ALIASES[p] ?? p);

  const score = new Map<string, number>();
  const add = (module: string, weight: number) =>
    score.set(module, (score.get(module) ?? 0) + weight);

  // AI Inbox is Yippie's flagship — always recommended, ranked up by signals.
  add("AI Inbox", 1);

  for (const p of normalized) {
    for (const m of PAIN_POINT_MODULES[p] ?? []) add(m, PAIN_WEIGHT);
  }
  for (const t of currentTools) {
    for (const m of TOOL_MODULES[t] ?? []) add(m, TOOL_WEIGHT);
  }
  for (const m of INDUSTRY_MODULES[industry] ?? []) add(m, INDUSTRY_WEIGHT);

  return [...score.entries()]
    .sort(
      (a, b) =>
        b[1] - a[1] ||
        MODULE_ORDER.indexOf(a[0]) - MODULE_ORDER.indexOf(b[0]),
    )
    .map(([m]) => m);
}

export interface Questionnaire {
  team_size: string | null;
  industry: string | null;
  current_tools: string[] | null;
  pain_points: string[] | null;
  recommended_modules: string[] | null;
}
