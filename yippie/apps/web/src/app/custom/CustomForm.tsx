"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
import MiniYippie from "../components/MiniYippie";
import {
  AiIcon,
  TicketIcon,
  ChatIcon,
  CalendarIcon,
  KanbanIcon,
  MailTrackIcon,
  TeamIcon,
  BillingIcon,
  ContractIcon,
  TrackingIcon,
  SalesIcon,
  SaasIcon,
} from "../components/icons";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.getyippie.com";
// Booking page of the Yippie owner tenant (backend resolves the tenant by slug).
const TALK_PATH = `${APP_URL}/meet/yippie`;

type PlanKey = "starter" | "growth" | "pro" | "enterprise";

const PLANS_BY_RANK: PlanKey[] = ["starter", "growth", "pro", "enterprise"];

const PLAN_NAMES: Record<PlanKey, string> = {
  starter: "Starter",
  growth: "Growth",
  pro: "Pro",
  enterprise: "Enterprise",
};

const MODULE_CONFIG = [
  { key: "ai",          recName: "AI Inbox",         Icon: AiIcon,        price: MODULE_PRICES.ai,          desc: "AI scans every message and drafts the ticket. One click to approve." },
  { key: "tickets",     recName: "Tickets",          Icon: TicketIcon,    price: MODULE_PRICES.tickets,     desc: "Track, assign, and close requests with SLA alerts" },
  { key: "chat",        recName: "Live Chat",        Icon: ChatIcon,      price: MODULE_PRICES.chat,        desc: "Web chat + WhatsApp. All conversations in one inbox." },
  { key: "calendar",    recName: "Calendar",         Icon: CalendarIcon,  price: MODULE_PRICES.calendar,    desc: "Booking links, availability grids, appointments" },
  { key: "pipeline",    recName: "Pipeline",         Icon: KanbanIcon,    price: MODULE_PRICES.pipeline,    desc: "Drag-and-drop Kanban to move leads through stages" },
  { key: "marketing",   recName: "Marketing",        Icon: MailTrackIcon, price: MODULE_PRICES.marketing,   desc: "Email campaigns, drip sequences, shared reply templates" },
  { key: "departments", recName: "Departments",      Icon: TeamIcon,      price: MODULE_PRICES.departments, desc: "Route tickets to the right team automatically" },
  { key: "billing",     recName: "Billing",          Icon: BillingIcon,   price: MODULE_PRICES.billing,     desc: "Invoices, payments, subscription management" },
  { key: "contracts",   recName: "Contracts",        Icon: ContractIcon,  price: MODULE_PRICES.contracts,   desc: "Store signed contracts, track renewals and notice periods, get reminded in time" },
  { key: "tracking",    recName: "Shipment Tracking",Icon: TrackingIcon,  price: MODULE_PRICES.tracking,   desc: "Live carrier updates for DHL, UPS, PostNL, and FedEx, linked to contacts." },
  { key: "sales",       recName: "Sales",            Icon: SalesIcon,     price: MODULE_PRICES.sales,       desc: "Track product views, add-to-cart, and purchases. Spot high-intent buyers." },
  { key: "saas",        recName: "SaaS Analytics",   Icon: SaasIcon,      price: MODULE_PRICES.saas,        desc: "Recurring subscriptions, MRR and churn tracking, linked to contacts" },
] as const;

/* Sidebar colour swatches for the mini workspace — Yippie blue first (smart default). */
const BRAND_COLORS = [
  "#5BA4F5", // Yippie blue
  "#0F766E", // teal
  "#7C3AED", // violet
  "#DB2777", // pink
  "#DC2626", // red
  "#EA580C", // orange
  "#16A34A", // green
  "#0F172A", // ink
] as const;

type ModuleKey = (typeof MODULE_CONFIG)[number]["key"];

