"use client";

import { useMemo, useState } from "react";
import styles from "./request-demo.module.css";
import { CheckIcon } from "../components/icons";

type State = "idle" | "submitting" | "success" | "error";

const TEAM_SIZES = ["1–5", "6–20", "21–50", "50+"];
const INDUSTRIES = [
  "E-commerce",
  "SaaS / Tech",
  "Services",
  "Healthcare",
  "Retail",
  "Other",
];
const TOOLS = [
  "Email only",
  "Zendesk / Freshdesk",
  "HubSpot / CRM",
  "Intercom / Drift",
  "None / Spreadsheets",
];
const PAIN_POINTS = [
  "Ticket volume",
  "Manual sorting",
  "Slow responses",
  "No reporting",
  "Missing automation",
  "Customer follow-up",
];
const MAX_PAIN_POINTS = 3;

const MODULE_INFO: Record<string, { icon: string; desc: string }> = {
  "AI Inbox": { icon: "✦", desc: "AI auto-sorts and drafts replies to every inbound email" },
  Tickets: { icon: "🎫", desc: "Track every issue from first contact to resolution" },
  "Live Chat": { icon: "💬", desc: "Real-time WhatsApp & web chat with session management" },
  "Calendar & Booking": { icon: "📅", desc: "Smart booking links, availability grids, auto-confirmations" },
  "Kanban Pipeline": { icon: "📌", desc: "Visual pipeline for leads, deals, and client stages" },
  "Email Tracking": { icon: "📬", desc: "See when emails are opened, clicked, and bounced" },
  Marketing: { icon: "📣", desc: "Email campaigns, A/B testing, drip sequences, analytics" },
};

const TOP_MODULES = ["AI Inbox", "Tickets", "Live Chat", "Kanban Pipeline"];

function computeRecommendations(
  industry: string,
  currentTools: string[],
  painPoints: string[],
): string[] {
  // Always recommend these (core value props):
  const recommendations = ["AI Inbox", "Tickets"];

  // Industry signals
  if (industry === "E-commerce" || industry === "Retail") {
    recommendations.push("Email Tracking", "Marketing");
  }
  if (industry === "Services" || industry === "Healthcare") {
    recommendations.push("Calendar & Booking");
  }
  if (industry === "SaaS / Tech") {
    recommendations.push("Live Chat");
  }

  // Pain point signals
  if (painPoints.includes("Missing automation") || painPoints.includes("Manual sorting")) {
    if (!recommendations.includes("AI Inbox")) recommendations.push("AI Inbox");
  }
  if (painPoints.includes("Customer follow-up")) {
    recommendations.push("Kanban Pipeline");
  }
  if (painPoints.includes("No reporting")) {
    recommendations.push("Email Tracking");
  }
  if (painPoints.includes("Ticket volume") || painPoints.includes("Slow responses")) {
    recommendations.push("Live Chat");
  }

  // Tools signals
  if (currentTools.includes("Email only") || currentTools.includes("None / Spreadsheets")) {
    recommendations.push("Kanban Pipeline");
  }

  // Deduplicate + cap at 4
  return [...new Set(recommendations)].slice(0, 4);
}

