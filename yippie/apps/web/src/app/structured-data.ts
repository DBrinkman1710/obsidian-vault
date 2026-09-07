// Centralized JSON-LD structured data for getyippie.com.
// Follows Google's Organization guidance:
// https://developers.google.com/search/docs/appearance/structured-data/organization
//
// Absolute URLs are required in structured data, so we anchor on the canonical
// production origin rather than the request host.
import { PLAN_LIMITS } from "@/lib/config";

const SITE = "https://getyippie.com";

const ORG_ID = `${SITE}/#organization`;
const WEBSITE_ID = `${SITE}/#website`;

const DESCRIPTION =
  "Yippie is het AI-gedreven klantenserviceplatform voor het MKB. Beheer inbox, tickets, contacten en boekingen op één plek.";

export const organizationJsonLd = {
  "@type": "Organization",
  "@id": ORG_ID,
  name: "Yippie",
  legalName: "Yippie",
  alternateName: "Yippie Customer Support",
  url: SITE,
  logo: {
    "@type": "ImageObject",
    url: `${SITE}/logo-512.png`,
    width: 512,
    height: 512,
  },
  image: `${SITE}/og.png`,
  description: DESCRIPTION,
  foundingDate: "2026",
  sameAs: ["https://www.linkedin.com/company/getyippie"],
  contactPoint: [
    {
      "@type": "ContactPoint",
      contactType: "customer support",
      email: "support@getyippie.com",
      availableLanguage: ["Dutch", "English"],
    },
  ],
  address: {
    "@type": "PostalAddress",
    addressCountry: "NL",
  },
};

export const websiteJsonLd = {
  "@type": "WebSite",
  "@id": WEBSITE_ID,
  name: "Yippie",
  url: SITE,
  description: DESCRIPTION,
  inLanguage: "en",
  publisher: { "@id": ORG_ID },
};

const planOffer = (name: string, priceMonthly: number) => ({
  "@type": "Offer",
  name,
  price: String(priceMonthly),
  priceCurrency: "EUR",
  url: `${SITE}/pricing`,
  priceSpecification: {
    "@type": "UnitPriceSpecification",
    price: String(priceMonthly),
    priceCurrency: "EUR",
    billingIncrement: 1,
    unitText: "month",
  },
});

export const softwareApplicationJsonLd = {
  "@type": "SoftwareApplication",
  name: "Yippie",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  url: SITE,
  description: DESCRIPTION,
  publisher: { "@id": ORG_ID },
  inLanguage: "en",
  // Dutch/EU SMBs are the core market; the product itself is available anywhere.
  areaServed: ["NL", "EU"],
  offers: [
    planOffer("Founder", PLAN_LIMITS.founder.priceMonthly),
    planOffer("Starter", PLAN_LIMITS.starter.priceMonthly),
    planOffer("Growth", PLAN_LIMITS.growth.priceMonthly),
    planOffer("Pro", PLAN_LIMITS.pro.priceMonthly),
  ],
};

// Combined graph so the three entities can cross-reference by @id.
export const siteJsonLd = {
  "@context": "https://schema.org",
  "@graph": [organizationJsonLd, websiteJsonLd, softwareApplicationJsonLd],
};