const REC_TO_KEY: Record<string, ModuleKey | undefined> = {
  "AI Inbox":         "ai",
  "Tickets":          "tickets",
  "Live Chat":        "chat",
  "Calendar":         "calendar",
  "Pipeline":         "pipeline",
  "Marketing":        "marketing",
  "Departments":      "departments",
  "Billing":          "billing",
  "Contracts":        "contracts",
  "Shipment Tracking":"tracking",
  "Sales":            "sales",
  "SaaS Analytics":     "saas",
};

type FormState = "idle" | "submitting" | "success" | "error";

/* Everything the visitor fills in is kept in localStorage so a remount,
   refresh, or coming back later never asks them to reselect. */
const STORAGE_KEY = "yippie_custom_plan";

/* Demo → trial conversion emails link /signup?token=<jwt>. The payload is
   readable without verification (prefill only — the backend re-verifies). */
function decodeToken(token: string): { company_name?: string; questionnaire?: Record<string, unknown> } | null {
  try {
    const payload = token.split(".")[1];
    if (!payload) return null;
    return JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/")));
  } catch {
    return null;
  }
}

/* Endowed progress (ux-habits): never show 0% — arriving with a recommended
   setup already counts. The bar only moves forward. */
const STEP_PROGRESS: Record<number, number> = { 1: 30, 2: 60, 3: 85 };

