"use client";

import { useEffect, useRef, useState } from "react";
import type { CSSProperties, ChangeEvent, DragEvent } from "react";
import styles from "./ROICalculator.module.css";

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

/* ── CSV parsing (pure browser, no deps) ──────────────────────── */

// Split a single CSV line into fields, honouring double-quoted values.
function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line.charAt(i);
    if (inQuotes) {
      if (char === '"') {
        if (line.charAt(i + 1) === '"') {
          current += '"';
          i++; // escaped quote
        } else {
          inQuotes = false;
        }
      } else {
        current += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      fields.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  fields.push(current);
  return fields;
}

// Header candidates that usually hold a date we can use, ranked by preference.
const DATE_HEADER_HINTS = [
  "received",
  "date received",
  "sent",
  "date sent",
  "date",
  "time",
  "datetime",
  "received date",
  "delivery-time",
];

type ParsedScan = {
  emailCount: number;
  dateRangeMonths: number;
  ticketsPerMonth: number;
  source?: "csv" | "extension";
};

const CHROME_STORE_URL =
  "https://chromewebstore.google.com/detail/yippie-inbox-analyser/kcenfkplkjdgiaddkjdnomhalofhenbd";

function parseEmailCsv(raw: string): ParsedScan | null {
  // Normalise Windows / old-Mac line endings and drop empty trailing lines.
  const text = raw.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const lines = text.split("\n").filter((l) => l.trim().length > 0);
  if (lines.length < 2) return null;

  const header = parseCsvLine(lines[0] ?? "").map((h) => h.trim().toLowerCase());

  // Find the best date column from the header hints.
  let dateIdx = -1;
  for (const hint of DATE_HEADER_HINTS) {
    const idx = header.findIndex((h) => h === hint);
    if (idx !== -1) {
      dateIdx = idx;
      break;
    }
  }
  if (dateIdx === -1) {
    // Looser match: any header that contains "date" or "received" / "sent".
    dateIdx = header.findIndex(
      (h) => h.includes("date") || h.includes("received") || h.includes("sent")
    );
  }

  const rows = lines.slice(1);
  const emailCount = rows.length;
  if (emailCount === 0) return null;

  let dateRangeMonths = 1;

  if (dateIdx !== -1) {
    let minTime = Infinity;
    let maxTime = -Infinity;
    for (const row of rows) {
      const cells = parseCsvLine(row);
      const cell = dateIdx < cells.length ? cells[dateIdx] : undefined;
      if (!cell) continue;
      const t = Date.parse(cell.trim());
      if (!Number.isNaN(t)) {
        if (t < minTime) minTime = t;
        if (t > maxTime) maxTime = t;
      }
    }
    if (Number.isFinite(minTime) && Number.isFinite(maxTime) && maxTime >= minTime) {
      const ms = maxTime - minTime;
      const months = ms / (1000 * 60 * 60 * 24 * 30.44);
      dateRangeMonths = Math.max(1, Math.round(months));
    }
  }

  const rawPerMonth = emailCount / dateRangeMonths;
  const ticketsPerMonth = Math.min(
    TICKETS_MAX,
    Math.max(TICKETS_MIN, Math.round(rawPerMonth / 10) * 10)
  );

  return { emailCount, dateRangeMonths, ticketsPerMonth };
}

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

type Mode = "manual" | "inbox";

export default function ROICalculator({ appUrl }: { appUrl: string }) {
  const [values, setValues] = useState<Values>(defaults);
  const [mode, setMode] = useState<Mode>("manual");
  const [scan, setScan] = useState<ParsedScan | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const set = (key: InputKey, value: number) =>
    setValues((prev) => ({ ...prev, [key]: value }));

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const roiTickets = params.get("roi_tickets");
    if (roiTickets) {
      const n = parseInt(roiTickets, 10);
      if (!Number.isNaN(n)) {
        const clamped = Math.min(TICKETS_MAX, Math.max(TICKETS_MIN, n));
        setValues((prev) => ({ ...prev, tickets: clamped }));
        setScan({ emailCount: n, dateRangeMonths: 1, ticketsPerMonth: clamped, source: "extension" });
        setMode("inbox");
      }
    }
  }, []);

  const handleFile = (file: File) => {
    setUploadError(null);
    const reader = new FileReader();
    reader.onerror = () =>
      setUploadError("We couldn't read that file. Try a different export format.");
    reader.onload = () => {
      const text = typeof reader.result === "string" ? reader.result : "";
      const result = parseEmailCsv(text);
      if (!result) {
        setScan(null);
        setUploadError("We couldn't read that file. Try a different export format.");
        return;
      }
      setScan(result);
      set("tickets", result.ticketsPerMonth);
    };
    reader.readAsText(file);
  };

  const onFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  const clearScan = () => {
    setScan(null);
    setUploadError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
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
        Move the sliders, or connect your inbox for a personalised estimate.
      </p>

      <div className={styles.tabs} role="tablist" aria-label="ROI estimate mode">
        <button
          type="button"
          role="tab"
          aria-selected={mode === "manual"}
          className={`${styles.tab} ${mode === "manual" ? styles.tabActive : ""}`}
          onClick={() => setMode("manual")}
        >
          Manual estimate
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === "inbox"}
          className={`${styles.tab} ${mode === "inbox" ? styles.tabActive : ""}`}
          onClick={() => setMode("inbox")}
        >
          Use my inbox
        </button>
      </div>

      {mode === "inbox" && (
        <div className={styles.uploadWrap}>
          {scan ? (
            <div className={styles.scanResult}>
              <span className={styles.scanBadge}>
                {scan.source === "extension"
                  ? "Estimated from your inbox via the Chrome extension"
                  : `Estimated from ${scan.emailCount.toLocaleString("en-US")} emails over ${scan.dateRangeMonths} ${scan.dateRangeMonths === 1 ? "month" : "months"}`}
              </span>
              <button type="button" className={styles.clearLink} onClick={clearScan}>
                Clear / try again
              </button>
            </div>
          ) : (
            <>
              <div className={styles.extCard}>
                <p className={styles.extCardTitle}>Yippie Inbox Analyser</p>
                <p className={styles.extCardSub}>Free Chrome extension · Gmail &amp; Outlook</p>
                <p className={styles.extCardDesc}>
                  Install the extension to connect your inbox directly. It reads email metadata
                  only — never content — then opens this calculator with your real numbers pre-filled.
                </p>
                <a
                  href={CHROME_STORE_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.extInstallBtn}
                >
                  Add to Chrome →
                </a>
                <p className={styles.extNote}>
                  Already installed? Click &ldquo;See your full ROI&rdquo; inside the extension.
                </p>
              </div>

              <div className={styles.inboxOr}><span>or upload a CSV</span></div>

              <div
                className={`${styles.dropzone} ${dragging ? styles.dropzoneActive : ""}`}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragging(true);
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={onDrop}
                onClick={() => fileInputRef.current?.click()}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    fileInputRef.current?.click();
                  }
                }}
              >
                <p className={styles.dropTitle}>Drop your email CSV export here</p>
                <p className={styles.dropHint}>
                  Outlook export or Gmail Takeout CSV
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,text/csv"
                  className={styles.fileInput}
                  onChange={onFileChange}
                />
              </div>
              {uploadError && <p className={styles.uploadError}>{uploadError}</p>}
            </>
          )}
          <p className={styles.privacyStrong}>We never read your email content.</p>
        </div>
      )}

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
    </section>
  );
}
