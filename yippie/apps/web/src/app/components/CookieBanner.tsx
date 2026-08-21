"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import styles from "./CookieBanner.module.css";
import { getLocale, localizeHref } from "@/lib/i18n";

const STORAGE_KEY = "yippie_consent";

const copy = {
  nl: {
    label: "Cookietoestemming",
    title: "Cookies",
    text: "We gebruiken anonieme analyses om te begrijpen hoe de site wordt gebruikt en om hem te blijven verbeteren. Accepteer je cookies om ons te helpen?",
    privacyLink: "Privacybeleid",
    decline: "Weigeren",
    accept: "Accepteren",
  },
  en: {
    label: "Cookie consent",
    title: "Cookies",
    text: "We use anonymous analytics to understand how the site is used and keep improving it. Accept cookies to help us out?",
    privacyLink: "Privacy policy",
    decline: "Decline",
    accept: "Accept",
  },
} as const;

export default function CookieBanner() {
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);
  const pathname = usePathname();
  const locale = getLocale(pathname);
  const t = copy[locale];

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
      aria-label={t.label}
    >
      <p className={styles.eyebrow}>{t.title}</p>
      <p className={styles.text}>
        {t.text}{" "}
        <a href={localizeHref("/privacy", locale)}>{t.privacyLink}</a>.
      </p>
      <div className={styles.buttons}>
        <button type="button" className={styles.decline} onClick={decline}>
          {t.decline}
        </button>
        <button type="button" className={styles.accept} onClick={accept}>
          {t.accept}
        </button>
      </div>
    </div>
  );
}
