"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./HourCounter.module.css";

const FALLBACK_HOURS = 10000;
const DURATION_MS = 2000;
// The count-up starts at this fraction of the target, so the number is never
// blank and the animation always travels a meaningful distance.
const START_FRACTION = 0.6;

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

function formatHours(value: number): string {
  // Narrow no-break spaces as thousand separators — "14 230", editorial style.
  return value.toLocaleString("en-US").replace(/,/g, " ");
}

type PublicStats = {
  hours_saved?: number;
  tickets_automated?: number;
};

export default function HourCounter({ statsUrl }: { statsUrl: string }) {
  const [display, setDisplay] = useState(Math.floor(FALLBACK_HOURS * START_FRACTION));
  const rafRef = useRef<number>();

  useEffect(() => {
    let cancelled = false;

    const animateTo = (target: number) => {
      const start = Math.floor(target * START_FRACTION);
      const t0 = performance.now();
      const tick = (now: number) => {
        if (cancelled) return;
        const progress = Math.min((now - t0) / DURATION_MS, 1);
        setDisplay(Math.round(start + (target - start) * easeOutCubic(progress)));
        if (progress < 1) {
          rafRef.current = requestAnimationFrame(tick);
        }
      };
      rafRef.current = requestAnimationFrame(tick);
    };

    fetch(`${statsUrl}/api/v1/public/stats`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json() as Promise<PublicStats>;
      })
      .then((data) => {
        if (cancelled) return;
        const hours =
          typeof data.hours_saved === "number" && data.hours_saved > 0
            ? data.hours_saved
            : FALLBACK_HOURS;
        animateTo(hours);
      })
      .catch(() => {
        if (!cancelled) animateTo(FALLBACK_HOURS);
      });

    return () => {
      cancelled = true;
      if (rafRef.current !== undefined) cancelAnimationFrame(rafRef.current);
    };
  }, [statsUrl]);

  return (
    <section className={styles.section} aria-label="Hours saved by Yippie">
      <div className={styles.numberRow}>
        <span className={styles.number}>{formatHours(display)}</span>
        <span className={styles.counting}>and counting</span>
      </div>
      <p className={styles.label}>
        hours of customer service
        <br />
        automated by Yippie
      </p>
      <p className={styles.note}>
        Updated live · based on tickets processed across all Yippie businesses.
      </p>
    </section>
  );
}
