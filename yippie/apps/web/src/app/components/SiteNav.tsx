"use client";

import { useEffect, useState } from "react";
import styles from "./SiteChrome.module.css";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.getyippie.com";
const DEMO_URL = process.env.NEXT_PUBLIC_DEMO_URL ?? "/request-demo";

const links = [
  { href: "/modules", label: "Product" },
  { href: "/pricing", label: "Pricing" },
  { href: "/about", label: "About" },
  { href: "/blog", label: "Blog" },
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

  // Lock body scroll while the mobile sheet is open.
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <nav className={`${styles.nav} ${scrolled ? styles.navScrolled : ""}`}>
      <a href="/" className={styles.brand} aria-label="Yippie home">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo-white-bg.svg" alt="Yippie" className={styles.navLogo} />
      </a>

      <ul className={styles.navLinks}>
        {links.map((l) => (
          <li key={l.href}>
            <a href={l.href}>{l.label}</a>
          </li>
        ))}
      </ul>

      <div className={styles.navRight}>
        <a href={APP_URL} className={styles.navLogin}>Log in</a>
        <a href={DEMO_URL} className={styles.navCta}>
          Request demo
          <span aria-hidden="true">→</span>
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

      {open && (
        <div className={styles.mobileSheet}>
          <ul className={styles.mobileLinks}>
            {links.map((l) => (
              <li key={l.href}>
                <a href={l.href} onClick={() => setOpen(false)}>{l.label}</a>
              </li>
            ))}
          </ul>
          <div className={styles.mobileActions}>
            <a href={APP_URL} className={styles.mobileLogin} onClick={() => setOpen(false)}>
              Log in
            </a>
            <a href={DEMO_URL} className={styles.navCta} onClick={() => setOpen(false)}>
              Request demo →
            </a>
          </div>
        </div>
      )}
    </nav>
  );
}