export default function DemoForm() {
  const [step, setStep] = useState<1 | 2>(1);

  // Questionnaire state
  const [teamSize, setTeamSize] = useState("");
  const [industry, setIndustry] = useState("");
  const [currentTools, setCurrentTools] = useState<string[]>([]);
  const [painPoints, setPainPoints] = useState<string[]>([]);

  // Contact state
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [email, setEmail] = useState("");

  const [state, setState] = useState<State>("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const hasAnyAnswer =
    !!teamSize || !!industry || currentTools.length > 0 || painPoints.length > 0;

  const recommendations = useMemo(() => {
    if (!hasAnyAnswer) return TOP_MODULES;
    return computeRecommendations(industry, currentTools, painPoints);
  }, [hasAnyAnswer, industry, currentTools, painPoints]);

  function toggleMulti(
    value: string,
    list: string[],
    setList: (v: string[]) => void,
    max?: number,
  ) {
    if (list.includes(value)) {
      setList(list.filter((v) => v !== value));
    } else {
      if (max && list.length >= max) return;
      setList([...list, value]);
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setState("submitting");
    setErrorMsg("");

    try {
      const res = await fetch("/api/request-demo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          company_name: company,
          email,
          questionnaire: {
            team_size: teamSize || null,
            industry: industry || null,
            current_tools: currentTools.length ? currentTools : null,
            pain_points: painPoints.length ? painPoints : null,
            recommended_modules: recommendations,
          },
        }),
      });

      if (res.ok) {
        setState("success");
        return;
      }

      const data = await res.json().catch(() => ({}));
      const msg =
        typeof data?.error === "string"
          ? data.error
          : "Something went wrong. Please try again.";
      setErrorMsg(msg);
      setState("error");
    } catch {
      setErrorMsg("Network error — please check your connection and try again.");
      setState("error");
    }
  }

  if (state === "success") {
    return (
      <div className={styles.card}>
        <div className={styles.success}>
          <div className={styles.successIcon}>
            <CheckIcon size={24} />
          </div>
          <h2 className={styles.successTitle}>Demo sent</h2>
          <p className={styles.successSub}>
            Check your inbox — we&apos;ve emailed you a one-click link to enter your
            Yippie demo workspace.
          </p>
        </div>
      </div>
    );
  }

  const busy = state === "submitting";

  // ── Step 1 — Questionnaire ──────────────────────────
  if (step === 1) {
    return (
      <div className={styles.card}>
        <div className={styles.steps}>
          <span className={`${styles.stepDot} ${styles.stepDotActive}`}>1</span>
          <span className={styles.stepLine} />
          <span className={styles.stepDot}>2</span>
        </div>
        <p className={styles.stepHint}>
          A few quick questions so we can tailor your demo. All optional.
        </p>

        <div className={styles.question}>
          <span className={styles.qLabel}>How big is your team?</span>
          <div className={styles.chips}>
            {TEAM_SIZES.map((opt) => (
              <button
                key={opt}
                type="button"
                className={`${styles.chip} ${teamSize === opt ? styles.chipActive : ""}`}
                onClick={() => setTeamSize(teamSize === opt ? "" : opt)}
              >
                {opt}
              </button>
            ))}
          </div>
        </div>

        <div className={styles.question}>
          <span className={styles.qLabel}>What industry are you in?</span>
          <div className={styles.chips}>
            {INDUSTRIES.map((opt) => (
              <button
                key={opt}
                type="button"
                className={`${styles.chip} ${industry === opt ? styles.chipActive : ""}`}
                onClick={() => setIndustry(industry === opt ? "" : opt)}
              >
                {opt}
              </button>
            ))}
          </div>
        </div>

        <div className={styles.question}>
          <span className={styles.qLabel}>What tools do you use today?</span>
          <div className={styles.chips}>
            {TOOLS.map((opt) => (
              <button
                key={opt}
                type="button"
                className={`${styles.chip} ${currentTools.includes(opt) ? styles.chipActive : ""}`}
                onClick={() => toggleMulti(opt, currentTools, setCurrentTools)}
              >
                {opt}
              </button>
            ))}
          </div>
        </div>

        <div className={styles.question}>
          <span className={styles.qLabel}>
            Biggest pain points?{" "}
            <span className={styles.qHint}>pick up to {MAX_PAIN_POINTS}</span>
          </span>
          <div className={styles.chips}>
            {PAIN_POINTS.map((opt) => {
              const selected = painPoints.includes(opt);
              const disabled = !selected && painPoints.length >= MAX_PAIN_POINTS;
              return (
                <button
                  key={opt}
                  type="button"
                  className={`${styles.chip} ${selected ? styles.chipActive : ""}`}
                  onClick={() =>
                    toggleMulti(opt, painPoints, setPainPoints, MAX_PAIN_POINTS)
                  }
                  disabled={disabled}
                >
                  {opt}
                </button>
              );
            })}
          </div>
        </div>

        <button
          className={styles.submit}
          type="button"
          onClick={() => setStep(2)}
        >
          Continue →
        </button>
      </div>
    );
  }

  // ── Step 2 — Recommendation + contact form ──────────
  return (
    <form className={styles.card} onSubmit={handleSubmit} noValidate>
      <div className={styles.steps}>
        <button
          type="button"
          className={`${styles.stepDot} ${styles.stepDotDone}`}
          onClick={() => setStep(1)}
          aria-label="Back to questions"
        >
          1
        </button>
        <span className={`${styles.stepLine} ${styles.stepLineActive}`} />
        <span className={`${styles.stepDot} ${styles.stepDotActive}`}>2</span>
      </div>

      <div className={styles.recCard}>
        <span className={styles.recLabel}>
          {hasAnyAnswer
            ? "Recommended for you"
            : "Here's what teams like yours use most"}
        </span>
        <div className={styles.recList}>
          {recommendations.map((m) => {
            const info = MODULE_INFO[m];
            if (!info) return null;
            return (
              <div key={m} className={styles.recBadge}>
                <span className={styles.recIcon}>{info.icon}</span>
                <span className={styles.recText}>
                  <span className={styles.recName}>{m}</span>
                  <span className={styles.recDesc}>{info.desc}</span>
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <div className={styles.fieldGroup}>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="demo-name">
            Your name
          </label>
          <input
            id="demo-name"
            className={styles.input}
            type="text"
            placeholder="Jane Smith"
            required
            autoComplete="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={busy}
          />
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="demo-company">
            Company name
          </label>
          <input
            id="demo-company"
            className={styles.input}
            type="text"
            placeholder="Acme BV"
            required
            autoComplete="organization"
            value={company}
            onChange={(e) => setCompany(e.target.value)}
            disabled={busy}
          />
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="demo-email">
            Work email
          </label>
          <input
            id="demo-email"
            className={styles.input}
            type="email"
            placeholder="jane@acme.com"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={busy}
          />
        </div>
      </div>

      <button className={styles.submit} type="submit" disabled={busy}>
        {busy ? "Sending…" : "Request demo →"}
      </button>

      {state === "error" && errorMsg && (
        <p className={styles.error}>{errorMsg}</p>
      )}

      <p className={styles.finePrint}>
        No credit card required · Usually replies within 1 business day
      </p>
    </form>
  );
}
