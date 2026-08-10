"use client";

import { useState } from "react";
import UseCaseFlow from "./UseCaseFlow";
import { USECASE_EN, USECASE2_EN } from "./useCaseContent";
import styles from "./UseCaseStories.module.css";

const STORIES = [
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
];

/**
 * Two-button switcher that opens either use-case clickthrough. Remounts
 * UseCaseFlow (via key) when the story changes so it resets to step 1.
 */
export default function UseCaseStories() {
  const [active, setActive] = useState(0);
  return (
    <section className={styles.wrap}>
      <div className={styles.head}>
        <span className={styles.eyebrow}>See Yippie in action</span>
        <h2 className={styles.heading}>Two journeys, one platform</h2>
        <p className={styles.sub}>
          Pick a story and click through how a real installation company runs on Yippie.
        </p>
      </div>

      <div className={styles.selector}>
        {STORIES.map((s, i) => (
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

      <UseCaseFlow key={STORIES[active]!.key} content={STORIES[active]!.content} />

      <div className={styles.cta}>
        <a href="/signup" className={styles.ctaBtn}>
          Start your 30 day free trial now <span aria-hidden="true">→</span>
        </a>
        <p className={styles.ctaMeta}>30 days free · No credit card · Cancel anytime</p>
      </div>
    </section>
  );
}