export default function CustomForm() {
  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Personalisation state — drives the live mini workspace preview
  const [brandColor, setBrandColor] = useState<string>(BRAND_COLORS[0]);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);

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
  // Smart default (ux-habits): the recommendation preselects the plan; the
  // visitor can override it in the plan picker on step 2.
  const [pickedPlan, setPickedPlan] = useState<PlanKey | null>(null);

  const searchParams = useSearchParams();
  const isFounder = searchParams.get("plan") === "founder";

  // Demo → trial conversion: outreach emails carry a signed token that prefill
  // the company + questionnaire and travels along to the signup API.
  const fromDemoToken = searchParams.get("token") ?? "";
  const tokenData = useMemo(() => (fromDemoToken ? decodeToken(fromDemoToken) : null), [fromDemoToken]);

  // Step 3 state
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  // Honeypot — real visitors never see or fill this field.
  const [website, setWebsite] = useState("");
  const [formState, setFormState] = useState<FormState>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  // Success flavours: trial signups get an entry-link mail; older backends
  // return a login URL instead; enterprise sends a tailored quote.
  const [successKind, setSuccessKind] = useState<"entry_mail" | "login" | "quote">("entry_mail");
  const [loginUrl, setLoginUrl] = useState("");

  // Only preseed the module selection from recommendations once — after that
  // the visitor's own package survives going back and forth between steps.
  const seededRef = useRef(false);
  const hydratedRef = useRef(false);

  // Restore everything the visitor already filled in (survives remounts).
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const s = JSON.parse(raw);
        if (typeof s.brandColor === "string") setBrandColor(s.brandColor);
        if (typeof s.logoUrl === "string") setLogoUrl(s.logoUrl);
        if (typeof s.teamSize === "string") setTeamSize(s.teamSize);
        if (typeof s.industry === "string") setIndustry(s.industry);
        if (Array.isArray(s.painPoints)) setPainPoints(s.painPoints);
        if (Array.isArray(s.currentTools)) setCurrentTools(s.currentTools);
        if (Array.isArray(s.recommendedNames)) setRecommendedNames(s.recommendedNames);
        if (Array.isArray(s.recommendedKeys)) setRecommendedKeys(s.recommendedKeys);
        if (Array.isArray(s.selectedModules) && s.selectedModules.length > 0) {
          setSelectedModules(s.selectedModules);
          seededRef.current = true;
        }
        if (typeof s.annual === "boolean") setAnnual(s.annual);
        if (typeof s.pickedPlan === "string" && PLANS_BY_RANK.includes(s.pickedPlan)) setPickedPlan(s.pickedPlan);
        if (typeof s.name === "string") setName(s.name);
        if (typeof s.company === "string") setCompany(s.company);
        if (typeof s.email === "string") setEmail(s.email);
      }
    } catch { /* corrupt or unavailable storage — start fresh */ }
    // Demo-token prefill wins over the stored snapshot (runs once, after it).
    if (tokenData) {
      if (typeof tokenData.company_name === "string") setCompany(tokenData.company_name);
      const q = tokenData.questionnaire as Record<string, unknown> | undefined;
      if (q) {
        if (typeof q.team_size === "string") setTeamSize(q.team_size);
        if (typeof q.industry === "string") setIndustry(q.industry);
        if (Array.isArray(q.current_tools)) setCurrentTools(q.current_tools as string[]);
        if (Array.isArray(q.pain_points)) setPainPoints(q.pain_points as string[]);
      }
    }
    hydratedRef.current = true;
  }, []);

  // Persist on every change (after the initial hydration pass).
  useEffect(() => {
    if (!hydratedRef.current) return;
    const snapshot = {
      brandColor, logoUrl, teamSize, industry, painPoints, currentTools,
      recommendedNames, recommendedKeys, selectedModules, annual, pickedPlan, name, company, email,
    };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
    } catch {
      // Quota exceeded (large logo) — persist everything except the logo.
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...snapshot, logoUrl: null }));
      } catch { /* storage unavailable */ }
    }
  }, [brandColor, logoUrl, teamSize, industry, painPoints, currentTools,
      recommendedNames, recommendedKeys, selectedModules, annual, pickedPlan, name, company, email]);

  const recommendedPlanKey = useMemo<PlanKey>(() => {
    const idx = TEAM_SIZES.indexOf(teamSize);
    if (idx < 0) return "growth";
    return PLANS_BY_RANK[Math.min(idx, 3)] ?? "growth";
  }, [teamSize]);

  // The plan that actually applies: the visitor's own pick, falling back to
  // the recommendation (smart default).
  const planKey: PlanKey = pickedPlan ?? recommendedPlanKey;

  const planLimits = useMemo(() => {
    if (isFounder) return PLAN_LIMITS.founder;
    if (planKey === "enterprise") return null;
    return PLAN_LIMITS[planKey];
  }, [isFounder, planKey]);

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

  function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    // Data URL instead of an object URL: survives remounts, persists in
    // localStorage, and travels in the quote payload for environment setup.
    const reader = new FileReader();
    reader.onload = () => {
      setLogoUrl(typeof reader.result === "string" ? reader.result : null);
    };
    reader.readAsDataURL(file);
    e.target.value = ""; // allow re-uploading the same file
  }

  function removeLogo() {
    setLogoUrl(null);
  }

  function goToStep2() {
    const recs = computeRecommendations(industry, currentTools, painPoints);
    const preSelected = recs
      .map((r) => REC_TO_KEY[r])
      .filter((k): k is ModuleKey => !!k);
    setRecommendedNames(recs);
    setRecommendedKeys(preSelected);
    // Seed from recommendations only the first time — a visitor who already
    // built a package keeps their own selection when moving between steps.
    if (!seededRef.current) {
      setSelectedModules(preSelected);
      seededRef.current = true;
    }
    setStep(2);
  }

  // Shared questionnaire payload — the lead/quote endpoints and the signup
  // endpoint carry the same shape (branding included, [WEB-LOGO-CARRY]).
  function questionnairePayload() {
    return {
      team_size: teamSize || null,
      industry: industry || null,
      current_tools: currentTools.length ? currentTools : null,
      pain_points: painPoints.length ? painPoints : null,
      recommended_modules: recommendedNames.length ? recommendedNames : null,
      plan_selected: isFounder ? "founder" : planKey,
      modules_selected: selectedModules.length ? selectedModules : null,
      monthly_total: (isFounder || planKey !== "enterprise") ? displayMonthlyTotal : null,
      billing_cycle: annual ? "annual" : "monthly",
      branding_color: brandColor,
      branding_logo: logoUrl,
    };
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrorMsg("");

    const isEnterpriseSubmit = !isFounder && planKey === "enterprise";

    // Enterprise is custom made: no instant workspace — a tailored proposal
    // within 1 business day (plus the book-a-call escape hatch).
    if (isEnterpriseSubmit) {
      setFormState("submitting");
      try {
        const res = await fetch("/api/custom-plan", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name,
            company_name: company,
            email,
            website,
            questionnaire: questionnairePayload(),
          }),
        });
        if (res.ok) {
          setSuccessKind("quote");
          setFormState("success");
          return;
        }
        const data = await res.json().catch(() => ({}));
        setErrorMsg(typeof data?.error === "string" ? data.error : "Something went wrong. Please try again.");
        setFormState("error");
      } catch {
        setErrorMsg("Network error. Please check your connection and try again.");
        setFormState("error");
      }
      return;
    }

    // Self serve trial — validate locally before creating anything.
    if (password.length < 8) {
      setErrorMsg("Please choose a password of at least 8 characters.");
      setFormState("error");
      return;
    }
    if (password !== confirmPassword) {
      setErrorMsg("Passwords do not match.");
      setFormState("error");
      return;
    }
    setFormState("submitting");

    // Lead capture first, best effort — the lead lands in the owner CRM even
    // if workspace creation fails on the next call.
    try {
      void fetch("/api/questionnaire-lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        keepalive: true,
        body: JSON.stringify({
          name: name.trim() || email.split("@")[0],
          email: email.trim(),
          company: company.trim() || email.split("@")[0],
          website,
          questionnaire: questionnairePayload(),
        }),
      });
    } catch { /* lead capture must never block workspace creation */ }

    try {
      const res = await fetch("/api/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          company_name: company.trim(),
          email: email.trim(),
          password,
          website,
          plan: isFounder ? "founder" : planKey,
          enabled_modules: selectedModules,
          questionnaire: questionnairePayload(),
          from_demo_token: fromDemoToken || undefined,
        }),
      });

      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        // Stripe hook: backend returns { payment: { checkout_url } } when live.
        if (data.payment?.checkout_url) {
          window.location.href = data.payment.checkout_url;
          return;
        }
        if (data.verification_required) {
          // New backend: entry link is in the mail — verification IS the login.
          setSuccessKind("entry_mail");
        } else {
          // Older backend: account is live right away, hand them the login.
          setSuccessKind("login");
          setLoginUrl(typeof data.login_url === "string" ? data.login_url : `${APP_URL}/login`);
        }
        setFormState("success");
        return;
      }

      const data = await res.json().catch(() => ({}));
      setErrorMsg(
        typeof data?.error === "string" ? data.error
          : typeof data?.detail === "string" ? data.detail
          : "Something went wrong. Please try again.",
      );
      setFormState("error");
    } catch {
      setErrorMsg("Network error. Please check your connection and try again.");
      setFormState("error");
    }
  }

  // Live preview panel — shown next to every step so the visitor
  // watches their own workspace take shape while they build it.
  const preview = (
    <aside className={styles.previewCol}>
      <p className={styles.previewLabel}>Your workspace — live preview</p>
      <MiniYippie
        brandColor={brandColor}
        logoUrl={logoUrl}
        companyName={company}
        modules={selectedModules}
      />
    </aside>
  );

  // Endowed progress (ux-habits): starts at 30%, never at 0 — the recommended
  // setup the visitor arrives with already counts as momentum.
  const progressPct = formState === "success" ? 100 : STEP_PROGRESS[step] ?? 30;
  const progressBar = (
    <div className={styles.progressWrap}>
      <div className={styles.progressTrack}>
        <div className={styles.progressFill} style={{ width: `${progressPct}%` }} />
      </div>
      <span className={styles.progressLabel}>{progressPct}% there</span>
    </div>
  );

  // ── Success — three flavours ─────────────────────────────
  if (formState === "success") {
    return (
      <div className={styles.layout}>
        <div className={styles.card}>
          {progressBar}
          <div className={styles.success}>
            <div className={styles.successIcon}>✓</div>
            {successKind === "quote" ? (
              <>
                <h2 className={styles.successTitle}>Request sent</h2>
                <p className={styles.successSub}>
                  Enterprise is custom made for you. We&apos;ll send a tailored
                  proposal within 1 business day. Want to talk sooner?
                </p>
                <a href={TALK_PATH} target="_blank" rel="noopener noreferrer" className={styles.successBookCall}>
                  Book a call →
                </a>
              </>
            ) : successKind === "login" ? (
              <>
                <h2 className={styles.successTitle}>Your workspace is ready</h2>
                <p className={styles.successSub}>
                  Your 30 day free trial has started — no payment details needed.
                </p>
                <a href={loginUrl} className={styles.successBookCall}>
                  Log in to your workspace →
                </a>
              </>
            ) : (
              <>
                <h2 className={styles.successTitle}>Check your inbox — your workspace is ready</h2>
                <p className={styles.successSub}>
                  We&apos;ve emailed an entry link to <strong>{email}</strong>.
                  One click and you&apos;re in. First 30 days free, no payment
                  details needed.
                </p>
              </>
            )}
          </div>
        </div>
        {preview}
      </div>
    );
  }

  const busy = formState === "submitting";

  // ── Step 1 — Team profile ────────────────────────────────
  if (step === 1) {
    return (
      <div className={styles.layout}>
      <div className={styles.card}>
        {progressBar}
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
          <span className={styles.qLabel}>
            Make it yours <span className={styles.qHint}>optional</span>
          </span>
          <div className={styles.personalise}>
            <div className={styles.swatches}>
              {BRAND_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-label={`Sidebar colour ${c}`}
                  className={`${styles.swatch} ${brandColor === c ? styles.swatchActive : ""}`}
                  style={{ background: c }}
                  onClick={() => setBrandColor(c)}
                />
              ))}
            </div>
            <div className={styles.logoRow}>
              <label className={styles.logoUpload}>
                <input type="file" accept="image/*" hidden onChange={handleLogoUpload} />
                {logoUrl ? "Change logo" : "Upload your logo"}
              </label>
              {logoUrl && (
                <button type="button" className={styles.logoRemove} onClick={removeLogo}>
                  Remove
                </button>
              )}
            </div>
          </div>
        </div>

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
      {preview}
      </div>
    );
  }

  // ── Step 2 — Recommended package ────────────────────────
  if (step === 2) {
    const recMods = MODULE_CONFIG.filter((m) => recommendedKeys.includes(m.key as ModuleKey));
    const extraMods = MODULE_CONFIG.filter((m) => !recommendedKeys.includes(m.key as ModuleKey));
    const isEnterprise = !isFounder && planKey === "enterprise";

    return (
      <div className={styles.layout}>
      <div className={styles.card}>
        {progressBar}
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
              <p className={styles.planLabel}>Pick your plan</p>
              <div className={styles.planOptions}>
                {PLANS_BY_RANK.map((k) => {
                  const lims = k === "enterprise" ? null : PLAN_LIMITS[k];
                  const active = planKey === k;
                  return (
                    <button
                      key={k}
                      type="button"
                      className={`${styles.planOption} ${active ? styles.planOptionActive : ""}`}
                      onClick={() => setPickedPlan(k)}
                    >
                      <span className={styles.planOptionName}>{PLAN_NAMES[k]}</span>
                      <span className={styles.planOptionPrice}>
                        {lims ? `€${annual ? Math.round(lims.priceAnnual / 12) : lims.priceMonthly}/mo` : "Custom"}
                      </span>
                      {recommendedPlanKey === k && (
                        <span className={styles.planOptionBadge}>Recommended</span>
                      )}
                    </button>
                  );
                })}
              </div>
              {planLimits && (
                <p className={styles.planMeta}>
                  {planLimits.users} users · {(planLimits.aiScans ?? 0).toLocaleString()} AI scans/mo
                  {annual && " · billed annually"}
                </p>
              )}
              {isEnterprise && (
                <p className={styles.planMeta}>
                  Unlimited users · unlimited AI scans · custom made — tailored proposal within 1 business day
                </p>
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
                    <span className={styles.moduleRowIcon}><mod.Icon size={15} /></span>
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
                      <span className={styles.moduleRowIcon}><mod.Icon size={15} /></span>
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
                : PLAN_NAMES[planKey] + " plan"
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
            Continue →
          </button>
        </div>
      </div>
      {preview}
      </div>
    );
  }

  // ── Step 3 — Account (self serve) or quote request (enterprise) ──────────
  const selectedModuleDetails = MODULE_CONFIG.filter((m) =>
    selectedModules.includes(m.key as ModuleKey),
  );
  const isEnterprise = !isFounder && planKey === "enterprise";

  return (
    <div className={styles.layout}>
    <form className={styles.card} onSubmit={handleSubmit}>
      {progressBar}
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
            <span className={styles.summaryLineName}>{isFounder ? "Founding Member" : PLAN_NAMES[planKey]} plan</span>
            {!isEnterprise && planMonthlyDisplay !== null ? (
              <span className={styles.summaryLinePrice}>€{planMonthlyDisplay}/mo</span>
            ) : (
              <span className={styles.summaryLinePrice}>Custom</span>
            )}
          </div>
          {selectedModuleDetails.map((m) => (
            <div key={m.key} className={styles.summaryLine}>
              <span className={styles.summaryLineName}>
                <span className={styles.summaryLineIcon}><m.Icon size={13} /></span>
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

        {!isEnterprise && (
          <>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="custom-password">Choose a password</label>
              <input
                id="custom-password"
                className={styles.input}
                type="password"
                placeholder="At least 8 characters"
                required
                minLength={8}
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={busy}
              />
            </div>

            <div className={styles.field}>
              <label className={styles.label} htmlFor="custom-password-confirm">Confirm password</label>
              <input
                id="custom-password-confirm"
                className={styles.input}
                type="password"
                placeholder="Repeat your password"
                required
                minLength={8}
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={busy}
              />
            </div>
          </>
        )}
      </div>

      {/* Honeypot — visually hidden; bots that fill it are silently dropped server-side */}
      <input
        type="text"
        name="website"
        value={website}
        onChange={(e) => setWebsite(e.target.value)}
        autoComplete="off"
        tabIndex={-1}
        aria-hidden="true"
        style={{ position: "absolute", left: "-9999px", width: 1, height: 1, opacity: 0 }}
      />

      <button className={styles.submit} type="submit" disabled={busy}>
        {busy
          ? "One moment…"
          : isEnterprise ? "Request my proposal →" : "Create my workspace →"}
      </button>

      <p className={styles.finePrint}>
        {isEnterprise
          ? "Custom made for your organisation · Tailored proposal within 1 business day"
          : "First 30 days free · No payment details needed · Cancel any time"}
      </p>

      <p className={styles.finePrint}>
        By submitting you agree to our{" "}
        <a href="/privacy" style={{ color: "#5BA4F5" }}>Privacy Policy</a>
      </p>

      {formState === "error" && errorMsg && (
        <p className={styles.error}>{errorMsg}</p>
      )}

      <div className={styles.orDivider}>or</div>

      <a href={TALK_PATH} target="_blank" rel="noopener noreferrer" className={styles.bookCall}>
        Prefer to talk first? Book a call →
      </a>
    </form>
    {preview}
    </div>
  );
}
