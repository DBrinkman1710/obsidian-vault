"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import styles from "./custom.module.css";
import {
  TEAM_SIZES,
  INDUSTRIES,
  TOOLS,
  PAIN_POINTS,
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
  { key: "ai",          recName: "AI",               icon: "✦",  price: MODULE_PRICES.ai,          desc: "AI scans every message and drafts the ticket. One click to approve." },
  { key: "tickets",     recName: "Tickets",          icon: "🎫", price: MODULE_PRICES.tickets,     desc: "Track, assign, and close requests with SLA alerts" },
  { key: "chat",        recName: "Live Chat",        icon: "💬", price: MODULE_PRICES.chat,        desc: "Web chat + WhatsApp. All conversations in one inbox." },
  { key: "calendar",    recName: "Calendar",         icon: "📅", price: MODULE_PRICES.calendar,    desc: "Booking links, availability grids, appointments" },
  { key: "kanban",      recName: "Pipeline",         icon: "📌", price: MODULE_PRICES.kanban,      desc: "Drag-and-drop Kanban to move leads through stages" },
  { key: "marketing",   recName: "Marketing",        icon: "📣", price: MODULE_PRICES.marketing,   desc: "Email campaigns, drip sequences, shared reply templates" },
  { key: "departments", recName: "Departments",      icon: "🏢", price: MODULE_PRICES.departments, desc: "Route tickets to the right team automatically" },
  { key: "billing",     recName: "Billing",          icon: "🧾", price: MODULE_PRICES.billing,     desc: "Invoices, payments, subscription management" },
  { key: "tracking",    recName: "Shipment Tracking",icon: "📦", price: MODULE_PRICES.tracking,   desc: "Live carrier updates for DHL, UPS, PostNL, and FedEx, linked to contacts." },
  { key: "sales",       recName: "Sales",            icon: "📈", price: MODULE_PRICES.sales,       desc: "Track product views, add-to-cart, and purchases. Spot high-intent buyers." },
  { key: "saas",        recName: "SaaS Analytics",     icon: "🔁", price: MODULE_PRICES.saas,        desc: "Recurring subscriptions, MRR and churn tracking, linked to contacts" },
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
  "SaaS Analytics":     "saas",
};

type FormState = "idle" | "submitting" | "success" | "error";

export default function CustomForm() {
  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Step 1 state
  const [teamSize, setTeamSize] = useState("");
  const [industry, setIndustry] = useState("");
  const [painPoints, setPainPoints] = useState<string[]>([]);
  const [currentTools, setCurrentTools] = useState<string[]>([]);

  // Step 2 state
  const [annual, setAnnual] = useState(false);
  const [recommendedNames, setRecommendedNames] = useState<string[]>([]);
  const [recommendedKeys, setRecommendedKeys] = useState<ModuleKey[]>([]);
  const [selectedModules, setSelectedModules] = useState<ModuleKey[]>([]);

  const searchParams = useSearchParams();
  const isFounder = searchParams.get("plan") === "founder";

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
    if (isFounder) return PLAN_LIMITS.founder;
    if (recommendedPlanKey === "enterprise") return null;
    return PLAN_LIMITS[recommendedPlanKey];
  }, [isFounder, recommendedPlanKey]);

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

  const founderModulesTotal = useMemo(
    () => selectedModules.reduce((sum, key) => {
      const m = MODULE_CONFIG.find((c) => c.key === key);
      return sum + Math.round((m?.price ?? 0) * 0.5);
    }, 0),
    [selectedModules],
  );

  // Plan price already encodes the annual discount via priceAnnual/12;
  // apply 10% only to modules to avoid double-discounting the plan.
  // Founders pay half module price; the annual 10% stacks on top of that.
  const modulesBaseTotal = isFounder ? founderModulesTotal : modulesRawTotal;

  const displayMonthlyTotal = useMemo(
    () => annual
      ? (planMonthlyDisplay ?? 0) + Math.round(modulesBaseTotal * 0.9)
      : (planMonthlyDisplay ?? 0) + modulesBaseTotal,
    [annual, planMonthlyDisplay, modulesBaseTotal],
  );

  const modulesSaving = useMemo(
    () => annual ? modulesBaseTotal - Math.round(modulesBaseTotal * 0.9) : 0,
    [annual, modulesBaseTotal],
  );

  function togglePainPoint(v: string) {
    if (painPoints.includes(v)) {
      setPainPoints(painPoints.filter((p) => p !== v));
    } else {
      setPainPoints([...painPoints, v]);
    }
  }

  function toggleTool(v: string) {
    if (currentTools.includes(v)) {
      setCurrentTools(currentTools.filter((t) => t !== v));
    } else {
      setCurrentTools([...currentTools, v]);
    }
  }

  function toggleModule(key: ModuleKey) {
    setSelectedModules((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key],
    );
  }

  function goToStep2() {
    const recs = computeRecommendations(industry, currentTools, painPoints);
    const preSelected = recs
      .map((r) => REC_TO_KEY[r])
      .filter((k): k is ModuleKey => !!k);
    setRecommendedNames(recs);
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
            current_tools: currentTools.length ? currentTools : null,
            pain_points: painPoints.length ? painPoints : null,
            recommended_modules: recommendedNames.length ? recommendedNames : null,
            plan_selected: isFounder ? "founder" : recommendedPlanKey,
            modules_selected: selectedModules.length ? selectedModules : null,
            monthly_total: (isFounder || recommendedPlanKey !== "enterprise") ? displayMonthlyTotal : null,
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
      setErrorMsg("Network error. Please check your connection and try again.");
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
        {isFounder && (
          <div className={styles.founderBanner}>
            <span className={styles.founderBadge}>Founding Member</span>
            €9/mo for up to 10 users · 50% off all add-on modules
          </div>
        )}
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
          <span className={styles.qLabel}>Biggest pain points?</span>
          <div className={styles.chips}>
            {PAIN_POINTS.map((opt) => {
              const selected = painPoints.includes(opt);
              return (
                <button
                  key={opt}
                  type="button"
                  className={`${styles.chip} ${selected ? styles.chipActive : ""}`}
                  onClick={() => togglePainPoint(opt)}
                >
                  {opt}
                </button>
              );
            })}
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
                onClick={() => toggleTool(opt)}
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
    const isEnterprise = !isFounder && recommendedPlanKey === "enterprise";

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
          {isFounder ? (
            <>
              <p className={styles.planLabel}>Your plan</p>
              <div className={styles.planRow}>
                <span className={styles.planName}>Founding Member</span>
                <span>
                  <span className={styles.planPrice}>€{planMonthlyDisplay}</span>
                  <span className={styles.planPricePer}>/mo</span>
                </span>
              </div>
              <p className={styles.planMeta}>
                Up to 10 users · 50% off all add-on modules{annual && " · billed annually"}
              </p>
            </>
          ) : (
            <>
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
            </>
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
                    <span className={styles.moduleRowPrice}>€{isFounder ? Math.round(mod.price * 0.5) : mod.price}/mo</span>
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
  const isEnterprise = !isFounder && recommendedPlanKey === "enterprise";

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
            <span className={styles.summaryLineName}>{isFounder ? "Founding Member" : PLAN_NAMES[recommendedPlanKey]} plan</span>
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
              <span className={styles.summaryLinePrice}>€{isFounder ? Math.round(m.price * 0.5) : m.price}/mo</span>
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
