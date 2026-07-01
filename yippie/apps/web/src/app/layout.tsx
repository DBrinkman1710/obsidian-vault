import type { Metadata } from "next";
import { Inter, Space_Grotesk, JetBrains_Mono } from "next/font/google";
import Script from "next/script";
import ConsentDefaults from "./components/ConsentDefaults";
import CookieBanner from "./components/CookieBanner";
import "./globals.css";

const YIPPIE_TRACKING_TOKEN = process.env.NEXT_PUBLIC_YIPPIE_TRACKING_TOKEN;

const SITE_URL = process.env.NEXT_PUBLIC_WEB_URL ?? "https://getyippie.com";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  display: "swap",
  weight: ["500", "600", "700"],
  variable: "--font-space",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  display: "swap",
  weight: ["500", "600"],
  variable: "--font-jetbrains",
});

export const metadata: Metadata = {
  title: "Yippie — Your growth partner in customer service",
  description:
    "Yippie is the AI-powered customer service platform that grows with your business. Unlimited contacts on every plan. Inbox, tickets, contacts, and bookings in one place.",
  metadataBase: new URL(SITE_URL),
  keywords: [
    "customer service",
    "SMB",
    "growth partner",
    "inbox management",
    "ticket system",
    "AI support",
    "helpdesk",
    "unlimited contacts",
  ],
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/favicon.svg", type: "image/svg+xml" },
    ],
    shortcut: "/favicon.ico",
  },
  openGraph: {
    title: "Yippie — Your growth partner in customer service",
    description:
      "Unlimited contacts on every plan. AI inbox triage, tickets, and bookings — one platform that scales with you.",
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
    title: "Yippie — Your growth partner in customer service",
    description:
      "Unlimited contacts on every plan. AI inbox triage, tickets, and bookings — one platform that scales with you.",
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
    <html
      lang="en"
      className={`${inter.variable} ${spaceGrotesk.variable} ${jetbrainsMono.variable}`}
    >
      <head>
        <ConsentDefaults />
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','GTM-NM64HCN9');`,
          }}
        />
      </head>
      <body>
        <noscript>
          <iframe
            src="https://www.googletagmanager.com/ns.html?id=GTM-NM64HCN9"
            height="0"
            width="0"
            style={{ display: "none", visibility: "hidden" }}
          />
        </noscript>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
        />
        {children}
        <CookieBanner />
        {YIPPIE_TRACKING_TOKEN && (
          <Script
            id="yippie-sales"
            src="https://getyippie.com/sales.js"
            data-token={YIPPIE_TRACKING_TOKEN}
            strategy="afterInteractive"
          />
        )}
      </body>
    </html>
  );
}
