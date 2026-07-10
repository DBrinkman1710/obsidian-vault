"use client";

import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import styles from "./ROICalculator.module.css";
// The extension popup mock lives in the homepage stylesheet — reused here so
// the ROI section's first tab shows the real preview instead of a text card.
import extStyles from "../page.module.css";
import { LockIcon } from "./icons";

const PLAN_PRICE = 29; // cheapest Yippie plan, €/mo
const HOURS_PER_FTE_MONTH = 160;

const TICKETS_MIN = 10;
const TICKETS_MAX = 2000;

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

const CHROME_STORE_URL =
  "https://chromewebstore.google.com/detail/yippie-inbox-analyser/fhfdjapipgidbknncajebhglembhaick";

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

type Mode = "inbox" | "manual";

export default function ROICalculator({ appUrl }: { appUrl: string }) {
  const [values, setValues] = useState<Values>(defaults);
  // Inbox connect is the primary experience; manual sliders are the fallback tab.
  const [mode, setMode] = useState<Mode>("inbox");
  const [scanned, setScanned] = useState(false);

  const set = (key: InputKey, value: number) =>
    setValues((prev) => ({ ...prev, [key]: value }));

  useEffect(() => {
    // The Chrome extension deep-links here with a real ticket estimate.
    const params = new URLSearchParams(window.location.search);
    const roiTickets = params.get("roi_tickets");
    if (roiTickets) {
      const n = parseInt(roiTickets, 10);
      if (!Number.isNaN(n)) {
        const clamped = Math.min(TICKETS_MAX, Math.max(TICKETS_MIN, n));
        setValues((prev) => ({ ...prev, tickets: clamped }));
        setScanned(true);
        setMode("inbox");
      }
    }
  }, []);

  const clearScan = () => {
    setScanned(false);
    setValues((prev) => ({ ...prev, tickets: defaults.tickets }));
  };

  const hoursSaved =
    (values.tickets * values.staff * values.minutes * (values.automatable / 100)) / 60;
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
      <p className={styles.sub}>
        Connect your inbox for a personalised estimate, or move the sliders yourself.
      </p>

      <div className={styles.tabs} role="tablist" aria-label="ROI estimate mode">
        <button
          type="button"
          role="tab"
          aria-selected={mode === "inbox"}
          className={`${styles.tab} ${mode === "inbox" ? styles.tabActive : ""}`}
          onClick={() => setMode("inbox")}
        >
          Use my inbox
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === "manual"}
          className={`${styles.tab} ${mode === "manual" ? styles.tabActive : ""}`}
          onClick={() => setMode("manual")}
        >
          Manual estimate
        </button>
      </div>

      {/* Tab 1 — extension preview + download; sliders live on the manual tab */}
      {mode === "inbox" && (
        <div className={styles.uploadWrap}>
          {scanned ? (
            <>
              <div className={styles.scanResult}>
                <span className={styles.scanBadge}>
                  Estimated from your inbox via the Chrome extension
                </span>
                <button type="button" className={styles.clearLink} onClick={clearScan}>
                  Clear / try again
                </button>
              </div>
              {/* Personalised results for the scanned estimate */}
              <div className={styles.output} style={{ width: "100%", maxWidth: 520 }}>
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
            </>
          ) : (
            <>
              {/* Live preview of the extension popup */}
              <div className={extStyles.extensionPreview}>
                <div className={extStyles.extensionCard}>
                  <div className={extStyles.extensionHeader}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src="/logo-white-bg-mark.svg" alt="" className={extStyles.extensionLogo} />
                    <span className={extStyles.extensionName}>Yippie Inbox Analyser</span>
                  </div>
                  <div className={extStyles.extensionStat}>
                    <span className={extStyles.extensionStatNum}>847</span>
                    <span className={extStyles.extensionStatLabel}>emails last 30 days</span>
                  </div>
                  <div className={extStyles.extensionRows}>
                    <div className={extStyles.extensionRow}>
                      <span className={`${extStyles.extensionDot} ${extStyles.dotBlue}`} />
                      <span>Customer conversations</span>
                      <strong>340</strong>
                    </div>
                    <div className={extStyles.extensionRow}>
                      <span className={`${extStyles.extensionDot} ${extStyles.dotGrey}`} />
                      <span>Newsletters / automated</span>
                      <strong>290</strong>
                    </div>
                    <div className={extStyles.extensionRow}>
                      <span className={`${extStyles.extensionDot} ${extStyles.dotAmber}`} />
                      <span>Internal</span>
                      <strong>150</strong>
                    </div>
                  </div>
                  <div className={extStyles.extensionSavings}>
                    <span>Yippie saves you</span>
                    <strong>~15 hrs/month</strong>
                  </div>
                  <div className={extStyles.extensionBadge}>
                    <LockIcon size={13} /> Headers only · nothing leaves your browser
                  </div>
                </div>
              </div>

              {/* Download button underneath the preview */}
              <a
                href={CHROME_STORE_URL}
                target="_blank"
                rel="noopener noreferrer"
                className={styles.extInstallBtn}
              >
                Add to Chrome — it&apos;s free →
              </a>
              <p className={styles.extNote}>
                Free Chrome extension for Gmail &amp; Outlook. It reads email metadata only — never
                content — then opens this calculator with your real numbers pre-filled.
              </p>
            </>
          )}
          <p className={styles.privacyStrong}>We never read your email content.</p>
        </div>
      )}

      {/* Tab 2 — manual calculator with the sliders */}
      {mode === "manual" && (
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
              Calculated in your browser. Nothing is sent anywhere.
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
      )}
    </section>
  );
}
