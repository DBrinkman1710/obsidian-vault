// Shared questionnaire + module recommendation logic
// Used by /request-demo and /signup

export const TEAM_SIZES = ["1–5", "6–20", "21–50", "50+"];
export const INDUSTRIES = [
  "E-commerce",
  "SaaS / Tech",
  "Services",
  "Healthcare",
  "Retail",
  "Other",
];
export const TOOLS = [
  "Email only",
  "Zendesk / Freshdesk",
  "HubSpot / CRM",
  "Intercom / Drift",
  "None / Spreadsheets",
];
export const PAIN_POINTS = [
  "Ticket volume",
  "Manual sorting",
  "Slow responses",
  "No reporting",
  "Missing automation",
  "Customer follow-up",
];
export const MAX_PAIN_POINTS = 3;

export const MODULE_INFO: Record<string, { icon: string; desc: string }> = {
  "AI Inbox": { icon: "✦", desc: "AI auto-sorts and drafts replies to every inbound email" },
  Tickets: { icon: "🎫", desc: "Track every issue from first contact to resolution" },
  "Live Chat": { icon: "💬", desc: "Real-time WhatsApp & web chat with session management" },
  "Calendar & Booking": { icon: "📅", desc: "Smart booking links, availability grids, auto-confirmations" },
  "Kanban Pipeline": { icon: "📌", desc: "Visual pipeline for leads, deals, and client stages" },
  "Email Tracking": { icon: "📬", desc: "See when emails are opened, clicked, and bounced" },
  Marketing: { icon: "📣", desc: "Email campaigns, A/B testing, drip sequences, analytics" },
};

export const TOP_MODULES = ["AI Inbox", "Tickets", "Live Chat", "Kanban Pipeline"];

export function computeRecommendations(
  industry: string,
  currentTools: string[],
  painPoints: string[],
): string[] {
  const recommendations = ["AI Inbox", "Tickets"];

  if (industry === "E-commerce" || industry === "Retail") {
    recommendations.push("Email Tracking", "Marketing");
  }
  if (industry === "Services" || industry === "Healthcare") {
    recommendations.push("Calendar & Booking");
  }
  if (industry === "SaaS / Tech") {
    recommendations.push("Live Chat");
  }
  if (painPoints.includes("Missing automation") || painPoints.includes("Manual sorting")) {
    if (!recommendations.includes("AI Inbox")) recommendations.push("AI Inbox");
  }
  if (painPoints.includes("Customer follow-up")) {
    recommendations.push("Kanban Pipeline");
  }
  if (painPoints.includes("No reporting")) {
    recommendations.push("Email Tracking");
  }
  if (painPoints.includes("Ticket volume") || painPoints.includes("Slow responses")) {
    recommendations.push("Live Chat");
  }
  if (currentTools.includes("Email only") || currentTools.includes("None / Spreadsheets")) {
    recommendations.push("Kanban Pipeline");
  }

  return [...new Set(recommendations)].slice(0, 4);
}

export interface Questionnaire {
  team_size: string | null;
  industry: string | null;
  current_tools: string[] | null;
  pain_points: string[] | null;
  recommended_modules: string[] | null;
}
