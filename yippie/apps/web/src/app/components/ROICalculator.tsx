"use client";

import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { usePathname } from "next/navigation";
import styles from "./ROICalculator.module.css";
// The extension popup mock lives in the homepage stylesheet — reused here so
// the ROI section's first tab shows the real preview instead of a text card.
import extStyles from "../page.module.css";
import { LockIcon } from "./icons";
import { PLAN_LIMITS } from "@/lib/config";
import { getLocale } from "@/lib/i18n";

const PLAN_PRICE = PLAN_LIMITS.starter.priceMonthly; // cheapest Yippie plan, €/mo
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

const sliderDefs: Record<"nl" | "en", SliderConfig[]> = {
  nl: [
    {
      key: "tickets",
      label: "Tickets per maand",
      min: 10,
      max: 2000,
      step: 10,
      format: (v) => v.toLocaleString("nl-NL"),
    },
    {
      key: "minutes",
      label: "Gem. minuten per ticket",
      min: 1,
      max: 60,
      step: 1,
      format: (v) => `${v} min`,
    },
    {
      key: "staff",
      label: "Supportmedewerkers",
      min: 1,
      max: 20,
      step: 1,
      format: (v) => `${v}`,
    },
    {
      key: "rate",
      label: "Uurtarief medewerker",
      min: 10,
      max: 100,
      step: 1,
      format: (v) => `€${v}`,
    },
    {
      key: "automatable",
      label: "% automatiseerbaar door Yippie",
      min: 10,
      max: 90,
      step: 5,
      format: (v) => `${v}%`,
    },
  ],
  en: [
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
  ],
};

const uiCopy = {
  nl: {
    eyebrow: "ROI Calculator",
    title: "Zie hoeveel tijd Yippie je bespaart",
    sub: "Verbind je inbox voor een persoonlijke schatting, of beweeg de schuifregelaars zelf.",
    tabInbox: "Gebruik mijn inbox",
    tabManual: "Handmatige schatting",
    scanBadge: "Geschat vanuit je inbox via de Chrome-extensie",
    clearLink: "Wissen / opnieuw proberen",
    savedMonth: "bespaard / maand",
    instantROI: "Direct rendement",
    planEarnedDayOne: (price: number) => `€${price}/mnd abonnement al op dag één terugverdiend`,
    daysPayback: (days: number, price: number) => ({
      value: `${days} dagen`,
      sub: `om het €${price}/mnd abonnement terug te verdienen`,
    }),
    monthsPayback: (display: string, price: number) => ({
      value: `${display} maanden`,
      sub: `om het €${price}/mnd abonnement terug te verdienen`,
    }),
    noSavings: { value: "—", sub: "nog geen besparing" },
    teamNote: (pct: number, staff: number) =>
      `Dat is ${pct}% van de tijd van je ${staff === 1 ? "supportmedewerker" : "team"} die elke maand vrijkomt.`,
    requestDemo: "Demo aanvragen →",
    extensionName: "Yippie Inbox Analyser",
    emailsLast30: "e-mails afgelopen 30 dagen",
    customerConversations: "Klantgesprekken",
    newsletters: "Nieuwsbrieven / geautomatiseerd",
    internal: "Intern",
    yippieSaves: "Yippie bespaart je",
    headersOnly: "Alleen headers · niets verlaat je browser",
    addToChrome: "Toevoegen aan Chrome — gratis →",
    extNote: "Gratis Chrome-extensie voor Gmail & Outlook. Leest alleen e-mailmetadata — nooit de inhoud — en opent deze calculator met je echte cijfers ingevuld.",
    privacyStrong: "We lezen nooit de inhoud van je e-mails.",
    privacyNote: "Berekend in je browser. Er wordt niets verstuurd.",
  },
  en: {
    eyebrow: "ROI Calculator",
    title: "See how much time Yippie saves you",
    sub: "Connect your inbox for a personalised estimate, or move the sliders yourself.",
    tabInbox: "Use my inbox",
    tabManual: "Manual estimate",
    scanBadge: "Estimated from your inbox via the Chrome extension",
    clearLink: "Clear / try again",
    savedMonth: "saved / month",
    instantROI: "Instant ROI",
    planEarnedDayOne: (price: number) => `€${price} plan earned back on day one`,
    daysPayback: (days: number, price: number) => ({
      value: `${days} days`,
      sub: `to earn back the €${price}/mo plan`,
    }),
    monthsPayback: (display: string, price: number) => ({
      value: `${display} months`,
      sub: `to earn back the €${price}/mo plan`,
    }),
    noSavings: { value: "—", sub: "no savings yet" },
    teamNote: (pct: number, staff: number) =>
      `That’s ${pct}% of your ${staff === 1 ? "support person’s" : "team’s"} time freed up every month.`,
    requestDemo: "Request demo →",
    extensionName: "Yippie Inbox Analyser",
    emailsLast30: "emails last 30 days",
    customerConversations: "Customer conversations",
    newsletters: "Newsletters / automated",
    internal: "Internal",
    yippieSaves: "Yippie saves you",
    headersOnly: "Headers only · nothing leaves your browser",
    addToChrome: "Add to Chrome — it’s free →",
    extNote: "Free Chrome extension for Gmail & Outlook. It reads email metadata only — never content — then opens this calculator with your real numbers pre-filled.",
    privacyStrong: "We never read your email content.",
    privacyNote: "Calculated in your browser. Nothing is sent anywhere.",
  },
} as const;

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

