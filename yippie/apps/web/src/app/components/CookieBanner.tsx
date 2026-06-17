"use client";

import { useEffect, useState } from "react";
import styles from "./CookieBanner.module.css";

const STORAGE_KEY = "yippie_consent";

export default function CookieBanner() {
  // Render nothing until mounted — localStorage is client-only, so this keeps
  // SSR output and the first client render in sync (no hydration mismatch).
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (!localStorage.getItem(STORAGE_KEY)) setVisible(true);
  }, []);

  function accept() {
    window.gtag?.("consent", "update", {
      ad_storage: "granted",
      ad_user_data: "granted",
      ad_personalization: "granted",
      analytics_storage: "granted",
    });
    localStorage.setItem(STORAGE_KEY, "accepted");
    setVisible(false);
  }

  function decline() {
    // No consent update — Google Analytics stays in cookieless denied mode.
    localStorage.setItem(STORAGE_KEY, "declined");
    setVisible(false);
  }

  if (!mounted || !visible) return null;

  return (
    <div
      className={styles.banner}
      role="dialog"
      aria-live="polite"
      aria-label="Cookie consent"
    >
      <p className={styles.eyebrow}>Cookies</p>
      <p className={styles.text}>
        We use anonymous analytics to understand how the site is used and keep
        improving it. Accept cookies to help us out? Read our{" "}
        <a href="/privacy">privacy policy</a>.
      </p>
      <div className={styles.buttons}>
        <button type="button" className={styles.decline} onClick={decline}>
          Decline
        </button>
        <button type="button" className={styles.accept} onClick={accept}>
          Accept
        </button>
      </div>
    </div>
  );
}
