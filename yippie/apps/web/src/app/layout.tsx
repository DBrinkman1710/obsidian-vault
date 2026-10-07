import type { Metadata } from "next";
import localFont from "next/font/local";
import Script from "next/script";
import ConsentDefaults from "./components/ConsentDefaults";
import CookieBanner from "./components/CookieBanner";
import LangSync from "./components/LangSync";
import { siteJsonLd } from "./structured-data";
import "./globals.css";

const YIPPIE_TRACKING_TOKEN = process.env.NEXT_PUBLIC_YIPPIE_TRACKING_TOKEN;

const SITE_URL = process.env.NEXT_PUBLIC_WEB_URL ?? "https://getyippie.com";

// Self-hosted so the build never depends on reaching Google Fonts at build time.
// Each file is the latin variable woff2 pulled from Google Fonts (see src/app/fonts).
const inter = localFont({
  src: "./fonts/inter-latin.woff2",
  display: "swap",
  weight: "100 900",
  variable: "--font-inter",
});

const spaceGrotesk = localFont({
  src: "./fonts/space-grotesk-latin.woff2",
  display: "swap",
  weight: "300 700",
  variable: "--font-space",
});

const jetbrainsMono = localFont({
  src: "./fonts/jetbrains-mono-latin.woff2",
  display: "swap",
  weight: "100 800",
  variable: "--font-jetbrains",
});

export const metadata: Metadata = {
  title: "GetYippie | Je groeipartner in klantenservice",
  description:
    "GetYippie is het AI-gedreven klantenserviceplatform dat meegroeit met je bedrijf. Onbeperkte contacten op elk abonnement. Inbox, tickets, contacten en boekingen op één plek.",
  metadataBase: new URL(SITE_URL),
  alternates: {
    canonical: "/",
    languages: {
      nl: "/",
      en: "/en",
    },
  },
  keywords: [
    "klantenservice",
    "MKB",
    "groeipartner",
    "inboxbeheer",
    "ticketsysteem",
    "AI support",
    "helpdesk",
    "onbeperkte contacten",
  ],
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/favicon.svg", type: "image/svg+xml" },
    ],
    shortcut: "/favicon.ico",
  },
  openGraph: {
    title: "GetYippie | Je groeipartner in klantenservice",
    description:
      "Onbeperkte contacten op elk abonnement. AI-inboxtriage, tickets en boekingen in één platform dat met je meegroeit.",
    type: "website",
    url: SITE_URL,
    siteName: "GetYippie",
    images: [
      {
        url: "/og.png",
        width: 1200,
        height: 630,
        alt: "GetYippie — AI-gedreven klantenserviceplatform",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "GetYippie | Je groeipartner in klantenservice",
    description:
      "Onbeperkte contacten op elk abonnement. AI-inboxtriage, tickets en boekingen in één platform dat met je meegroeit.",
    images: ["/og.png"],
  },
};


export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="nl"
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
          dangerouslySetInnerHTML={{ __html: JSON.stringify(siteJsonLd) }}
        />
        <LangSync />
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
