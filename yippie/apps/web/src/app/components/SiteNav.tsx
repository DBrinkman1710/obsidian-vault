"use client";

import { useEffect, useState } from "react";
import styles from "./SiteChrome.module.css";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.getyippie.com";
const DEMO_URL = process.env.NEXT_PUBLIC_DEMO_URL ?? "/request-demo";

const links = [
  { href: "/", label: "Home" },
  { href: "/modules", label: "Modules" },
  { href: "/pricing", label: "Pricing" },
  { href: "/about", label: "About" },
];

const useCaseLinks = [
  { href: "/for-smbs", label: "For SMBs" },
  { href: "/for-agencies", label: "For agencies" },
  { href: "/vs-zendesk", label: "Yippie vs Zendesk" },
];

export default function SiteNav() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

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

  return (
    <nav className={`${styles.nav} ${scrolled ? styles.navScrolled : ""}`}>
      <div className={styles.navInner}>
        <a href="/" className={styles.brand} aria-label="Yippie home">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-white-bg-mark.svg" alt="Yippie" className={styles.navLogo} />
        </a>

        <ul className={styles.navLinks}>
          {links.map((l) => (
            <li key={l.href}>
              <a href={l.href}>{l.label}</a>
            </li>
          ))}
          <li className={styles.navDropdown}>
            <button type="button" className={styles.navDropdownTrigger} tabIndex={0}>
              Use cases <span className={styles.navDropdownCaret} aria-hidden="true">▾</span>
            </button>
            <ul className={styles.navDropdownMenu}>
              {useCaseLinks.map((l) => (
                <li key={l.href}>
                  <a href={l.href}>{l.label}</a>
                </li>
              ))}
            </ul>
          </li>
        </ul>

        <div className={styles.navRight}>
          <a href={`${APP_URL}/login`} className={styles.navLogin}>Log in</a>
          <a href={DEMO_URL} className={styles.navLoginOutline}>Request demo</a>
          <a href="/custom" className={styles.navCta}>
            Build your plan <span aria-hidden="true">→</span>
          </a>
        </div>

        <button
          type="button"
          className={styles.burger}
          aria-label={open ? "Close menu" : "Open menu"}
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
            {links.map((l) => (
              <li key={l.href}>
                <a href={l.href} onClick={() => setOpen(false)}>{l.label}</a>
              </li>
            ))}
            {useCaseLinks.map((l) => (
              <li key={l.href}>
                <a href={l.href} onClick={() => setOpen(false)}>{l.label}</a>
              </li>
            ))}
          </ul>
          <div className={styles.mobileActions}>
            <a href={`${APP_URL}/login`} className={styles.mobileLogin} onClick={() => setOpen(false)}>
              Log in
            </a>
            <a href={DEMO_URL} className={styles.mobileLogin} onClick={() => setOpen(false)}>
              Request demo
            </a>
            <a href="/custom" className={styles.navCta} onClick={() => setOpen(false)}>
              Build your plan →
            </a>
          </div>
        </div>
      )}
    </nav>
  );
}
