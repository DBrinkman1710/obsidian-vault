import type { Metadata } from "next";
import "./globals.css";

const SITE_URL = process.env.NEXT_PUBLIC_WEB_URL ?? "https://getyippie.com";

export const metadata: Metadata = {
  title: "Yippie — Customer support, made easy",
  description:
    "Yippie is the AI-powered customer service platform for SMBs. Manage inbox, tickets, contacts, and bookings in one place.",
  metadataBase: new URL(SITE_URL),
  keywords: [
    "customer service",
    "SMB",
    "inbox management",
    "ticket system",
    "AI support",
    "helpdesk",
  ],
  openGraph: {
    title: "Yippie — Customer support, made easy",
    description:
      "Yippie is the AI-powered customer service platform for SMBs. Manage inbox, tickets, contacts, and bookings in one place.",
    type: "website",
    url: SITE_URL,
    siteName: "Yippie",
    images: [
      {
        url: "/logo.svg",
        alt: "Yippie",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Yippie — Customer support, made easy",
    description:
      "Yippie is the AI-powered customer service platform for SMBs. Manage inbox, tickets, contacts, and bookings in one place.",
    images: ["/logo.svg"],
  },
};

const organizationJsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "Yippie",
  url: "https://getyippie.com",
  logo: "https://getyippie.com/logo.svg",
  description:
    "Yippie is the AI-powered customer service platform for SMBs. Manage inbox, tickets, contacts, and bookings in one place.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
        />
        {children}
      </body>
    </html>
  );
}
