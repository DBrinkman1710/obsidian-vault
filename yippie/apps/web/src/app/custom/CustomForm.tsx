"use client";

import { useMemo, useState } from "react";
import styles from "./custom.module.css";
import {
  TEAM_SIZES,
  INDUSTRIES,
  TOOLS,
  PAIN_POINTS,
  MAX_PAIN_POINTS,
  computeRecommendations,
} from "../../lib/recommendations";
import { PLAN_LIMITS, MODULE_PRICES } from "../../lib/config";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.getyippie.com";
const TALK_PATH = `${APP_URL}/meet/default`;

type PlanKey = "starter" | "growth" | "pro" | "enterprise";

const PLANS_BY_RANK: PlanKey[] = ["starter", "growth", "pro", "enterprise"];

const PLAN_NAMES: Record<PlanKey, string> = {
  starter: "Starter",
  growth: "Growth",
  pro: "Pro",
  enterprise: "Enterprise",
};

const MODULE_CONFIG = [
  { key: "ai",          recName: "AI",               icon: "✦",  price: MODULE_PRICES.ai,          desc: "AI scans every message and drafts the ticket — one-click approve" },
  { key: "tickets",     recName: "Tickets",          icon: "🎫", price: MODULE_PRICES.tickets,     desc: "Track, assign, and close requests with SLA alerts" },
  { key: "chat",        recName: "Live Chat",        icon: "💬", price: MODULE_PRICES.chat,        desc: "Web chat + WhatsApp — all conversations in one inbox" },
  { key: "calendar",    recName: "Calendar",         icon: "📅", price: MODULE_PRICES.calendar,    desc: "Booking links, availability grids, appointments" },
  { key: "kanban",      recName: "Pipeline",         icon: "📌", price: MODULE_PRICES.kanban,      desc: "Drag-and-drop Kanban to move leads through stages" },
  { key: "marketing",   recName: "Marketing",        icon: "📣", price: MODULE_PRICES.marketing,   desc: "Email campaigns, drip sequences, open tracking" },
  { key: "departments", recName: "Departments",      icon: "🏢", price: MODULE_PRICES.departments, desc: "Route tickets to the right team automatically" },
  { key: "billing",     recName: "Billing",          icon: "🧾", price: MODULE_PRICES.billing,     desc: "Invoices, payments, subscription management" },
  { key: "tracking",    recName: "Shipment Tracking",icon: "📦", price: MODULE_PRICES.tracking,   desc: "DHL, UPS, PostNL, FedEx — live carrier updates linked to contacts" },
  { key: "sales",       recName: "Sales",            icon: "📈", price: MODULE_PRICES.sales,       desc: "Track product views, add-to-cart, purchases — spot high-intent buyers" },
  { key: "saas",        recName: "SaaS Billing",     icon: "🔁", price: MODULE_PRICES.saas,        desc: "Recurring subscriptions, MRR and churn tracking, linked to contacts" },
] as const;

type ModuleKey = (typeof MODULE_CONFIG)[number]["key"];

const REC_TO_KEY: Record<string, ModuleKey | undefined> = {
  "AI Inbox":         "ai",
  "Tickets":          "tickets",
  "Live Chat":        "chat",
  "Calendar":         "calendar",
  "Pipeline":         "kanban",
  "Marketing":        "marketing",
  "Departments":      "departments",
  "Billing":          "billing",
  "Shipment Tracking":"tracking",
  "Sales":            "sales",
  "SaaS Billing":     "saas",
};

type FormState = "idle" | "submitting" | "success" | "error";

