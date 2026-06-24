"use client";

import { useMemo, useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import styles from "../request-demo/request-demo.module.css";
import { CheckIcon } from "../components/icons";
import {
  TEAM_SIZES,
  INDUSTRIES,
  TOOLS,
  PAIN_POINTS,
  MAX_PAIN_POINTS,
  MODULE_INFO,
  TOP_MODULES,
  computeRecommendations,
} from "../../lib/recommendations";

// Plan options
const PLANS = [
  { key: "starter", label: "Starter", price: 19, users: 3 },
  { key: "growth", label: "Growth", price: 39, users: 5 },
  { key: "pro", label: "Pro", price: 69, users: 10 },
];

type Step = 1 | 2 | 3;
type State = "idle" | "submitting" | "success" | "error";

function decodeToken(token: string): { company_name?: string; questionnaire?: Record<string, unknown> } | null {
  try {
    const parts = token.split(".");
    if (parts.length < 2) return null;
    const payload = JSON.parse(atob((parts[1] ?? "").replace(/-/g, "+").replace(/_/g, "/")));
    return payload as { company_name?: string; questionnaire?: Record<string, unknown> };
  } catch {
    return null;
  }
}

export default function SignupForm() {
  const searchParams = useSearchParams();
  const fromDemoToken = searchParams.get("token") ?? "";

  const [step, setStep] = useState<Step>(fromDemoToken ? 2 : 1);

  // Pre-fill from demo token if present
  const tokenData = useMemo(() => (fromDemoToken ? decodeToken(fromDemoToken) : null), [fromDemoToken]);

  // Step 1 — Questionnaire
  const [teamSize, setTeamSize] = useState("");
  const [industry, setIndustry] = useState("");
  const [currentTools, setCurrentTools] = useState<string[]>([]);
  const [painPoints, setPainPoints] = useState<string[]>([]);

  // Pre-populate questionnaire from demo token (runs once on mount)
  useEffect(() => {
    if (!tokenData?.questionnaire) return;
    const q = tokenData.questionnaire as Record<string, unknown>;
    if (typeof q.team_size === "string") setTeamSize(q.team_size);
    if (typeof q.industry === "string") setIndustry(q.industry);
    if (Array.isArray(q.current_tools)) setCurrentTools(q.current_tools as string[]);
    if (Array.isArray(q.pain_points)) setPainPoints(q.pain_points as string[]);
  }, []); // run once on mount

  // Step 2 — Plan + modules
  const [plan, setPlan] = useState("growth");

  // Step 3 — Account details
  const [name, setName] = useState("");
  const [company, setCompany] = useState((tokenData?.company_name as string) ?? "");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [state, setState] = useState<State>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [loginUrl, setLoginUrl] = useState("");

  const hasAnyAnswer = !!teamSize || !!industry || currentTools.length > 0 || painPoints.length > 0;

  const recommendations = useMemo(() => {
    if (!hasAnyAnswer) return TOP_MODULES;
    return computeRecommendations(industry, currentTools, painPoints);
  }, [hasAnyAnswer, industry, currentTools, painPoints]);

  function toggleMulti(value: string, list: string[], setList: (v: string[]) => void, max?: number) {
    if (list.includes(value)) {
      setList(list.filter((v) => v !== value));
    } else {
      if (max && list.length >= max) return;
      setList([...list, value]);
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (password !== confirmPassword) {
      setErrorMsg("Passwords do not match.");
      setState("error");
      return;
    }
    setState("submitting");
    setErrorMsg("");

    // Fire questionnaire-lead capture (non-blocking, so they're in Kanban even if signup fails)
    if (email) {
      fetch("/api/questionnaire-lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim() || email.split("@")[0],
          email: email.trim(),
          company: company.trim() || email.split("@")[0],
          questionnaire: hasAnyAnswer ? {
            team_size: teamSize || null,
            industry: industry || null,
            current_tools: currentTools.length ? currentTools : null,
            pain_points: painPoints.length ? painPoints : null,
            recommended_modules: recommendations,
          } : null,
        }),
      }).catch(() => {});
    }

    try {
      const res = await fetch("/api/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          company_name: company.trim(),
          email: email.trim(),
          password,
          plan,
          questionnaire: hasAnyAnswer ? {
            team_size: teamSize || null,
            industry: industry || null,
            current_tools: currentTools.length ? currentTools : null,
            pain_points: painPoints.length ? painPoints : null,
            recommended_modules: recommendations,
          } : null,
          from_demo_token: fromDemoToken || undefined,
        }),
      });

      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        setLoginUrl(data.login_url ?? "");
        setState("success");
        return;
      }

      const data = await res.json().catch(() => ({}));
      setErrorMsg(typeof data?.error === "string" ? data.error : "Something went wrong. Please try again.");
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
          <div className={styles.successIcon}><CheckIcon size={24} /></div>
          <h2 className={styles.successTitle}>Account created!</h2>
          <p className={styles.successSub}>
            Your Yippie workspace is ready.{" "}
            {loginUrl ? (
              <a href={loginUrl} style={{ color: "#5BA4F5", fontWeight: 600 }}>
                Log in now →
              </a>
            ) : (
              "Check your email for the login link."
            )}
          </p>
        </div>
      </div>
    );
  }

  const busy = state === "submitting";

  // ── Step 1 — Questionnaire ──────────────────────────────────────────────────
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
        <p className={styles.stepHint}>A few quick questions so we can recommend the right setup. All optional.</p>

        <div className={styles.question}>
          <span className={styles.qLabel}>How big is your team?</span>
          <div className={styles.chips}>
            {TEAM_SIZES.map((opt) => (
              <button key={opt} type="button"
                className={`${styles.chip} ${teamSize === opt ? styles.chipActive : ""}`}
                onClick={() => setTeamSize(teamSize === opt ? "" : opt)}>
                {opt}
              </button>
            ))}
          </div>
        </div>

        <div className={styles.question}>
          <span className={styles.qLabel}>What industry are you in?</span>
          <div className={styles.chips}>
            {INDUSTRIES.map((opt) => (
              <button key={opt} type="button"
                className={`${styles.chip} ${industry === opt ? styles.chipActive : ""}`}
                onClick={() => setIndustry(industry === opt ? "" : opt)}>
                {opt}
              </button>
            ))}
          </div>
        </div>

        <div className={styles.question}>
          <span className={styles.qLabel}>What tools do you use today?</span>
          <div className={styles.chips}>
            {TOOLS.map((opt) => (
              <button key={opt} type="button"
                className={`${styles.chip} ${currentTools.includes(opt) ? styles.chipActive : ""}`}
                onClick={() => toggleMulti(opt, currentTools, setCurrentTools)}>
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
                <button key={opt} type="button"
                  className={`${styles.chip} ${selected ? styles.chipActive : ""}`}
                  onClick={() => toggleMulti(opt, painPoints, setPainPoints, MAX_PAIN_POINTS)}
                  disabled={disabled}>
                  {opt}
                </button>
              );
            })}
          </div>
        </div>

        <button className={styles.submit} type="button" onClick={() => setStep(2)}>
          Continue →
        </button>

        <p className={styles.finePrint}>
          Already have an account?{" "}
          <a href={process.env.NEXT_PUBLIC_APP_URL ?? "https://app.getyippie.com"} style={{ color: "#5BA4F5" }}>
            Log in
          </a>
        </p>
      </div>
    );
  }

  // ── Step 2 — Plan selection ─────────────────────────────────────────────────
  if (step === 2) {
    return (
      <div className={styles.card}>
        <div className={styles.steps}>
          <button type="button" className={`${styles.stepDot} ${styles.stepDotDone}`}
            onClick={() => !fromDemoToken && setStep(1)} aria-label="Back to questions"
            style={fromDemoToken ? { cursor: "default" } : undefined}>
            1
          </button>
          <span className={`${styles.stepLine} ${styles.stepLineActive}`} />
          <span className={`${styles.stepDot} ${styles.stepDotActive}`}>2</span>
          <span className={styles.stepLine} />
          <span className={styles.stepDot}>3</span>
        </div>

        <div className={styles.recCard}>
          <span className={styles.recLabel}>
            {hasAnyAnswer ? "Recommended for you" : "Most popular with teams like yours"}
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

        <div className={styles.question}>
          <span className={styles.qLabel}>Choose your plan</span>
          <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
            {PLANS.map((p) => (
              <button key={p.key} type="button"
                onClick={() => setPlan(p.key)}
                style={{
                  flex: 1, padding: "14px 8px", borderRadius: 10, border: "2px solid",
                  borderColor: plan === p.key ? "#5BA4F5" : "#e2e8f0",
                  background: plan === p.key ? "#eff6ff" : "#fff",
                  cursor: "pointer", textAlign: "center",
                }}>
                <div style={{ fontWeight: 700, fontSize: 15, color: "#0f172a" }}>{p.label}</div>
                <div style={{ color: "#5BA4F5", fontWeight: 600, fontSize: 14 }}>€{p.price}/mo</div>
                <div style={{ color: "#64748b", fontSize: 12, marginTop: 2 }}>up to {p.users} users</div>
              </button>
            ))}
          </div>
        </div>

        <button className={styles.submit} type="button" onClick={() => setStep(3)}>
          Continue →
        </button>
      </div>
    );
  }

  // ── Step 3 — Account details ────────────────────────────────────────────────
  return (
    <form className={styles.card} onSubmit={handleSubmit} noValidate>
      <div className={styles.steps}>
        <button type="button" className={`${styles.stepDot} ${styles.stepDotDone}`}
          onClick={() => !fromDemoToken && setStep(1)}
          style={fromDemoToken ? { cursor: "default" } : undefined}>
          1
        </button>
        <span className={`${styles.stepLine} ${styles.stepLineActive}`} />
        <button type="button" className={`${styles.stepDot} ${styles.stepDotDone}`}
          onClick={() => setStep(2)}>
          2
        </button>
        <span className={`${styles.stepLine} ${styles.stepLineActive}`} />
        <span className={`${styles.stepDot} ${styles.stepDotActive}`}>3</span>
      </div>

      <div className={styles.fieldGroup}>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="su-name">Your name</label>
          <input id="su-name" className={styles.input} type="text" placeholder="Jane Smith"
            required autoComplete="name" value={name}
            onChange={(e) => setName(e.target.value)} disabled={busy} />
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="su-company">Company name</label>
          <input id="su-company" className={styles.input} type="text" placeholder="Acme BV"
            required autoComplete="organization" value={company}
            onChange={(e) => setCompany(e.target.value)} disabled={busy} />
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="su-email">Work email</label>
          <input id="su-email" className={styles.input} type="email" placeholder="jane@acme.com"
            required autoComplete="email" value={email}
            onChange={(e) => setEmail(e.target.value)} disabled={busy} />
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="su-password">Password</label>
          <input id="su-password" className={styles.input} type="password" placeholder="Min. 8 characters"
            required minLength={8} autoComplete="new-password" value={password}
            onChange={(e) => setPassword(e.target.value)} disabled={busy} />
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="su-confirm">Confirm password</label>
          <input id="su-confirm" className={styles.input} type="password" placeholder="Repeat your password"
            required autoComplete="new-password" value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)} disabled={busy} />
        </div>
      </div>

      <button className={styles.submit} type="submit" disabled={busy}>
        {busy ? "Creating account…" : "Create account →"}
      </button>

      {state === "error" && errorMsg && (
        <p className={styles.error}>{errorMsg}</p>
      )}

      <p className={styles.finePrint}>
        No credit card required · Cancel any time
      </p>
    </form>
  );
}
