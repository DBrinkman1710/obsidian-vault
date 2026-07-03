"use client";

import { useMemo, useState } from "react";
import SiteNav from "../components/SiteNav";
import SiteFooter from "../components/SiteFooter";
import styles from "./page.module.css";
import contentStyles from "../components/content.module.css";
import {
  AiIcon, CalendarIcon, KanbanIcon, ChatIcon, LayersIcon,
  BillingIcon, MailTrackIcon, TeamIcon, TrackingIcon, SalesIcon, SaasIcon,
} from "../components/icons";
import { PLAN_LIMITS, MODULE_PRICES } from "@/lib/config";
import {
  TEAM_SIZES,
  INDUSTRIES,
  TOOLS,
  PAIN_POINTS,
  MAX_PAIN_POINTS,
  computeRecommendations,
  TOP_MODULES,
} from "@/lib/recommendations";

const MODULE_PRICE_MAP: Record<string, number> = {
  "AI Inbox":          MODULE_PRICES.ai,
  "Tickets":           MODULE_PRICES.tickets,
  "Live Chat":         MODULE_PRICES.chat,
  "Calendar":          MODULE_PRICES.calendar,
  "Pipeline":          MODULE_PRICES.kanban,
  "Marketing":         MODULE_PRICES.marketing,
  "Departments":       MODULE_PRICES.departments,
  "Billing":           MODULE_PRICES.billing,
  "Shipment Tracking": MODULE_PRICES.tracking,
  "Sales":             MODULE_PRICES.sales,
  "SaaS Billing":      MODULE_PRICES.saas,
};

const TEAM_RANK_MAP: Record<string, number> = {
  "1–3": 0, "4–10": 1, "11–25": 2, "25+": 3,
};

const DEMO_PATH = "/request-demo";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.getyippie.com";
const TALK_PATH = `${APP_URL}/meet/default`;

type Plan = {
  tier: string;
  tagline: string;
  monthly: number | null;
  annual: number | null;
  users: string;
  aiScans: string;
  included: string[];
  allModules?: boolean;
  featured?: boolean;
  founding?: boolean;
  enterprise?: boolean;
};

const CORE_FEATURES = ["Inbox", "Tickets"];

const plans: Plan[] = [
  {
    tier: "Starter",
    tagline: "For small teams getting started",
    monthly: PLAN_LIMITS.starter.priceMonthly,
    annual: PLAN_LIMITS.starter.priceAnnual,
    users: `${PLAN_LIMITS.starter.users} users`,
    aiScans: "2,000 AI scans/mo",
    included: [
      ...CORE_FEATURES,
      `${PLAN_LIMITS.starter.users} users`,
      "Unlimited contacts",
      "2,000 AI scans/mo",
      "Add-ons à la carte",
    ],
  },
  {
    tier: "Growth",
    tagline: "For growing teams handling real volume",
    monthly: PLAN_LIMITS.growth.priceMonthly,
    annual: PLAN_LIMITS.growth.priceAnnual,
    users: `${PLAN_LIMITS.growth.users} users`,
    aiScans: "5,000 AI scans/mo",
    included: [
      ...CORE_FEATURES,
      "5 users",
      "Unlimited contacts",
      "5,000 AI scans/mo",
      "Add-ons à la carte",
    ],
  },
  {
    tier: "Pro",
    tagline: "For established support operations",
    monthly: PLAN_LIMITS.pro.priceMonthly,
    annual: PLAN_LIMITS.pro.priceAnnual,
    users: `${PLAN_LIMITS.pro.users} users`,
    aiScans: "10,000 AI scans/mo",
    included: [
      ...CORE_FEATURES,
      "10 users",
      "Unlimited contacts",
      "10,000 AI scans/mo",
      "Add-ons à la carte",
    ],
    featured: true,
  },
  {
    tier: "Enterprise",
    tagline: "Dedicated growth partnership",
    monthly: null,
    annual: null,
    users: "Unlimited users",
    aiScans: "Unlimited AI scans",
    included: [
      "All core features + every module",
      "Unlimited users",
      "Unlimited contacts",
      "Unlimited AI scans",
      "Dedicated support + SLA",
    ],
    allModules: true,
    enterprise: true,
  },
];

