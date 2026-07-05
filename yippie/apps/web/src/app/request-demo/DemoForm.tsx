"use client";

import { useMemo, useState } from "react";
import styles from "./request-demo.module.css";
import {
  CheckIcon,
  AiIcon,
  TicketIcon,
  ChatIcon,
  CalendarIcon,
  KanbanIcon,
  MegaphoneIcon,
  TeamIcon,
  BillingIcon,
  TrackingIcon,
  SalesIcon,
  SaasIcon,
} from "../components/icons";
import {
  TEAM_SIZES,
  INDUSTRIES,
  TOOLS,
  PAIN_POINTS,
  MODULE_INFO,
  TOP_MODULES,
  computeRecommendations,
} from "../../lib/recommendations";

type IconComponent = React.ComponentType<{ size?: number }>;

const MODULE_ICONS: Record<string, IconComponent> = {
  "AI Inbox":          AiIcon,
  "Tickets":           TicketIcon,
  "Live Chat":         ChatIcon,
  "Calendar":          CalendarIcon,
  "Pipeline":          KanbanIcon,
  "Marketing":         MegaphoneIcon,
  "Departments":       TeamIcon,
  "Billing":           BillingIcon,
  "Shipment Tracking": TrackingIcon,
  "Sales":             SalesIcon,
  "SaaS Analytics":    SaasIcon,
};

const ALL_MODULES = Object.keys(MODULE_INFO);

type State = "idle" | "submitting" | "success" | "error";

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
      setErrorMsg("Network error. Please check your connection and try again.");
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
            Check your inbox. We&apos;ve emailed you a one-click link to enter your
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
          <span className={styles.qLabel}>Biggest pain points?</span>
          <div className={styles.chips}>
            {PAIN_POINTS.map((opt) => {
              const selected = painPoints.includes(opt);
              return (
                <button
                  key={opt}
                  type="button"
                  className={`${styles.chip} ${selected ? styles.chipActive : ""}`}
                  onClick={() => toggleMulti(opt, painPoints, setPainPoints)}
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

  // ── Step 2 — Module overview + contact form ──────────
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

      <div className={styles.moduleSection}>
        <p className={styles.moduleSectionLabel}>
          {hasAnyAnswer ? "Modules we'll show you" : "What's inside Yippie"}
        </p>
        <p className={styles.moduleSectionSub}>
          {hasAnyAnswer
            ? "We'll focus on the highlighted modules based on your answers. You'll also get a full tour."
            : "Pick a demo to see any of these modules in action."}
        </p>
        <div className={styles.moduleGrid}>
          {ALL_MODULES.map((m) => {
            const info = MODULE_INFO[m];
            const Icon = MODULE_ICONS[m];
            const isRec = recommendations.includes(m);
            return (
              <div
                key={m}
                className={`${styles.moduleCard} ${isRec ? styles.moduleCardRec : ""}`}
              >
                {isRec && (
                  <span className={styles.moduleRecBadge}>Recommended</span>
                )}
                <div className={`${styles.moduleCardIcon} ${isRec ? styles.moduleCardIconRec : ""}`}>
                  {Icon && <Icon size={18} />}
                </div>
                <p className={styles.moduleCardName}>{m}</p>
                <p className={styles.moduleCardDesc}>{info?.desc}</p>
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
