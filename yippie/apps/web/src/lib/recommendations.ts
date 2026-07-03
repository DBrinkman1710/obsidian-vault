// Shared questionnaire + module recommendation logic
// Used by /request-demo and /signup

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
  "Marketing":        { icon: "📣", desc: "Email campaigns, A/B testing, drip sequences, and open tracking" },
  "Departments":      { icon: "🏢", desc: "Route tickets and chats to the right team automatically" },
  "Billing":          { icon: "🧾", desc: "Issue invoices, track payments, and manage subscriptions" },
  "Shipment Tracking":{ icon: "📦", desc: "Live carrier updates for DHL, UPS, PostNL, and FedEx, linked to contacts." },
  "Sales":            { icon: "📈", desc: "Track product views, add-to-cart, and purchases. Identify high-intent buyers." },
  "SaaS Analytics":   { icon: "🔁", desc: "Recurring subscriptions, MRR/churn tracking, linked to contacts" },
  "Templates":        { icon: "✉️", desc: "Shared canned responses your team can pick and personalise before sending" },
};

export const TOP_MODULES = ["AI Inbox", "Tickets", "Live Chat", "Pipeline"];

const PAIN_POINT_ALIASES: Record<string, string> = {
  "Ticket volume":        "Too many support tickets",
  "Slow responses":       "Slow response times",
  "Manual sorting":       "Manual sorting & routing",
  "No reporting":         "Too many support tickets",
  "Customer follow-up":   "Losing track of customers",
};

export function computeRecommendations(
  industry: string,
  currentTools: string[],
  painPoints: string[],
): string[] {
  const normalized = painPoints.map(p => PAIN_POINT_ALIASES[p] ?? p);
  const rec = new Set(["AI Inbox"]);

  // Industry signals
  if (industry === "E-commerce" || industry === "Retail") {
    rec.add("Tickets");
    rec.add("Shipment Tracking");
    rec.add("Marketing");
    rec.add("Sales");
  }
  if (industry === "SaaS / Tech") {
    rec.add("Live Chat");
    rec.add("SaaS Analytics");
  }
  if (industry === "Services / Agency") {
    rec.add("Calendar");
    rec.add("Billing");
    rec.add("Pipeline");
  }
  if (industry === "Healthcare") {
    rec.add("Calendar");
    rec.add("Departments");
  }
  if (industry === "Logistics / Wholesale") {
    rec.add("Shipment Tracking");
    rec.add("Departments");
  }

  // Tool signals
  if (currentTools.includes("WhatsApp / Social media")) {
    rec.add("Live Chat");
  }
  if (currentTools.includes("Email only") || currentTools.includes("None / Spreadsheets")) {
    rec.add("Pipeline");
  }
  if (currentTools.includes("HubSpot / CRM")) {
    rec.add("Pipeline");
    rec.add("Marketing");
  }

  // Pain point signals
  if (normalized.includes("Missing automation") || normalized.includes("Manual sorting & routing")) {
    rec.add("AI Inbox");
  }
  if (normalized.includes("Losing track of customers")) {
    rec.add("Pipeline");
  }
  if (normalized.includes("Scattered channels (email, WhatsApp, chat)")) {
    rec.add("Live Chat");
  }
  if (normalized.includes("Shipment & order queries")) {
    rec.add("Shipment Tracking");
    rec.add("AI Inbox");
  }
  if (normalized.includes("Too many support tickets") || normalized.includes("Slow response times")) {
    rec.add("Tickets");
    rec.add("Live Chat");
    rec.add("Departments");
  }
  if (normalized.includes("No follow-up on leads or deals")) {
    rec.add("Pipeline");
    rec.add("Marketing");
  }
  if (normalized.includes("Missed appointments or no-shows")) {
    rec.add("Calendar");
  }
  if (normalized.includes("Chasing invoices or late payments") || normalized.includes("Too many billing questions from customers")) {
    rec.add("Billing");
  }
  if (normalized.includes("No way to reach customers proactively")) {
    rec.add("Marketing");
    rec.add("Pipeline");
  }
  if (normalized.includes("No visibility into what customers are buying")) {
    rec.add("Sales");
    rec.add("Marketing");
  }
  if (normalized.includes("Too many how-to or onboarding questions from users")) {
    rec.add("SaaS Analytics");
  }

  return [...rec].slice(0, 4);
}

export interface Questionnaire {
  team_size: string | null;
  industry: string | null;
  current_tools: string[] | null;
  pain_points: string[] | null;
  recommended_modules: string[] | null;
}