function formatPayback(savedPerMonth: number, t: typeof uiCopy["nl"] | typeof uiCopy["en"]): { value: string; sub: string } {
  if (savedPerMonth <= 0) {
    return t.noSavings;
  }
  const days = (PLAN_PRICE / savedPerMonth) * 30;
  if (days <= 1) {
    return { value: t.instantROI, sub: t.planEarnedDayOne(PLAN_PRICE) };
  }
  if (days < 30) {
    return t.daysPayback(Math.ceil(days), PLAN_PRICE);
  }
  const months = days / 30;
  const display = months < 10 ? months.toFixed(1).replace(/\.0$/, "") : `${Math.round(months)}`;
  return t.monthsPayback(display, PLAN_PRICE);
}

type Mode = "inbox" | "manual";

export default function ROICalculator({ appUrl }: { appUrl: string }) {
  const [values, setValues] = useState<Values>(defaults);
  // Inbox connect is the primary experience; manual sliders are the fallback tab.
  const [mode, setMode] = useState<Mode>("inbox");
  const [scanned, setScanned] = useState(false);
  const pathname = usePathname();
  const locale = getLocale(pathname);
  const t = uiCopy[locale];
  const sliders = sliderDefs[locale];

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
  const payback = formatPayback(euroSaved, t);

  const teamCapacity = values.staff * HOURS_PER_FTE_MONTH;
  const teamPct = teamCapacity > 0 ? Math.min(100, Math.round((hoursSaved / teamCapacity) * 100)) : 0;

  const numLocale = locale === "nl" ? "nl-NL" : "en-US";
  const hoursDisplay =
    hoursSaved >= 100 ? Math.round(hoursSaved).toLocaleString(numLocale) : hoursSaved.toFixed(1).replace(/\.0$/, "");
  const euroDisplay = Math.round(euroSaved).toLocaleString(numLocale);

  return (
    <section id="calculator" className={styles.section}>
      <p className={styles.eyebrow}>{t.eyebrow}</p>
      <h2 className={styles.title}>{t.title}</h2>
      <p className={styles.sub}>{t.sub}</p>

      <div className={styles.tabs} role="tablist" aria-label="ROI estimate mode">
        <button
          type="button"
          role="tab"
          aria-selected={mode === "inbox"}
          className={`${styles.tab} ${mode === "inbox" ? styles.tabActive : ""}`}
          onClick={() => setMode("inbox")}
        >
          {t.tabInbox}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === "manual"}
          className={`${styles.tab} ${mode === "manual" ? styles.tabActive : ""}`}
          onClick={() => setMode("manual")}
        >
          {t.tabManual}
        </button>
      </div>

      {/* Tab 1 — extension preview + download; sliders live on the manual tab */}
      {mode === "inbox" && (
        <div className={styles.uploadWrap}>
          {scanned ? (
            <>
              <div className={styles.scanResult}>
                <span className={styles.scanBadge}>{t.scanBadge}</span>
                <button type="button" className={styles.clearLink} onClick={clearScan}>
                  {t.clearLink}
                </button>
              </div>
              {/* Personalised results for the scanned estimate */}
              <div className={styles.output} style={{ width: "100%", maxWidth: 520 }}>
                <div className={styles.results}>
                  <div className={styles.result}>
                    <div className={styles.resultValue}>{hoursDisplay}h</div>
                    <div className={styles.resultLabel}>{t.savedMonth}</div>
                  </div>
                  <div className={styles.result}>
                    <div className={styles.resultValue}>€{euroDisplay}</div>
                    <div className={styles.resultLabel}>{t.savedMonth}</div>
                  </div>
                  <div className={styles.result}>
                    <div className={styles.resultValue}>{payback.value}</div>
                    <div className={styles.resultLabel}>{payback.sub}</div>
                  </div>
                </div>
                {teamPct > 0 && (
                  <p className={styles.teamNote}>{t.teamNote(teamPct, values.staff)}</p>
                )}
                <a href={appUrl} className={styles.cta}>
                  {t.requestDemo}
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
                    <span className={extStyles.extensionName}>{t.extensionName}</span>
                  </div>
                  <div className={extStyles.extensionStat}>
                    <span className={extStyles.extensionStatNum}>847</span>
                    <span className={extStyles.extensionStatLabel}>{t.emailsLast30}</span>
                  </div>
                  <div className={extStyles.extensionRows}>
                    <div className={extStyles.extensionRow}>
                      <span className={`${extStyles.extensionDot} ${extStyles.dotBlue}`} />
                      <span>{t.customerConversations}</span>
                      <strong>340</strong>
                    </div>
                    <div className={extStyles.extensionRow}>
                      <span className={`${extStyles.extensionDot} ${extStyles.dotGrey}`} />
                      <span>{t.newsletters}</span>
                      <strong>290</strong>
                    </div>
                    <div className={extStyles.extensionRow}>
                      <span className={`${extStyles.extensionDot} ${extStyles.dotAmber}`} />
                      <span>{t.internal}</span>
                      <strong>150</strong>
                    </div>
                  </div>
                  <div className={extStyles.extensionSavings}>
                    <span>{t.yippieSaves}</span>
                    <strong>~15 hrs/month</strong>
                  </div>
                  <div className={extStyles.extensionBadge}>
                    <LockIcon size={13} /> {t.headersOnly}
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
                {t.addToChrome}
              </a>
              <p className={styles.extNote}>{t.extNote}</p>
            </>
          )}
          <p className={styles.privacyStrong}>{t.privacyStrong}</p>
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
            <p className={styles.privacyNote}>{t.privacyNote}</p>
          </div>

          {/* Output panel */}
          <div className={styles.output}>
            <div className={styles.results}>
              <div className={styles.result}>
                <div className={styles.resultValue}>{hoursDisplay}h</div>
                <div className={styles.resultLabel}>{t.savedMonth}</div>
              </div>
              <div className={styles.result}>
                <div className={styles.resultValue}>€{euroDisplay}</div>
                <div className={styles.resultLabel}>{t.savedMonth}</div>
              </div>
              <div className={styles.result}>
                <div className={styles.resultValue}>{payback.value}</div>
                <div className={styles.resultLabel}>{payback.sub}</div>
              </div>
            </div>

            {teamPct > 0 && (
              <p className={styles.teamNote}>{t.teamNote(teamPct, values.staff)}</p>
            )}

            <a href={appUrl} className={styles.cta}>
              {t.requestDemo}
            </a>
          </div>
        </div>
      )}
    </section>
  );
}
