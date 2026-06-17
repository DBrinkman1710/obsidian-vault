"use client";

import { useState, useEffect } from "react";
import styles from "./CookieBanner.module.css";

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}

export default function CookieBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      if (!localStorage.getItem("yippie_consent")) setVisible(true);
    } catch {
      // localStorage blocked (private mode) — don't show banner
    }
  }, []);

  function accept() {
    window.gtag?.("consent", "update", {
      analytics_storage: "granted",
      ad_storage: "granted",
      ad_user_data: "granted",
      ad_personalization: "granted",
    });
    try { localStorage.setItem("yippie_consent", "accepted"); } catch { /* */ }
    setVisible(false);
  }

  function decline() {
    try { localStorage.setItem("yippie_consent", "declined"); } catch { /* */ }
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div className={styles.banner} role="dialog" aria-label="Cookie consent">
      <p className={styles.text}>
        Bij Yippie houden we van transparantie. We gebruiken anonieme statistieken om de website te verbeteren.{" "}
        <a href="/privacy" className={styles.link}>Privacybeleid</a>.
      </p>
      <div className={styles.actions}>
        <button onClick={decline} className={styles.btnDecline}>Weigeren</button>
        <button onClick={accept} className={styles.btnAccept}>Akkoord</button>
      </div>
    </div>
  );
}
