"use client";

import { useState } from "react";
import type { CSSProperties } from "react";
import styles from "./ROICalculator.module.css";

const PLAN_PRICE = 29; // cheapest Yippie plan, €/mo
const HOURS_PER_FTE_MONTH = 160;

type InputKey = "tickets" | "minutes" | "staff" | "rate" | "automatable";

type SliderConfig = {
  key: InputKey;
  label: string;
  min: number;
  max: number;
  step: number;
  format: (v: number) => string;
};

const sliders: SliderConfig[] = [
  {
    key: "tickets",
    label: "Tickets per month",
    min: 10,
    max: 2000,
    step: 10,
    format: (v) => v.toLocaleString("en-US"),
  },
  {
    key: "minutes",
    label: "Avg minutes per ticket",
    min: 1,
    max: 60,
    step: 1,
    format: (v) => `${v} min`,
  },
  {
    key: "staff",
    label: "Support staff",
    min: 1,
    max: 20,
    step: 1,
    format: (v) => `${v}`,
  },
  {
    key: "rate",
    label: "Hourly staff cost",
    min: 10,
    max: 100,
    step: 1,
    format: (v) => `€${v}`,
  },
  {
    key: "automatable",
    label: "% automatable by Yippie",
    min: 10,
    max: 90,
    step: 5,
    format: (v) => `${v}%`,
  },
];

type Values = Record<InputKey, number>;

const defaults: Values = {
  tickets: 200,
  minutes: 15,
  staff: 2,
  rate: 35,
  automatable: 60,
};

function formatPayback(savedPerMonth: number): { value: string; sub: string } {
  if (savedPerMonth <= 0) {
    return { value: "—", sub: "no savings yet" };
  }
  const days = (PLAN_PRICE / savedPerMonth) * 30;
  if (days <= 1) {
    return { value: "Instant ROI", sub: `€${PLAN_PRICE} plan earned back on day one` };
  }
  if (days < 30) {
    return { value: `${Math.ceil(days)} days`, sub: `to earn back the €${PLAN_PRICE}/mo plan` };
  }
  const months = days / 30;
  const display = months < 10 ? months.toFixed(1).replace(/\.0$/, "") : `${Math.round(months)}`;
  return { value: `${display} months`, sub: `to earn back the €${PLAN_PRICE}/mo plan` };
}

export default function ROICalculator({ appUrl }: { appUrl: string }) {
  const [values, setValues] = useState<Values>(defaults);

  const set = (key: InputKey, value: number) =>
    setValues((prev) => ({ ...prev, [key]: value }));

  const hoursSaved = (values.tickets * values.minutes * (values.automatable / 100)) / 60;
  const euroSaved = hoursSaved * values.rate;
  const payback = formatPayback(euroSaved);

  const teamCapacity = values.staff * HOURS_PER_FTE_MONTH;
  const teamPct = teamCapacity > 0 ? Math.min(100, Math.round((hoursSaved / teamCapacity) * 100)) : 0;

  const hoursDisplay =
    hoursSaved >= 100 ? Math.round(hoursSaved).toLocaleString("en-US") : hoursSaved.toFixed(1).replace(/\.0$/, "");
  const euroDisplay = Math.round(euroSaved).toLocaleString("en-US");

  return (
    <section id="calculator" className={styles.section}>
      <p className={styles.eyebrow}>ROI Calculator</p>
      <h2 className={styles.title}>See how much time Yippie saves you</h2>
      <p className={styles.sub}>Move the sliders — your numbers update instantly.</p>

      <div className={styles.grid}>
        {/* Inputs */}
        <div className={styles.inputs}>
          {sliders.map((s) => {
            const value = values[s.key];
            const pct = ((value - s.min) / (s.max - s.min)) * 100;
            return (
              <div key={s.key} className={styles.inputRow}>
                <div className={styles.inputHeader}>
                  <label htmlFor={`roi-${s.key}`} className={styles.inputLabel}>
                    {s.label}
                  </label>
                  <span className={styles.inputValue}>{s.format(value)}</span>
                </div>
                <input
                  id={`roi-${s.key}`}
                  type="range"
                  className={styles.slider}
                  min={s.min}
                  max={s.max}
                  step={s.step}
                  value={value}
                  onChange={(e) => set(s.key, Number(e.target.value))}
                  style={{ "--val": `${pct}%` } as CSSProperties}
                  aria-label={s.label}
                />
              </div>
            );
          })}
          <p className={styles.privacyNote}>
            Calculated in your browser — nothing is sent anywhere.
          </p>
        </div>

        {/* Output panel */}
        <div className={styles.output}>
          <div className={styles.results}>
            <div className={styles.result}>
              <div className={styles.resultValue}>{hoursDisplay}h</div>
              <div className={styles.resultLabel}>saved / month</div>
            </div>
            <div className={styles.result}>
              <div className={styles.resultValue}>€{euroDisplay}</div>
              <div className={styles.resultLabel}>saved / month</div>
            </div>
            <div className={styles.result}>
              <div className={styles.resultValue}>{payback.value}</div>
              <div className={styles.resultLabel}>{payback.sub}</div>
            </div>
          </div>

          {teamPct > 0 && (
            <p className={styles.teamNote}>
              That&apos;s {teamPct}% of your {values.staff === 1 ? "support person's" : "team's"} time
              freed up every month.
            </p>
          )}

          <a href={appUrl} className={styles.cta}>
            Request demo →
          </a>
        </div>
      </div>
    </section>
  );
}
