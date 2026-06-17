"use client";

import { useEffect, useState } from "react";
import styles from "./CookieBanner.module.css";

const STORAGE_KEY = "yippie_consent";

export default function CookieBanner() {
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
    localStorage.setItem(STORAGE_KEY, "declined");
    setVisible(false);
  }

  if (!mounted || !visible) return null;

  return (
    <div
      className={styles.banner}
      role="dialog"
      aria-live="polite"
      aria-label="Cookie toestemming"
    >
      <p className={styles.eyebrow}>Cookies</p>
      <p className={styles.text}>
        Bij Yippie houden we van transparantie. We gebruiken anonieme statistieken
        om de website te verbeteren. Ga je akkoord?{" "}
        <a href="/privacy">Privacybeleid</a>.
      </p>
      <div className={styles.buttons}>
        <button type="button" className={styles.decline} onClick={decline}>
          Weigeren
        </button>
        <button type="button" className={styles.accept} onClick={accept}>
          Akkoord
        </button>
      </div>
    </div>
  );
}