const addOns = [
  { Icon: AiIcon, name: "AI Inbox", desc: "Auto-draft tickets and replies from incoming messages.", price: MODULE_PRICES.ai },
  { Icon: CalendarIcon, name: "Calendar + Booking", desc: "Share booking links and manage appointments.", price: MODULE_PRICES.calendar },
  { Icon: KanbanIcon, name: "Pipeline", desc: "Visual Kanban boards to move contacts through custom stages.", price: MODULE_PRICES.kanban },
  { Icon: ChatIcon, name: "Live Chat", desc: "Embed a chat widget and manage WhatsApp conversations.", price: MODULE_PRICES.chat },
  { Icon: MailTrackIcon, name: "Marketing", desc: "Email campaigns, A/B testing, open tracking, and drip sequences.", price: MODULE_PRICES.marketing },
  { Icon: TeamIcon, name: "Departments", desc: "Route tickets and chats to the right team automatically.", price: MODULE_PRICES.departments },
  { Icon: BillingIcon, name: "Billing", desc: "Issue invoices, track payments, and manage subscriptions.", price: MODULE_PRICES.billing },
  { Icon: TrackingIcon, name: "Shipment Tracking", desc: "DHL, UPS, PostNL, FedEx — live carrier updates linked to contacts.", price: MODULE_PRICES.tracking },
  { Icon: SalesIcon, name: "Sales", desc: "Track product views, add-to-cart, and purchases — identify high-intent buyers.", price: MODULE_PRICES.sales },
  { Icon: SaasIcon, name: "SaaS Billing", desc: "Recurring subscriptions, MRR/churn tracking, linked to contacts.", price: MODULE_PRICES.saas },
];

const PLAN_RANK = ["Starter", "Growth", "Pro", "Enterprise"] as const;

const faqs = [
  {
    q: "Why unlimited contacts on every plan?",
    a: "Your contact list growing shouldn't be a reason to pay more. We believe in being a real growth partner — so we removed contact limits entirely. Plans differ by team size (users) and AI processing volume (scans per month), not by how many customers you have.",
  },
  {
    q: "Can I change my plan?",
    a: "Yes — upgrade or downgrade at any time. Changes take effect immediately and we prorate the difference on your next invoice.",
  },
  {
    q: "Are add-on prices per user or per workspace?",
    a: "Add-ons are priced per workspace, not per user. One flat monthly price unlocks the feature for your whole team.",
  },
  {
    q: "Is there a free trial?",
    a: "We don't offer a free trial — instead, we run a guided demo so you can see Yippie working with your real inbox before you commit. Feel free to book a call to discuss your options, or request a demo to get started.",
  },
];

