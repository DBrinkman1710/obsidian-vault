import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Pricing — Yippie | Customer Service Platform for SMBs",
  description:
    "Simple, transparent pricing for Yippie. Start free for 30 days. Unlimited contacts on every plan. Starter from €9/mo, Growth from €19/mo, Pro from €49/mo.",
  alternates: { canonical: "/pricing" },
  openGraph: {
    title: "Yippie Pricing — Start free, scale as you grow",
    description:
      "Unlimited contacts on every plan. 30-day free trial, no credit card required. Starter from €9/mo.",
  },
};

export default function PricingLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
