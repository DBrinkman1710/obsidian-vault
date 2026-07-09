import type { Metadata } from "next";
import { faqs } from "./faqs";

export const metadata: Metadata = {
  title: "Pricing — Yippie | Customer Service Platform for SMBs",
  description:
    "Simple, transparent pricing for Yippie. Start free for 30 days. Unlimited contacts on every plan. Starter from €19/mo, Growth from €39/mo, Pro from €69/mo.",
  alternates: { canonical: "/pricing" },
  openGraph: {
    title: "Yippie Pricing — Start free, scale as you grow",
    description:
      "Unlimited contacts on every plan. 30 day free trial, no credit card required. Starter from €19/mo.",
  },
};

/* FAQPage structured data — sourced from the same faqs array the page renders,
   so the markup can never drift from the visible content. */
const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: faqs.map((f) => ({
    "@type": "Question",
    name: f.q,
    acceptedAnswer: { "@type": "Answer", text: f.a },
  })),
};

export default function PricingLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />
      {children}
    </>
  );
}