export default function PricingPage() {
  const [annual, setAnnual] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  // Questionnaire state
  const [teamSize, setTeamSize] = useState("");
  const [industry, setIndustry] = useState("");
  const [currentTools, setCurrentTools] = useState<string[]>([]);
  const [painPoints, setPainPoints] = useState<string[]>([]);

  function toggleMulti(value: string, list: string[], setList: (v: string[]) => void, max?: number) {
    if (list.includes(value)) {
      setList(list.filter((v) => v !== value));
    } else {
      if (max && list.length >= max) return;
      setList([...list, value]);
    }
  }

  const hasAnyAnswer = !!teamSize || !!industry || currentTools.length > 0 || painPoints.length > 0;
  const answered = !!teamSize;

  const teamRank = teamSize ? (TEAM_RANK_MAP[teamSize] ?? 0) : null;
  const recommendedRank = teamRank ?? 0;
  const recommendedPlanName = answered ? PLAN_RANK[recommendedRank] : null;
  const recommendedPlan = recommendedPlanName ? plans.find((p) => p.tier === recommendedPlanName) : null;

  const recommendations = useMemo(() => {
    if (!hasAnyAnswer) return TOP_MODULES;
    return computeRecommendations(industry, currentTools, painPoints);
  }, [hasAnyAnswer, industry, currentTools, painPoints]);

  const planPrice = recommendedPlan
    ? annual ? (recommendedPlan.annual ?? null) : (recommendedPlan.monthly ?? null)
    : null;
  const isEnterprise = recommendedPlan?.enterprise ?? false;
  const addOnsTotal = isEnterprise ? 0 : recommendations.reduce((sum, m) => sum + (MODULE_PRICE_MAP[m] ?? 0), 0);
  const estimatedTotal = planPrice != null ? planPrice + addOnsTotal : null;

  return (
    <div className={styles.page}>
      <SiteNav />

      <section className={styles.hero}>
        <img src="/logo-white-bg-mark.svg" alt="" aria-hidden="true" className={contentStyles.pageLogoMark} />
        <div className={styles.heroTag}>
          <span className={styles.heroTagDot} />
          Transparent pricing, no games
        </div>
        <h1 className={styles.heroTitle}>Scale without limits.</h1>
        <p className={styles.heroSub}>
          Every plan includes unlimited contacts. Pay for the team size and AI
          power you need — add modules à la carte as you grow. No hidden fees,
          cancel anytime.
        </p>

        <div className={styles.toggle}>
          <button
            type="button"
            className={`${styles.toggleOption} ${!annual ? styles.toggleActive : ""}`}
            onClick={() => setAnnual(false)}
          >
            Monthly
          </button>
          <button
            type="button"
            className={`${styles.toggleOption} ${annual ? styles.toggleActive : ""}`}
            onClick={() => setAnnual(true)}
          >
            Annual
            <span className={styles.toggleSave}>Save 10%</span>
          </button>
        </div>
      </section>

      <section className={styles.plansSection}>
        <div className={styles.founderBanner}>
          <span className={styles.founderBadge}>Limited offer</span>
          <p className={styles.founderText}>
            <strong>Founding Member — first 5 spots:</strong> €{PLAN_LIMITS.founder.priceMonthly}/mo for up to 10 users, all core features, and 50% off all paid add-on modules.
          </p>
          <a href="/custom?plan=founder" className={styles.founderBtn}>Claim a founder spot →</a>
        </div>

        <div className={styles.plansGrid}>
          {plans.map((plan) => (
            <div
              key={plan.tier}
              className={`${styles.planCard} ${plan.featured ? styles.featured : ""}`}
            >
              {plan.featured && <span className={styles.popularBadge}>Most popular</span>}
              <p className={styles.planTier}>{plan.tier}</p>
              <p className={styles.planTagline}>{plan.tagline}</p>
              {plan.enterprise ? (
                <p className={styles.planPrice}>Custom</p>
              ) : (
                <p className={styles.planPrice}>
                  €{annual ? plan.annual : plan.monthly}
                  <sub>{annual ? "/yr" : "/mo"}</sub>
                </p>
              )}
              {annual && !plan.enterprise && plan.monthly != null && (
                <p className={styles.planDiscount}>
                  10% off — was €{plan.monthly * 12}/yr
                </p>
              )}
              {!plan.enterprise && (
                <p className={styles.planBilling}>
                  {annual ? "billed annually" : "billed monthly"}
                </p>
              )}
              <ul className={styles.planFeatures}>
                {plan.included.map((f) => (
                  <li key={f}>
                    <span className={styles.planCheck}>✓</span>
                    {f}
                  </li>
                ))}
              </ul>
              <a
                href={plan.enterprise ? TALK_PATH : "/custom"}
                className={`${styles.planBtn} ${plan.featured ? styles.featuredBtn : ""}`}
              >
                {plan.enterprise ? "Book a call" : "Build your plan"}
              </a>
            </div>
          ))}
        </div>
      </section>

      <section className={styles.quizSection}>
        <p className={styles.eyebrow}>Find your plan</p>
        <h2 className={styles.sectionTitle}>Tell us about your business</h2>
        <p className={styles.sectionSub}>
          Answer a few quick questions and we&apos;ll recommend the plan and
          add-ons that fit — with an estimated monthly price.
        </p>

        <div className={styles.quiz}>
          <div className={styles.quizForm}>
            <div className={styles.quizQuestion}>
              <p className={styles.quizLabel}>How big is your team?</p>
              <div className={styles.quizOptions}>
                {TEAM_SIZES.map((o) => (
                  <button
                    key={o}
                    type="button"
                    className={`${styles.quizOption} ${teamSize === o ? styles.quizSelected : ""}`}
                    onClick={() => setTeamSize(teamSize === o ? "" : o)}
                  >
                    {o} people
                  </button>
                ))}
              </div>
            </div>

            <div className={styles.quizQuestion}>
              <p className={styles.quizLabel}>What industry are you in?</p>
              <div className={styles.quizOptions}>
                {INDUSTRIES.map((o) => (
                  <button
                    key={o}
                    type="button"
                    className={`${styles.quizOption} ${industry === o ? styles.quizSelected : ""}`}
                    onClick={() => setIndustry(industry === o ? "" : o)}
                  >
                    {o}
                  </button>
                ))}
              </div>
            </div>

            <div className={styles.quizQuestion}>
              <p className={styles.quizLabel}>What tools do you use today?</p>
              <div className={styles.quizOptions}>
                {TOOLS.map((o) => (
                  <button
                    key={o}
                    type="button"
                    className={`${styles.quizOption} ${currentTools.includes(o) ? styles.quizSelected : ""}`}
                    onClick={() => toggleMulti(o, currentTools, setCurrentTools)}
                  >
                    {o}
                  </button>
                ))}
              </div>
            </div>

            <div className={styles.quizQuestion}>
              <p className={styles.quizLabel}>
                Biggest pain points?{" "}
                <span className={styles.quizHint}>pick up to {MAX_PAIN_POINTS}</span>
              </p>
              <div className={styles.quizOptions}>
                {PAIN_POINTS.map((o) => {
                  const selected = painPoints.includes(o);
                  const disabled = !selected && painPoints.length >= MAX_PAIN_POINTS;
                  return (
                    <button
                      key={o}
                      type="button"
                      className={`${styles.quizOption} ${selected ? styles.quizSelected : ""}`}
                      onClick={() => toggleMulti(o, painPoints, setPainPoints, MAX_PAIN_POINTS)}
                      disabled={disabled}
                    >
                      {o}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className={styles.quizResult}>
            {answered && recommendedPlan ? (
              <>
                <p className={styles.quizResultEyebrow}>We recommend</p>
                <p className={styles.quizResultPlan}>{recommendedPlan.tier}</p>
                <p className={styles.quizResultTagline}>{recommendedPlan.tagline}</p>
                {isEnterprise ? (
                  <p className={styles.quizResultNote}>
                    Enterprise pricing is custom — let&apos;s talk about what fits your business.
                  </p>
                ) : (
                  <div className={styles.quizBreakdown}>
                    <div className={styles.quizRow}>
                      <span>{recommendedPlan.tier} plan</span>
                      <span>€{planPrice}/mo</span>
                    </div>
                    {recommendations.map((m) =>
                      MODULE_PRICE_MAP[m] != null ? (
                        <div key={m} className={styles.quizRow}>
                          <span>+ {m}</span>
                          <span>€{MODULE_PRICE_MAP[m]}/mo</span>
                        </div>
                      ) : null
                    )}
                    <div className={`${styles.quizRow} ${styles.quizTotal}`}>
                      <span>Estimated total</span>
                      <span>€{estimatedTotal}{annual ? "/yr" : "/mo"}</span>
                    </div>
                  </div>
                )}
                {!isEnterprise && (
                  <p className={styles.quizResultNote}>
                    {annual ? "Billed annually (10% off)." : "Billed monthly."}{" "}
                    Add-ons are per workspace. Modules based on your answers.
                  </p>
                )}
                <a href={isEnterprise ? TALK_PATH : "/custom"} className={styles.quizResultBtn}>
                  {isEnterprise ? "Book a call →" : "Build your plan →"}
                </a>
              </>
            ) : (
              <div className={styles.quizEmpty}>
                <div className={styles.quizEmptyIcon}><LayersIcon size={30} /></div>
                <p className={styles.quizEmptyText}>
                  Tell us about your team to see your recommended plan and estimated price.
                </p>
              </div>
            )}
          </div>
        </div>
      </section>

      <section className={styles.addOnsSection}>
        <p className={styles.eyebrow}>Add-ons</p>
        <h2 className={styles.sectionTitle}>Add the features you need</h2>
        <p className={styles.sectionSub}>
          Start with the core and switch on any module à la carte. Each add-on is
          one flat price per workspace, per month.
        </p>
        <div className={styles.addOnsGrid}>
          {addOns.map((a) => (
            <div key={a.name} className={styles.addOnCard}>
              <div className={styles.addOnIcon}><a.Icon size={22} /></div>
              <h3 className={styles.addOnName}>{a.name}</h3>
              <p className={styles.addOnDesc}>{a.desc}</p>
              <p className={styles.addOnPrice}>
                €{a.price}
                <span>/mo</span>
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className={styles.faqSection}>
        <p className={styles.eyebrow}>FAQ</p>
        <h2 className={styles.sectionTitle}>Questions, answered</h2>
        <div className={styles.faqList}>
          {faqs.map((item, i) => (
            <div
              key={item.q}
              className={`${styles.faqItem} ${openFaq === i ? styles.faqOpen : ""}`}
            >
              <button
                type="button"
                className={styles.faqQuestion}
                onClick={() => setOpenFaq(openFaq === i ? null : i)}
                aria-expanded={openFaq === i}
              >
                {item.q}
                <span className={styles.faqChevron}>{openFaq === i ? "−" : "+"}</span>
              </button>
              {openFaq === i && <p className={styles.faqAnswer}>{item.a}</p>}
            </div>
          ))}
        </div>
      </section>

      <section className={styles.ctaSection}>
        <h2 className={styles.ctaTitle}>Want a tailored quote?</h2>
        <p className={styles.ctaSub}>
          Answer a few quick questions and we&apos;ll put together a personalised
          package with exactly the modules your team needs.
        </p>
        <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", justifyContent: "center" }}>
          <a href="/custom" className={styles.btnPrimary}>
            Build your package →
          </a>
          <a href={TALK_PATH} className={contentStyles.btnGhost}>
            Book a call
          </a>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
