"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import styles from "./SiteChrome.module.css";
import { getLocale, localizeHref, switchLocaleHref } from "@/lib/i18n";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.getyippie.com";
const DEMO_URL = process.env.NEXT_PUBLIC_DEMO_URL ?? "/request-demo";

const copy = {
  nl: {
    links: [
      { href: "/", label: "Home" },
      { href: "/modules", label: "Modules" },
      { href: "/pricing", label: "Prijzen" },
      { href: "/about", label: "Over ons" },
    ],
    useCaseLinks: [
      { href: "/for-smbs", label: "Voor MKB" },
      { href: "/for-agencies", label: "Voor bureaus" },
      { href: "/vs-zendesk", label: "Yippie vs Zendesk" },
    ],
    useCases: "Toepassingen",
    login: "Inloggen",
    demo: "Demo aanvragen",
    trial: "Start gratis proefperiode",
    openMenu: "Menu openen",
    closeMenu: "Menu sluiten",
  },
  en: {
    links: [
      { href: "/", label: "Home" },
      { href: "/modules", label: "Modules" },
      { href: "/pricing", label: "Pricing" },
      { href: "/about", label: "About" },
    ],
    useCaseLinks: [
      { href: "/for-smbs", label: "For SMBs" },
      { href: "/for-agencies", label: "For agencies" },
      { href: "/vs-zendesk", label: "Yippie vs Zendesk" },
    ],
    useCases: "Use cases",
    login: "Log in",
    demo: "Request demo",
    trial: "Start free trial",
    openMenu: "Open menu",
    closeMenu: "Close menu",
  },
} as const;

export default function SiteNav() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const pathname = usePathname();
  const locale = getLocale(pathname);
  const isNL = locale === "nl";

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  const t = copy[locale];

  return (
    <nav className={`${styles.nav} ${scrolled ? styles.navScrolled : ""}`}>
      <div className={styles.navInner}>
        <a href={localizeHref("/", locale)} className={styles.brand} aria-label="Yippie home">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-white-bg-mark.svg" alt="Yippie" className={styles.navLogo} />
        </a>

        <ul className={styles.navLinks}>
          {t.links.map((l) => (
            <li key={l.href}>
              <a href={localizeHref(l.href, locale)}>{l.label}</a>
            </li>
          ))}
          <li className={styles.navDropdown}>
            <button type="button" className={styles.navDropdownTrigger} tabIndex={0}>
              {t.useCases} <span className={styles.navDropdownCaret} aria-hidden="true">▾</span>
            </button>
            <ul className={styles.navDropdownMenu}>
              {t.useCaseLinks.map((l) => (
                <li key={l.href}>
                  <a href={localizeHref(l.href, locale)}>{l.label}</a>
                </li>
              ))}
            </ul>
          </li>
        </ul>

        <div className={styles.navRight}>
          <div className={styles.navDropdown}>
            <button type="button" className={`${styles.navDropdownTrigger} ${styles.langTrigger}`} tabIndex={0}>
              {isNL ? "NL" : "EN"} <span className={styles.navDropdownCaret} aria-hidden="true">▾</span>
            </button>
            <ul className={`${styles.navDropdownMenu} ${styles.langMenu}`}>
              <li><a href={switchLocaleHref(pathname, "en")} className={!isNL ? styles.langActive : ""}>EN — English</a></li>
              <li><a href={switchLocaleHref(pathname, "nl")} className={isNL ? styles.langActive : ""}>NL — Nederlands</a></li>
            </ul>
          </div>
          <a href={`${APP_URL}/login`} className={styles.navLogin}>{t.login}</a>
          <a href={DEMO_URL} className={styles.navLoginOutline}>{t.demo}</a>
          <a href={localizeHref("/signup", locale)} className={styles.navCta}>
            {t.trial} <span aria-hidden="true">→</span>
          </a>
        </div>

        <button
          type="button"
          className={styles.burger}
          aria-label={open ? t.closeMenu : t.openMenu}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          <span className={`${styles.burgerBar} ${open ? styles.burgerBarTop : ""}`} />
          <span className={`${styles.burgerBar} ${open ? styles.burgerBarMid : ""}`} />
          <span className={`${styles.burgerBar} ${open ? styles.burgerBarBot : ""}`} />
        </button>
      </div>

      {open && (
        <div className={styles.mobileSheet}>
          <ul className={styles.mobileLinks}>
            {t.links.map((l) => (
              <li key={l.href}>
                <a href={localizeHref(l.href, locale)} onClick={() => setOpen(false)}>{l.label}</a>
              </li>
            ))}
            {t.useCaseLinks.map((l) => (
              <li key={l.href}>
                <a href={localizeHref(l.href, locale)} onClick={() => setOpen(false)}>{l.label}</a>
              </li>
            ))}
          </ul>
          <div className={styles.mobileActions}>
            <a href={`${APP_URL}/login`} className={styles.mobileLogin} onClick={() => setOpen(false)}>
              {t.login}
            </a>
            <a href={DEMO_URL} className={styles.mobileLogin} onClick={() => setOpen(false)}>
              {t.demo}
            </a>
            <a href={localizeHref("/signup", locale)} className={styles.navCta} onClick={() => setOpen(false)}>
              {t.trial} →
            </a>
          </div>
        </div>
      )}
    </nav>
  );
}
