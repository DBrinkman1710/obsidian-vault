import type { Metadata } from "next";
import { faqs } from "./faqs";

export const metadata: Metadata = {
  title: "Prijzen — Yippie | Klantenservice Platform voor MKB",
  description:
    "Eenvoudige, transparante prijzen voor Yippie. Start gratis voor 30 dagen. Onbeperkte contacten op elk abonnement. Starter vanaf €19/mnd, Growth vanaf €39/mnd, Pro vanaf €69/mnd.",
  alternates: { canonical: "/pricing" },
  openGraph: {
    title: "Yippie Prijzen — Start gratis, schaal naarmate je groeit",
    description:
      "Onbeperkte contacten op elk abonnement. Gratis proefperiode van 30 dagen, geen creditcard vereist. Starter vanaf €19/mnd.",
    url: "https://getyippie.com/pricing",
    images: ["/og.png"],
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
