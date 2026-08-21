"use client";

import { usePathname } from "next/navigation";
import styles from "./SiteChrome.module.css";
import { getLocale, localizeHref } from "@/lib/i18n";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.getyippie.com";
const DEMO_URL = process.env.NEXT_PUBLIC_DEMO_URL ?? "/request-demo";

const copy = {
  nl: {
    tagline: "Je groeipartner in klantenservice. Gebouwd om met je mee te groeien.",
    allRights: "Alle rechten voorbehouden.",
    madeFor: "Gebouwd voor ondernemers die het menen.",
    columns: [
      {
        title: "Product",
        links: [
          { href: "/modules", label: "Modules", external: false },
          { href: "/pricing", label: "Prijzen", external: false },
          { href: "/docs", label: "Documentatie", external: false },
          { href: DEMO_URL, label: "Demo aanvragen", external: false },
        ],
      },
      {
        title: "Toepassingen",
        links: [
          { href: "/for-smbs", label: "Voor MKB", external: false },
          { href: "/for-agencies", label: "Voor bureaus", external: false },
          { href: "/vs-zendesk", label: "Yippie vs Zendesk", external: false },
          { href: "/vs-front", label: "Yippie vs Front", external: false },
          { href: "/vs-freshdesk", label: "Yippie vs Freshdesk", external: false },
        ],
      },
      {
        title: "Bedrijf",
        links: [
          { href: "/about", label: "Over ons", external: false },
          { href: "/blog", label: "Blog", external: false },
          { href: "/privacy", label: "Privacy", external: false },
          { href: "/terms", label: "Voorwaarden", external: false },
          { href: APP_URL, label: "Inloggen", external: true },
        ],
      },
    ],
  },
  en: {
    tagline: "Your growth partner in customer service. Built to scale with you.",
    allRights: "All rights reserved.",
    madeFor: "Built for founders who mean business.",
    columns: [
      {
        title: "Product",
        links: [
          { href: "/modules", label: "Modules", external: false },
          { href: "/pricing", label: "Pricing", external: false },
          { href: "/docs", label: "Documentation", external: false },
          { href: DEMO_URL, label: "Request demo", external: false },
        ],
      },
      {
        title: "Use cases",
        links: [
          { href: "/for-smbs", label: "For SMBs", external: false },
          { href: "/for-agencies", label: "For agencies", external: false },
          { href: "/vs-zendesk", label: "Yippie vs Zendesk", external: false },
          { href: "/vs-front", label: "Yippie vs Front", external: false },
          { href: "/vs-freshdesk", label: "Yippie vs Freshdesk", external: false },
        ],
      },
      {
        title: "Company",
        links: [
          { href: "/about", label: "About", external: false },
          { href: "/blog", label: "Blog", external: false },
          { href: "/privacy", label: "Privacy", external: false },
          { href: "/terms", label: "Terms", external: false },
          { href: APP_URL, label: "Log in", external: true },
        ],
      },
    ],
  },
} as const;

export default function SiteFooter() {
  const pathname = usePathname();
  const locale = getLocale(pathname);
  const t = copy[locale];

  return (
    <footer className={styles.footer}>
      <div className={styles.footerInner}>
        <div className={styles.footerBrand}>
          <a href={localizeHref("/", locale)} aria-label="Yippie home">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo-black-bg.svg" alt="Yippie" className={styles.footerLogo} />
          </a>
          <p className={styles.footerTagline}>{t.tagline}</p>
        </div>

        <div className={styles.footerCols}>
          {t.columns.map((col) => (
            <div key={col.title} className={styles.footerCol}>
              <p className={styles.footerColTitle}>{col.title}</p>
              <ul>
                {col.links.map((l) => (
                  <li key={l.label}>
                    <a
                      href={l.external ? l.href : localizeHref(l.href, locale)}
                      className={styles.footerLink}
                    >
                      {l.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      <div className={styles.footerBar}>
        <span className={styles.footerCopy}>© {new Date().getFullYear()} GetYippie — KVK 42124040 · BTW NL005516514B24. {t.allRights}</span>
        <span className={styles.footerMade}>{t.madeFor}</span>
      </div>
    </footer>
  );
}
