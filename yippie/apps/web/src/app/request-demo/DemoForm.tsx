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
  ContractIcon,
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
  INDUSTRY_LABELS_NL,
  TOOL_LABELS_NL,
  PAIN_POINT_LABELS_NL,
  MODULE_LABEL_NL,
  MODULE_DESC_NL,
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
  "Contracts":         ContractIcon,
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
  // Honeypot — real visitors never see or fill this field.
  const [website, setWebsite] = useState("");

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
          website,
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
          : "Er is iets misgegaan. Probeer het opnieuw.";
      setErrorMsg(msg);
      setState("error");
    } catch {
      setErrorMsg("Netwerkfout. Controleer je verbinding en probeer het opnieuw.");
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
          <h2 className={styles.successTitle}>Demo verzonden</h2>
          <p className={styles.successSub}>
            Controleer je inbox. We hebben je een link gestuurd waarmee je met één klik
            je Yippie-demoruimte kunt openen.
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
          Een paar snelle vragen zodat we je demo kunnen afstemmen. Allemaal optioneel.
        </p>

        <div className={styles.question}>
          <span className={styles.qLabel}>Hoe groot is je team?</span>
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
          <span className={styles.qLabel}>In welke branche zit je?</span>
          <div className={styles.chips}>
            {INDUSTRIES.map((opt) => (
              <button
                key={opt}
                type="button"
                className={`${styles.chip} ${industry === opt ? styles.chipActive : ""}`}
                onClick={() => setIndustry(industry === opt ? "" : opt)}
              >
                {INDUSTRY_LABELS_NL[opt] ?? opt}
              </button>
            ))}
          </div>
        </div>

        <div className={styles.question}>
          <span className={styles.qLabel}>Welke tools gebruik je nu?</span>
          <div className={styles.chips}>
            {TOOLS.map((opt) => (
              <button
                key={opt}
                type="button"
                className={`${styles.chip} ${currentTools.includes(opt) ? styles.chipActive : ""}`}
                onClick={() => toggleMulti(opt, currentTools, setCurrentTools)}
              >
                {TOOL_LABELS_NL[opt] ?? opt}
              </button>
            ))}
          </div>
        </div>

        <div className={styles.question}>
          <span className={styles.qLabel}>Grootste uitdagingen?</span>
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
                  {PAIN_POINT_LABELS_NL[opt] ?? opt}
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
          Doorgaan →
        </button>
      </div>
    );
  }

  // ── Step 2 — Module overview + contact form ──────────
  return (
    <form className={styles.card} onSubmit={handleSubmit}>
      <div className={styles.steps}>
        <button
          type="button"
          className={`${styles.stepDot} ${styles.stepDotDone}`}
          onClick={() => setStep(1)}
          aria-label="Terug naar vragen"
        >
          1
        </button>
        <span className={`${styles.stepLine} ${styles.stepLineActive}`} />
        <span className={`${styles.stepDot} ${styles.stepDotActive}`}>2</span>
      </div>

      <div className={styles.moduleSection}>
        <p className={styles.moduleSectionLabel}>
          {hasAnyAnswer ? "Modules die we je laten zien" : "Wat zit er in Yippie"}
        </p>
        <p className={styles.moduleSectionSub}>
          {hasAnyAnswer
            ? "We focussen op de gemarkeerde modules op basis van je antwoorden. Je krijgt ook een volledige rondleiding."
            : "Kies een demo om een van deze modules in actie te zien."}
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
                  <span className={styles.moduleRecBadge}>Aanbevolen</span>
                )}
                <div className={`${styles.moduleCardIcon} ${isRec ? styles.moduleCardIconRec : ""}`}>
                  {Icon && <Icon size={18} />}
                </div>
                <p className={styles.moduleCardName}>{MODULE_LABEL_NL[m] ?? m}</p>
                <p className={styles.moduleCardDesc}>{MODULE_DESC_NL[m] ?? info?.desc}</p>
              </div>
            );
          })}
        </div>
      </div>

      <div className={styles.fieldGroup}>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="demo-name">
            Jouw naam
          </label>
          <input
            id="demo-name"
            className={styles.input}
            type="text"
            placeholder="Jan de Vries"
            required
            autoComplete="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={busy}
          />
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="demo-company">
            Bedrijfsnaam
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
            Werk e-mail
          </label>
          <input
            id="demo-email"
            className={styles.input}
            type="email"
            placeholder="jan@acme.com"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={busy}
          />
        </div>
      </div>

      {/* Honeypot — visually hidden; bots that fill it are silently dropped server-side.
          `name` deliberately avoids "website"/"url"-style values: browsers' autofill
          heuristics target those even on a hidden field, which silently discarded
          real visitors' submissions (autoComplete="off" is widely ignored). */}
      <input
        type="text"
        name="hp_a1"
        value={website}
        onChange={(e) => setWebsite(e.target.value)}
        autoComplete="one-time-code"
        tabIndex={-1}
        aria-hidden="true"
        style={{ position: "absolute", left: "-9999px", width: 1, height: 1, opacity: 0 }}
      />

      <button className={styles.submit} type="submit" disabled={busy}>
        {busy ? "Versturen…" : "Demo aanvragen →"}
      </button>

      {state === "error" && errorMsg && (
        <p className={styles.error}>{errorMsg}</p>
      )}

      <p className={styles.finePrint}>
        Door te versturen ga je akkoord met ons{" "}
        <a href="/privacy" style={{ color: "#5BA4F5" }}>Privacybeleid</a>
      </p>

      <p className={styles.finePrint}>
        Geen creditcard nodig · Je demolink is binnen een minuut in je inbox
      </p>
    </form>
  );
}
