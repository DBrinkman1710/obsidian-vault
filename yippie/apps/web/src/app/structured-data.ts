// Centralized JSON-LD structured data for getyippie.com.
// Follows Google's Organization guidance:
// https://developers.google.com/search/docs/appearance/structured-data/organization
//
// Absolute URLs are required in structured data, so we anchor on the canonical
// production origin rather than the request host.
const SITE = "https://getyippie.com";

const ORG_ID = `${SITE}/#organization`;
const WEBSITE_ID = `${SITE}/#website`;

const DESCRIPTION =
  "Yippie is the AI-powered customer service platform for SMBs. Manage inbox, tickets, contacts, and bookings in one place.";

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
      availableLanguage: ["English", "Dutch"],
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

// Mirrors the live pricing tiers in src/app/pricing/PricingClient.tsx.
// Keep these in sync if pricing changes.
export const softwareApplicationJsonLd = {
  "@type": "SoftwareApplication",
  name: "Yippie",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  url: SITE,
  description: DESCRIPTION,
  publisher: { "@id": ORG_ID },
  offers: [
    { "@type": "Offer", name: "Founder", price: "9", priceCurrency: "EUR" },
    { "@type": "Offer", name: "Starter", price: "29", priceCurrency: "EUR" },
    { "@type": "Offer", name: "Growth", price: "69", priceCurrency: "EUR" },
    { "@type": "Offer", name: "Pro", price: "99", priceCurrency: "EUR" },
  ],
};

// Combined graph so the three entities can cross-reference by @id.
export const siteJsonLd = {
  "@context": "https://schema.org",
  "@graph": [organizationJsonLd, websiteJsonLd, softwareApplicationJsonLd],
};
