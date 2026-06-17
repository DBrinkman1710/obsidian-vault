"use client";

import { useState } from "react";
import SiteNav from "../components/SiteNav";
import SiteFooter from "../components/SiteFooter";
import styles from "./page.module.css";
import {
  TicketIcon, AiIcon, CalendarIcon, KanbanIcon, MailTrackIcon, LayersIcon,
} from "../components/icons";

const DEMO_PATH = "/request-demo";

type Plan = {
  tier: string;
  tagline: string;
  monthly: number;
  annual: number; // per month, billed annually
  users: string;
  contacts: string;
  included: string[];
  allModules?: boolean; // all add-ons bundled — no à la carte needed
  featured?: boolean;
};

const plans: Plan[] = [
  {
    tier: "Founder",
    tagline: "For early adopters",
    monthly: 9,
    annual: Math.round(9 * 12 * 0.9),       // 97 billed annually
    users: "2 users",
    contacts: "1,000 contacts",
    included: ["Inbox", "Contacts", "2 users", "1,000 contacts", "Add-ons à la carte"],
  },
  {
    tier: "Starter",
    tagline: "For small teams",
    monthly: 29,
    annual: Math.round(29 * 12 * 0.9),      // 313 billed annually
    users: "5 users",
    contacts: "5,000 contacts",
    included: ["Inbox", "Contacts", "5 users", "5,000 contacts", "Add-ons à la carte"],
  },
  {
    tier: "Growth",
    tagline: "For growing businesses",
    monthly: 69,
    annual: Math.round(69 * 12 * 0.9),      // 745 billed annually
    users: "15 users",
    contacts: "25,000 contacts",
    included: ["Inbox", "Contacts", "15 users", "25,000 contacts", "Add-ons à la carte"],
    featured: true,
  },
  {
    tier: "Pro",
    tagline: "For established companies — everything included",
    monthly: 99,
    annual: Math.round(99 * 12 * 0.9),      // 1069 billed annually
    users: "Unlimited users",
    contacts: "Unlimited contacts",
    included: [
      "Inbox + Contacts",
      "Tickets",
      "AI auto-drafting",
      "Calendar + Booking",
      "Kanban pipeline",
      "Email tracking",
      "Unlimited users",
      "Unlimited contacts",
    ],
    allModules: true,
  },
];

const addOns = [
  { Icon: TicketIcon, name: "Tickets", desc: "Track, assign, and close requests with SLA alerts.", price: 15 },
  { Icon: AiIcon, name: "AI", desc: "Auto-draft tickets and replies from incoming messages.", price: 19 },
  { Icon: CalendarIcon, name: "Calendar + Booking", desc: "Share booking links and manage appointments.", price: 12 },
  { Icon: KanbanIcon, name: "Kanban", desc: "Visual pipeline boards to move work through stages.", price: 12 },
  { Icon: MailTrackIcon, name: "Email tracking", desc: "See when your sent emails are delivered and opened.", price: 9 },
];

// Guided questionnaire — customers answer a few questions about their business
// and we recommend a plan (and add-ons). Each option carries the minimum plan
// rank it requires; the recommendation is the highest rank across all answers.
const PLAN_RANK = ["Founder", "Starter", "Growth", "Pro"] as const;

const teamOptions = [
  { label: "Just me / 1–2 people", rank: 0 },
  { label: "3–5 people", rank: 1 },
  { label: "6–15 people", rank: 2 },
  { label: "More than 15", rank: 3 },
];

const contactOptions = [
  { label: "Under 1,000", rank: 0 },
  { label: "1,000–5,000", rank: 1 },
  { label: "5,000–25,000", rank: 2 },
  { label: "More than 25,000", rank: 3 },
];

const featureOptions = [
  { key: "tickets", label: "Ticket tracking + SLAs", price: 15 },
  { key: "ai", label: "AI auto-drafting", price: 19 },
  { key: "calendar", label: "Calendar + booking links", price: 12 },
  { key: "kanban", label: "Kanban pipeline boards", price: 12 },
  { key: "emailtracking", label: "Email open tracking", price: 9 },
];

const faqs = [
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
    a: "We offer a guided demo and a trial workspace so you can try Yippie with your real inbox before committing. Talk to us to get set up.",
  },
  {
    q: "What if I hit my contact limit?",
    a: "We'll let you know as you approach your limit. You can upgrade to a higher plan at any time to raise your contact and user caps.",
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
      ? recommendedPlan.annual
      : recommendedPlan.monthly
    : 0;
  const proIncludesAll = recommendedPlan?.allModules ?? false;
  const addOnsTotal = proIncludesAll ? 0 : chosenAddOns.reduce((sum, a) => sum + a.price, 0);
  const estimatedTotal = planPrice + addOnsTotal;

  return (
    <div className={styles.page}>
      <SiteNav />

      <section className={styles.hero}>
        <div className={styles.heroTag}>
          <span className={styles.heroTagDot} />
          Simple, honest pricing
        </div>
        <h1 className={styles.heroTitle}>Pricing that grows with you</h1>
        <p className={styles.heroSub}>
          Every plan includes the Inbox and Contacts core. Add the modules you
          need à la carte — or go Pro and get everything in one flat price.
          No hidden fees, cancel anytime.
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
        <div className={styles.plansGrid}>
          {plans.map((plan) => (
            <div
              key={plan.tier}
              className={`${styles.planCard} ${plan.featured ? styles.featured : ""}`}
            >
              {plan.featured && <span className={styles.popularBadge}>Most popular</span>}
              <p className={styles.planTier}>{plan.tier}</p>
              <p className={styles.planTagline}>{plan.tagline}</p>
              <p className={styles.planPrice}>
                €{annual ? plan.annual : plan.monthly}
                <sub>{annual ? "/yr" : "/mo"}</sub>
              </p>
              {annual && (
                <p className={styles.planDiscount}>
                  10% off — was €{plan.monthly * 12}/yr
                </p>
              )}
              <p className={styles.planBilling}>
                {annual ? "billed annually" : "billed monthly"}
              </p>
              <ul className={styles.planFeatures}>
                {plan.included.map((f) => (
                  <li key={f}>
                    <span className={styles.planCheck}>✓</span>
                    {f}
                  </li>
                ))}
              </ul>
              <a
                href={DEMO_PATH}
                className={`${styles.planBtn} ${plan.featured ? styles.featuredBtn : ""}`}
              >
                Request demo
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
              <p className={styles.quizLabel}>How many contacts do you manage?</p>
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
                <p className={styles.quizResultNote}>
                  {annual ? "Billed annually (10% off). Add-ons also discounted × 12 × 0.9." : "Billed monthly."}{" "}
                  Add-ons are per workspace.
                </p>
                <a href={DEMO_PATH} className={styles.quizResultBtn}>
                  Request demo →
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
        <h2 className={styles.ctaTitle}>Not sure which plan fits?</h2>
        <p className={styles.ctaSub}>
          Tell us about your team and we&apos;ll help you pick the right plan and
          add-ons. No pressure, no credit card.
        </p>
        <a href={DEMO_PATH} className={styles.btnPrimary}>
          Talk to us →
        </a>
      </section>

      <SiteFooter />
    </div>
  );
}
