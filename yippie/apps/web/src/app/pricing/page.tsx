import type { Metadata } from "next";
import PricingClient from "./PricingClient";

export const metadata: Metadata = {
  title: "Pricing — Yippie customer service platform for SMBs",
  description:
    "Simple, honest pricing for Yippie. Plans from €9/mo with Inbox and Contacts included. Add tickets, AI, calendar, Kanban, and email tracking à la carte — or go Pro for everything.",
  alternates: { canonical: "/pricing" },
  openGraph: {
    title: "Pricing — Yippie customer service platform for SMBs",
    description:
      "Plans from €9/mo. Inbox and Contacts in every plan; add the modules you need à la carte or go Pro for everything in one flat price.",
    url: "https://getyippie.com/pricing",
    type: "website",
  },
};

export default function PricingPage() {
  return <PricingClient />;
}