export default function CustomForm() {
  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Step 1 state
  const [teamSize, setTeamSize] = useState("");
  const [industry, setIndustry] = useState("");
  const [challenges, setChallenges] = useState<string[]>([]);
  const [currentTool, setCurrentTool] = useState("");

  // Step 2 state
  const [annual, setAnnual] = useState(false);
  const [recommendedKeys, setRecommendedKeys] = useState<ModuleKey[]>([]);
  const [selectedModules, setSelectedModules] = useState<ModuleKey[]>([]);

  // Step 3 state
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [email, setEmail] = useState("");
  const [formState, setFormState] = useState<FormState>("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const recommendedPlanKey = useMemo<PlanKey>(() => {
    const idx = TEAM_SIZES.indexOf(teamSize);
    if (idx < 0) return "growth";
    return PLANS_BY_RANK[Math.min(idx, 3)] ?? "growth";
  }, [teamSize]);

  const planLimits = useMemo(() => {
    if (recommendedPlanKey === "enterprise") return null;
    return PLAN_LIMITS[recommendedPlanKey];
  }, [recommendedPlanKey]);

  const planMonthlyDisplay = useMemo(() => {
    if (!planLimits) return null;
    if (annual) return Math.round(planLimits.priceAnnual / 12);
    return planLimits.priceMonthly;
  }, [planLimits, annual]);

  const modulesRawTotal = useMemo(
    () => selectedModules.reduce((sum, key) => {
      const m = MODULE_CONFIG.find((c) => c.key === key);
      return sum + (m?.price ?? 0);
    }, 0),
    [selectedModules],
  );

  // Plan price already encodes the annual discount via priceAnnual/12;
  // apply 10% only to modules to avoid double-discounting the plan.
  const displayMonthlyTotal = useMemo(
    () => annual
      ? (planMonthlyDisplay ?? 0) + Math.round(modulesRawTotal * 0.9)
      : (planMonthlyDisplay ?? 0) + modulesRawTotal,
    [annual, planMonthlyDisplay, modulesRawTotal],
  );

  const modulesSaving = useMemo(
    () => annual ? modulesRawTotal - Math.round(modulesRawTotal * 0.9) : 0,
    [annual, modulesRawTotal],
  );

  function toggleChallenge(v: string) {
    if (challenges.includes(v)) {
      setChallenges(challenges.filter((c) => c !== v));
    } else {
      if (challenges.length >= MAX_PAIN_POINTS) return;
      setChallenges([...challenges, v]);
    }
  }

  function toggleModule(key: ModuleKey) {
    setSelectedModules((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key],
    );
  }

  function goToStep2() {
    const recs = computeRecommendations(
      industry,
      currentTool ? [currentTool] : [],
      challenges,
    );
    const preSelected = recs
      .map((r) => REC_TO_KEY[r])
      .filter((k): k is ModuleKey => !!k);
    setRecommendedKeys(preSelected);
    setSelectedModules(preSelected);
    setStep(2);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFormState("submitting");
    setErrorMsg("");

    try {
      const res = await fetch("/api/custom-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          company_name: company,
          email,
          questionnaire: {
            team_size: teamSize || null,
            industry: industry || null,
            challenges: challenges.length ? challenges : null,
            current_tool: currentTool || null,
            plan_selected: recommendedPlanKey,
            modules_selected: selectedModules.length ? selectedModules : null,
            monthly_total: recommendedPlanKey !== "enterprise" ? displayMonthlyTotal : null,
            billing_cycle: annual ? "annual" : "monthly",
          },
        }),
      });

      if (res.ok) {
        setFormState("success");
        return;
      }

      const data = await res.json().catch(() => ({}));
      setErrorMsg(
        typeof data?.error === "string"
          ? data.error
          : "Something went wrong. Please try again.",
      );
      setFormState("error");
    } catch {
      setErrorMsg("Network error — please check your connection and try again.");
      setFormState("error");
    }
  }

  // ── Success ──────────────────────────────────────────────
  if (formState === "success") {
    return (
      <div className={styles.card}>
        <div className={styles.success}>
          <div className={styles.successIcon}>✓</div>
          <h2 className={styles.successTitle}>Quote request sent</h2>
          <p className={styles.successSub}>
            We&apos;ll be in touch within 1 business day with your personalised
            package proposal. Want to talk sooner?
          </p>
          <a href={TALK_PATH} target="_blank" rel="noopener noreferrer" className={styles.successBookCall}>
            Book a call →
          </a>
        </div>
      </div>
    );
  }

  const busy = formState === "submitting";

  // ── Step 1 — Team profile ────────────────────────────────
  if (step === 1) {
    return (
      <div className={styles.card}>
        <div className={styles.steps}>
          <span className={`${styles.stepDot} ${styles.stepDotActive}`}>1</span>
          <span className={styles.stepLine} />
          <span className={styles.stepDot}>2</span>
          <span className={styles.stepLine} />
          <span className={styles.stepDot}>3</span>
        </div>
        <p className={styles.stepHint}>
          A few quick questions so we can build the right package for you.
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
          <span className={styles.qLabel}>
            Biggest challenges?{" "}
            <span className={styles.qHint}>pick up to {MAX_PAIN_POINTS}</span>
          </span>
          <div className={styles.chips}>
            {PAIN_POINTS.map((opt) => {
              const selected = challenges.includes(opt);
              const disabled = !selected && challenges.length >= MAX_PAIN_POINTS;
              return (
                <button
                  key={opt}
                  type="button"
                  className={`${styles.chip} ${selected ? styles.chipActive : ""}`}
                  onClick={() => toggleChallenge(opt)}
                  disabled={disabled}
                >
                  {opt}
                </button>
              );
            })}
          </div>
        </div>

        <div className={styles.question}>
          <span className={styles.qLabel}>What do you use today?</span>
          <div className={styles.chips}>
            {TOOLS.map((opt) => (
              <button
                key={opt}
                type="button"
                className={`${styles.chip} ${currentTool === opt ? styles.chipActive : ""}`}
                onClick={() => setCurrentTool(currentTool === opt ? "" : opt)}
              >
                {opt}
              </button>
            ))}
          </div>
        </div>

        <button className={styles.submit} type="button" onClick={goToStep2}>
          Build my package →
        </button>
      </div>
    );
  }

  // ── Step 2 — Recommended package ────────────────────────
  if (step === 2) {
    const recMods = MODULE_CONFIG.filter((m) => recommendedKeys.includes(m.key as ModuleKey));
    const extraMods = MODULE_CONFIG.filter((m) => !recommendedKeys.includes(m.key as ModuleKey));
    const isEnterprise = recommendedPlanKey === "enterprise";

    return (
      <div className={styles.card}>
        <div className={styles.steps}>
          <button
            type="button"
            className={`${styles.stepDot} ${styles.stepDotDone}`}
            onClick={() => setStep(1)}
            aria-label="Back to profile"
          >
            1
          </button>
          <span className={`${styles.stepLine} ${styles.stepLineActive}`} />
          <span className={`${styles.stepDot} ${styles.stepDotActive}`}>2</span>
          <span className={styles.stepLine} />
          <span className={styles.stepDot}>3</span>
        </div>

        {/* Billing toggle */}
        <div className={styles.billingToggle}>
          <button
            type="button"
            className={`${styles.billingBtn} ${!annual ? styles.billingBtnActive : ""}`}
            onClick={() => setAnnual(false)}
          >
            Monthly
          </button>
          <button
            type="button"
            className={`${styles.billingBtn} ${annual ? styles.billingBtnActive : ""}`}
            onClick={() => setAnnual(true)}
          >
            Annual <span className={styles.annualBadge}>–10%</span>
          </button>
        </div>

        {/* Plan tile */}
        <div className={styles.planTile}>
          <p className={styles.planLabel}>Recommended plan for your team</p>
          <div className={styles.planRow}>
            <span className={styles.planName}>{PLAN_NAMES[recommendedPlanKey]}</span>
            {isEnterprise ? (
              <span className={styles.planEnterprise}>Custom pricing</span>
            ) : (
              <span>
                <span className={styles.planPrice}>€{planMonthlyDisplay}</span>
                <span className={styles.planPricePer}>/mo</span>
              </span>
            )}
          </div>
          {planLimits && (
            <p className={styles.planMeta}>
              {planLimits.users} users · {(planLimits.aiScans ?? 0).toLocaleString()} AI scans/mo
              {annual && " · billed annually"}
            </p>
          )}
          {isEnterprise && (
            <p className={styles.planMeta}>Unlimited users · unlimited AI scans</p>
          )}
        </div>

        {/* Recommended modules */}
        <div className={styles.moduleSection}>
          <div className={styles.moduleSectionHeader}>
            <span className={styles.moduleSectionLabel}>Recommended for you</span>
            <span className={styles.moduleSectionHint}>based on your answers</span>
          </div>
          <div className={styles.moduleList}>
            {recMods.map((mod) => {
              const active = selectedModules.includes(mod.key as ModuleKey);
              return (
                <button
                  key={mod.key}
                  type="button"
                  className={`${styles.moduleRow} ${active ? styles.moduleRowActive : styles.moduleRowDeselected}`}
                  onClick={() => toggleModule(mod.key as ModuleKey)}
                >
                  <div className={styles.moduleRowLeft}>
                    <span className={styles.moduleRowIcon}>{mod.icon}</span>
                    <span className={styles.moduleRowInfo}>
                      <span className={styles.moduleRowName}>{mod.recName}</span>
                      <span className={styles.moduleRowDesc}>{mod.desc}</span>
                    </span>
                  </div>
                  <div className={styles.moduleRowRight}>
                    <span className={styles.moduleRowPrice}>€{mod.price}/mo</span>
                    <span className={active ? styles.moduleTagIncluded : styles.moduleTagAddBack}>
                      {active ? "✓ Included" : "+ Add back"}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Extra modules */}
        {extraMods.length > 0 && (
          <div className={styles.moduleSection}>
            <div className={styles.moduleSectionHeader}>
              <span className={styles.moduleSectionLabel}>Add more modules</span>
            </div>
            <div className={styles.moduleList}>
              {extraMods.map((mod) => {
                const active = selectedModules.includes(mod.key as ModuleKey);
                return (
                  <button
                    key={mod.key}
                    type="button"
                    className={`${styles.moduleRow} ${active ? styles.moduleRowActive : ""}`}
                    onClick={() => toggleModule(mod.key as ModuleKey)}
                  >
                    <div className={styles.moduleRowLeft}>
                      <span className={styles.moduleRowIcon}>{mod.icon}</span>
                      <span className={styles.moduleRowInfo}>
                        <span className={styles.moduleRowName}>{mod.recName}</span>
                        <span className={styles.moduleRowDesc}>{mod.desc}</span>
                      </span>
                    </div>
                    <div className={styles.moduleRowRight}>
                      <span className={styles.moduleRowPrice}>€{mod.price}/mo</span>
                      <span className={active ? styles.moduleTagIncluded : styles.moduleTagAdd}>
                        {active ? "✓ Included" : "+ Add"}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Total */}
        <div className={styles.totalBar}>
          <div className={styles.totalBarLeft}>
            <span className={styles.totalLabel}>
              {isEnterprise
                ? "Enterprise plan + " + selectedModules.length + " module" + (selectedModules.length !== 1 ? "s" : "")
                : PLAN_NAMES[recommendedPlanKey] + " plan"
                  + (selectedModules.length > 0
                    ? " + " + selectedModules.length + " module" + (selectedModules.length !== 1 ? "s" : "")
                    : "")}
            </span>
            {annual && modulesSaving > 0 && (
              <span className={styles.totalSaving}>saving €{modulesSaving}/mo on add-ons</span>
            )}
          </div>
          {isEnterprise ? (
            <span className={styles.totalCustom}>Let&apos;s talk</span>
          ) : (
            <span className={styles.totalAmount}>
              €{displayMonthlyTotal}<span className={styles.totalAmountSub}>/mo</span>
            </span>
          )}
        </div>

        <div className={styles.navRow}>
          <button type="button" className={styles.backBtn} onClick={() => setStep(1)}>
            ← Back
          </button>
          <button
            className={styles.submit}
            type="button"
            onClick={() => setStep(3)}
            style={{ flex: 1 }}
          >
            Get my quote →
          </button>
        </div>
      </div>
    );
  }

  // ── Step 3 — Contact + summary ───────────────────────────
  const selectedModuleDetails = MODULE_CONFIG.filter((m) =>
    selectedModules.includes(m.key as ModuleKey),
  );
  const isEnterprise = recommendedPlanKey === "enterprise";

  return (
    <form className={styles.card} onSubmit={handleSubmit} noValidate>
      <div className={styles.steps}>
        <button
          type="button"
          className={`${styles.stepDot} ${styles.stepDotDone}`}
          onClick={() => setStep(1)}
          aria-label="Back to profile"
        >
          1
        </button>
        <span className={`${styles.stepLine} ${styles.stepLineActive}`} />
        <button
          type="button"
          className={`${styles.stepDot} ${styles.stepDotDone}`}
          onClick={() => setStep(2)}
          aria-label="Back to package"
        >
          2
        </button>
        <span className={`${styles.stepLine} ${styles.stepLineActive}`} />
        <span className={`${styles.stepDot} ${styles.stepDotActive}`}>3</span>
      </div>

      {/* Package summary */}
      <div className={styles.summaryCard}>
        <p className={styles.summaryTitle}>Your package</p>
        <div className={styles.summaryLines}>
          <div className={styles.summaryLine}>
            <span className={styles.summaryLineName}>{PLAN_NAMES[recommendedPlanKey]} plan</span>
            {!isEnterprise && planMonthlyDisplay !== null ? (
              <span className={styles.summaryLinePrice}>€{planMonthlyDisplay}/mo</span>
            ) : (
              <span className={styles.summaryLinePrice}>Custom</span>
            )}
          </div>
          {selectedModuleDetails.map((m) => (
            <div key={m.key} className={styles.summaryLine}>
              <span className={styles.summaryLineName}>
                <span className={styles.summaryLineIcon}>{m.icon}</span>
                {m.recName}
              </span>
              <span className={styles.summaryLinePrice}>€{m.price}/mo</span>
            </div>
          ))}
          {annual && modulesSaving > 0 && (
            <div className={styles.summaryLine}>
              <span className={styles.summaryLineSaving}>Annual discount (add-ons)</span>
              <span className={styles.summaryLineSavingPrice}>−€{modulesSaving}/mo</span>
            </div>
          )}
        </div>
        <div className={styles.summaryDivider} />
        <div className={styles.summaryTotal}>
          <span className={styles.summaryTotalLabel}>
            {annual ? "Total/mo (billed annually)" : "Total/mo"}
          </span>
          {isEnterprise ? (
            <span className={styles.summaryTotalCustom}>Let&apos;s talk</span>
          ) : (
            <span>
              <span className={styles.summaryTotalPrice}>€{displayMonthlyTotal}</span>
              <span className={styles.summaryTotalPer}>/mo</span>
            </span>
          )}
        </div>
      </div>

      <div className={styles.fieldGroup}>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="custom-name">Your name</label>
          <input
            id="custom-name"
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
          <label className={styles.label} htmlFor="custom-company">Company name</label>
          <input
            id="custom-company"
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
          <label className={styles.label} htmlFor="custom-email">Work email</label>
          <input
            id="custom-email"
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
        {busy ? "Sending…" : "Send my quote →"}
      </button>

      {formState === "error" && errorMsg && (
        <p className={styles.error}>{errorMsg}</p>
      )}

      <div className={styles.orDivider}>or</div>

      <a href={TALK_PATH} target="_blank" rel="noopener noreferrer" className={styles.bookCall}>
        Prefer to talk first? Book a call →
      </a>

      <p className={styles.finePrint}>
        No credit card required · We reply within 1 business day
      </p>
    </form>
  );
}
