"use client";

import { useState } from "react";
import SiteNav from "../components/SiteNav";
import SiteFooter from "../components/SiteFooter";
import styles from "./page.module.css";
import contentStyles from "../components/content.module.css";
import {
  TicketIcon, AiIcon, CalendarIcon, KanbanIcon, ChatIcon, LayersIcon,
  BillingIcon, MailTrackIcon, TeamIcon,
} from "../components/icons";
import { PLAN_LIMITS, MODULE_PRICES } from "@/lib/config";

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

const CORE_FEATURES = ["Inbox", "Contacts", "Activity"];

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
  { Icon: TicketIcon, name: "Tickets", desc: "Track, assign, and close requests with SLA alerts.", price: MODULE_PRICES.tickets },
  { Icon: AiIcon, name: "AI", desc: "Auto-draft tickets and replies from incoming messages.", price: MODULE_PRICES.ai },
  { Icon: CalendarIcon, name: "Calendar + Booking", desc: "Share booking links and manage appointments.", price: MODULE_PRICES.calendar },
  { Icon: KanbanIcon, name: "Kanban", desc: "Visual pipeline boards to move work through stages.", price: MODULE_PRICES.kanban },
  { Icon: ChatIcon, name: "Live Chat", desc: "Embed a chat widget and manage WhatsApp conversations.", price: MODULE_PRICES.chat },
  { Icon: MailTrackIcon, name: "Marketing", desc: "Email campaigns, A/B testing, open tracking, and drip sequences.", price: MODULE_PRICES.marketing },
  { Icon: TeamIcon, name: "Departments", desc: "Route tickets and chats to the right team automatically.", price: MODULE_PRICES.departments },
  { Icon: BillingIcon, name: "Billing", desc: "Issue invoices, track payments, and manage subscriptions.", price: MODULE_PRICES.billing },
];

// Guided questionnaire — customers answer a few questions about their business
// and we recommend a plan (and add-ons). Each option carries the minimum plan
// rank it requires; the recommendation is the highest rank across all answers.
const PLAN_RANK = ["Starter", "Growth", "Pro", "Enterprise"] as const;

const teamOptions = [
  { label: "1–3 people", rank: 0 },
  { label: "4–5 people", rank: 1 },
  { label: "6–10 people", rank: 2 },
  { label: "More than 10", rank: 3 },
];

const contactOptions = [
  { label: "Under 500 messages/mo", rank: 0 },
  { label: "500–5,000 messages/mo", rank: 1 },
  { label: "5,000–10,000 messages/mo", rank: 2 },
  { label: "More than 10,000 messages/mo", rank: 3 },
];

const featureOptions = [
  { key: "tickets", label: "Ticket tracking + SLAs", price: MODULE_PRICES.tickets },
  { key: "ai", label: "AI auto-drafting", price: MODULE_PRICES.ai },
  { key: "calendar", label: "Calendar + booking links", price: MODULE_PRICES.calendar },
  { key: "kanban", label: "Kanban pipeline boards", price: MODULE_PRICES.kanban },
  { key: "chat", label: "Live Chat (web + WhatsApp)", price: MODULE_PRICES.chat },
  { key: "marketing", label: "Email campaigns + tracking", price: MODULE_PRICES.marketing },
  { key: "departments", label: "Departments + routing", price: MODULE_PRICES.departments },
  { key: "billing", label: "Billing + invoicing", price: MODULE_PRICES.billing },
];

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
    a: "We don't offer a free trial — instead, we run a guided demo so you can see Yippie working with your real inbox before you commit. Request a demo from the nav to get started.",
  },
];

export default function PricingPage() {
  const [annual, setAnnual] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  // Questionnaire state
  const [teamRank, setTeamRank] = useState<number | null>(null);
  const [contactRank, setContactRank] = useState<number | null>(null);
  const [wantedFeatures, setWantedFeatures] = useState<string[]>([]);

  const toggleFeature = (key: string) =>
    setWantedFeatures((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );

  const answered = teamRank !== null && contactRank !== null;
  const recommendedRank = answered ? Math.max(teamRank!, contactRank!) : 0;
  const recommendedPlanName = PLAN_RANK[recommendedRank];
  const recommendedPlan = plans.find((p) => p.tier === recommendedPlanName);
  const chosenAddOns = featureOptions.filter((f) => wantedFeatures.includes(f.key));
  const planPrice = recommendedPlan
    ? annual
      ? (recommendedPlan.annual ?? null)
      : (recommendedPlan.monthly ?? null)
    : 0;
  const isEnterprise = recommendedPlan?.enterprise ?? false;
  const proIncludesAll = recommendedPlan?.allModules ?? false;
  const addOnsTotal = proIncludesAll ? 0 : chosenAddOns.reduce((sum, a) => sum + a.price, 0);
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
          <a href="/custom" className={styles.founderBtn}>Claim a founder spot →</a>
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
                {teamOptions.map((o) => (
                  <button
                    key={o.label}
                    type="button"
                    className={`${styles.quizOption} ${teamRank === o.rank ? styles.quizSelected : ""}`}
                    onClick={() => setTeamRank(o.rank)}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            </div>

            <div className={styles.quizQuestion}>
              <p className={styles.quizLabel}>How many support messages do you receive per month?</p>
              <div className={styles.quizOptions}>
                {contactOptions.map((o) => (
                  <button
                    key={o.label}
                    type="button"
                    className={`${styles.quizOption} ${contactRank === o.rank ? styles.quizSelected : ""}`}
                    onClick={() => setContactRank(o.rank)}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            </div>

            <div className={styles.quizQuestion}>
              <p className={styles.quizLabel}>Which features do you need? (optional)</p>
              <div className={styles.quizOptions}>
                {featureOptions.map((f) => (
                  <button
                    key={f.key}
                    type="button"
                    className={`${styles.quizOption} ${wantedFeatures.includes(f.key) ? styles.quizSelected : ""}`}
                    onClick={() => toggleFeature(f.key)}
                  >
                    {f.label}
                  </button>
                ))}
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
                    {proIncludesAll ? (
                      <div className={styles.quizRow}>
                        <span>All modules included</span>
                        <span>✓</span>
                      </div>
                    ) : (
                      chosenAddOns.map((a) => (
                        <div key={a.key} className={styles.quizRow}>
                          <span>+ {a.label}</span>
                          <span>€{a.price}/mo</span>
                        </div>
                      ))
                    )}
                    <div className={`${styles.quizRow} ${styles.quizTotal}`}>
                      <span>Estimated total</span>
                      <span>€{estimatedTotal}{annual ? "/yr" : "/mo"}</span>
                    </div>
                  </div>
                )}
                {!isEnterprise && (
                  <p className={styles.quizResultNote}>
                    {annual ? "Billed annually (10% off). Add-ons also discounted × 12 × 0.9." : "Billed monthly."}{" "}
                    Add-ons are per workspace.
                  </p>
                )}
                <a href={isEnterprise ? TALK_PATH : `/custom`} className={styles.quizResultBtn}>
                  {isEnterprise ? "Book a call →" : "Build your plan →"}
                </a>
              </>
            ) : (
              <div className={styles.quizEmpty}>
                <div className={styles.quizEmptyIcon}><LayersIcon size={30} /></div>
                <p className={styles.quizEmptyText}>
                  Answer the team size and contact questions to see your
                  recommended plan and estimated price.
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
