"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import UseCaseFlow from "./UseCaseFlow";
import { USECASE_EN, USECASE2_EN, USECASE_NL, USECASE2_NL } from "./useCaseContent";
import { getLocale, localizeHref } from "@/lib/i18n";
import styles from "./UseCaseStories.module.css";

const copy = {
  nl: {
    eyebrow: "Zie Yippie in actie",
    heading: "Twee trajecten, één platform",
    sub: "Kies een verhaal en klik door hoe een echt installatiebedrijf op Yippie draait.",
    stories: [
      {
        key: "new-customer",
        tag: "Toepassing",
        label: "Nieuwe klant",
        blurb: "Van eerste klik tot trouwe klant",
        content: USECASE_NL,
      },
      {
        key: "aftercare",
        tag: "Toepassing",
        label: "Nazorg",
        blurb: "Eén probleem, nul gemiste kansen",
        content: USECASE2_NL,
      },
    ],
    cta: "Start je gratis proefperiode van 30 dagen",
    meta: "30 dagen gratis · Geen creditcard · Altijd opzegbaar",
  },
  en: {
    eyebrow: "See Yippie in action",
    heading: "Two journeys, one platform",
    sub: "Pick a story and click through how a real installation company runs on Yippie.",
    stories: [
      {
        key: "new-customer",
        tag: "Use case",
        label: "New customer",
        blurb: "From first click to loyal customer",
        content: USECASE_EN,
      },
      {
        key: "aftercare",
        tag: "Use case",
        label: "Customer aftercare",
        blurb: "One problem, zero dropped balls",
        content: USECASE2_EN,
      },
    ],
    cta: "Start your 30 day free trial now",
    meta: "30 days free · No credit card · Cancel anytime",
  },
} as const;

/**
 * Two-button switcher that opens either use-case clickthrough. Remounts
 * UseCaseFlow (via key) when the story changes so it resets to step 1.
 */
export default function UseCaseStories() {
  const [active, setActive] = useState(0);
  const pathname = usePathname();
  const locale = getLocale(pathname);
  const t = copy[locale];
  const stories = t.stories;

  return (
    <section className={styles.wrap}>
      <div className={styles.head}>
        <span className={styles.eyebrow}>{t.eyebrow}</span>
        <h2 className={styles.heading}>{t.heading}</h2>
        <p className={styles.sub}>{t.sub}</p>
      </div>

      <div className={styles.selector}>
        {stories.map((s, i) => (
          <button
            key={s.key}
            type="button"
            className={styles.storyBtn}
            data-on={i === active}
            onClick={() => setActive(i)}
          >
            <span className={styles.k}>{s.tag}</span>
            <span className={styles.t}>{s.label}</span>
            <span className={styles.d}>{s.blurb}</span>
          </button>
        ))}
      </div>

      <UseCaseFlow key={stories[active]!.key} content={stories[active]!.content} />

      <div className={styles.cta}>
        <a href={localizeHref("/signup", locale)} className={styles.ctaBtn}>
          {t.cta} <span aria-hidden="true">→</span>
        </a>
        <p className={styles.ctaMeta}>{t.meta}</p>
      </div>
    </section>
  );
}
