"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import type { UseCaseContent } from "./useCaseContent";
import styles from "./UseCaseFlow.module.css";

/**
 * Interactive clickthrough of the installer workflow, driven by real Yippie
 * screenshots (in /public/usecase). Copy is passed in so the same component
 * serves EN (on /) and NL (on /nl).
 */
export default function UseCaseFlow({ content }: { content: UseCaseContent }) {
  const [active, setActive] = useState(0);
  const last = content.steps.length - 1;
  const step = content.steps[active] ?? content.steps[0]!;

  const go = useCallback(
    (i: number) => setActive((prev) => Math.min(last, Math.max(0, i ?? prev))),
    [last],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") setActive((p) => Math.min(last, p + 1));
      if (e.key === "ArrowLeft") setActive((p) => Math.max(0, p - 1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [last]);

  return (
    <section className={styles.section} aria-roledescription="carousel">
      <div className={styles.head}>
        <span className={styles.eyebrow}>{content.eyebrow}</span>
        <h2 className={styles.heading}>{content.heading}</h2>
        <p className={styles.sub}>{content.sub}</p>
      </div>

      {/* Step tabs */}
      <ol className={styles.tabs}>
        {content.steps.map((s, i) => {
          const state = i === active ? "active" : i < active ? "done" : "todo";
          return (
            <li key={s.tag} className={styles.tabItem}>
              <button
                type="button"
                className={styles.tab}
                data-state={state}
                onClick={() => go(i)}
                aria-current={i === active ? "step" : undefined}
              >
                <span className={styles.tabNum}>{i + 1}</span>
                <span className={styles.tabLabel}>{s.tag}</span>
              </button>
            </li>
          );
        })}
      </ol>

      <div className={styles.stage}>
        {/* Screenshot in a browser frame */}
        <div className={styles.frame}>
          <div className={styles.frameBar}>
            <span className={styles.dot} />
            <span className={styles.dot} />
            <span className={styles.dot} />
            <span className={styles.frameUrl}>
              {step.url ?? "app.getyippie.com"}
            </span>
            <span key={step.callout} className={styles.callout}>
              {step.callout}
            </span>
          </div>
          <div className={styles.shotWrap}>
            <Image
              key={step.img}
              src={step.img}
              alt={step.title}
              width={step.w}
              height={step.h}
              className={styles.shot}
              priority={active === 0}
            />
            {step.email && (
              <div
                key={step.email.subject}
                className={styles.emailCard}
                data-dir={step.email.direction}
              >
                <span className={styles.emailTag}>
                  {step.email.direction === "out"
                    ? content.sentLabel
                    : content.replyLabel}
                </span>
                <span className={styles.emailFrom}>{step.email.from}</span>
                <span className={styles.emailSubject}>{step.email.subject}</span>
                <span className={styles.emailBody}>{step.email.body}</span>
              </div>
            )}
          </div>
        </div>

        {/* Caption + controls */}
        <div className={styles.caption}>
          <span className={styles.stepOf}>
            {active + 1} / {content.steps.length}
          </span>
          <h3 key={step.title} className={styles.capTitle}>
            {step.title}
          </h3>
          <p key={step.desc} className={styles.capDesc}>
            {step.desc}
          </p>
          <div className={styles.controls}>
            <button
              type="button"
              className={styles.ctrl}
              onClick={() => go(active - 1)}
              disabled={active === 0}
            >
              ← {content.prev}
            </button>
            <div className={styles.progress} role="tablist" aria-label="steps">
              {content.steps.map((s, i) => (
                <button
                  key={s.tag}
                  type="button"
                  className={styles.pip}
                  data-on={i === active}
                  aria-label={s.tag}
                  onClick={() => go(i)}
                />
              ))}
            </div>
            <button
              type="button"
              className={`${styles.ctrl} ${styles.ctrlPrimary}`}
              onClick={() => go(active + 1)}
              disabled={active === last}
            >
              {content.next} →
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
