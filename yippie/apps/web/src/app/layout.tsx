import type { Metadata } from "next";
import { Inter, Space_Grotesk, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { siteJsonLd } from "./structured-data";

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
        url: "/og.png",
        width: 1200,
        height: 630,
        alt: "Yippie — Customer support, made easy",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Yippie — Customer support, made easy",
    description:
      "Yippie is the AI-powered customer service platform for SMBs. Manage inbox, tickets, contacts, and bookings in one place.",
    images: ["/og.png"],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${spaceGrotesk.variable} ${jetbrainsMono.variable}`}
    >
      <body>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(siteJsonLd) }}
        />
        {children}
      </body>
    </html>
  );
}
