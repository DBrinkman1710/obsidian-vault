"use client";

import { useMemo, useState } from "react";
import SiteNav from "../components/SiteNav";
import SiteFooter from "../components/SiteFooter";
import styles from "./page.module.css";
import contentStyles from "../components/content.module.css";
import {
  AiIcon, CalendarIcon, KanbanIcon, ChatIcon, LayersIcon,
  BillingIcon, ContractIcon, MailTrackIcon, TeamIcon, TrackingIcon, SalesIcon, SaasIcon, TicketIcon,
} from "../components/icons";
import { PLAN_LIMITS, MODULE_PRICES } from "@/lib/config";
import {
  TEAM_SIZES,
  INDUSTRIES,
  TOOLS,
  PAIN_POINTS,
  computeRecommendations,
  TOP_MODULES,
  INDUSTRY_LABELS_NL,
  TOOL_LABELS_NL,
  PAIN_POINT_LABELS_NL,
} from "@/lib/recommendations";
import { faqs } from "./faqs";

const MODULE_PRICE_MAP: Record<string, number> = {
  "AI Inbox":          MODULE_PRICES.ai,
  "Tickets":           MODULE_PRICES.tickets,
  "Live Chat":         MODULE_PRICES.chat,
  "Calendar":          MODULE_PRICES.calendar,
  "Pipeline":          MODULE_PRICES.pipeline,
  "Marketing":         MODULE_PRICES.marketing,
  "Departments":       MODULE_PRICES.departments,
  "Billing":           MODULE_PRICES.billing,
  "Contracts":         MODULE_PRICES.contracts,
  "Shipment Tracking": MODULE_PRICES.tracking,
  "Sales":             MODULE_PRICES.sales,
  "SaaS Analytics":      MODULE_PRICES.saas,
};

// The module keys above stay English because the recommendation engine and
// price lookups are keyed on them. These are the Dutch display labels shown on
// the (Dutch) root pricing page — the English mirror lives under /en/pricing.
const MODULE_LABEL_NL: Record<string, string> = {
  "AI Inbox": "AI Inbox",
  "Tickets": "Tickets",
  "Live Chat": "Live chat",
  "Calendar": "Agenda",
  "Calendar + Booking": "Agenda + Boekingen",
  "Pipeline": "Pipeline",
  "Marketing": "Marketing",
  "Departments": "Afdelingen",
  "Billing": "Facturatie",
  "Contracts": "Contracten",
  "Shipment Tracking": "Zendingtracking",
  "Sales": "Sales",
  "SaaS Analytics": "SaaS Analytics",
};
const moduleLabel = (name: string) => MODULE_LABEL_NL[name] ?? name;

const TEAM_RANK_MAP: Record<string, number> = {
  "1–3": 0, "4–10": 1, "11–25": 2, "25+": 3,
};

const DEMO_PATH = "/request-demo";
const FOUNDER_SPOTS_TOTAL = 5;
const FOUNDER_SPOTS_LEFT = parseInt(process.env.NEXT_PUBLIC_FOUNDER_SPOTS_LEFT ?? "5", 10);
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.getyippie.com";
// Booking page of the Yippie owner tenant (backend resolves the tenant by slug).
const TALK_PATH = `${APP_URL}/meet/yippie`;

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

// Modules included in every plan — everything else is a paid add on.
const CORE_FEATURES = ["Inbox", "Contacten"];

const plans: Plan[] = [
  {
    tier: "Starter",
    tagline: "Voor kleine teams die beginnen",
    monthly: PLAN_LIMITS.starter.priceMonthly,
    annual: PLAN_LIMITS.starter.priceAnnual,
    users: `${PLAN_LIMITS.starter.users} gebruikers`,
    aiScans: "2.000 AI-scans/mnd",
    included: [
      ...CORE_FEATURES,
      `${PLAN_LIMITS.starter.users} gebruikers`,
      "Onbeperkte contacten",
      "2.000 AI-scans/mnd",
      "Add-ons à la carte",
    ],
  },
  {
    tier: "Growth",
    tagline: "Voor groeiende teams met echt volume",
    monthly: PLAN_LIMITS.growth.priceMonthly,
    annual: PLAN_LIMITS.growth.priceAnnual,
    users: `${PLAN_LIMITS.growth.users} gebruikers`,
    aiScans: "5.000 AI-scans/mnd",
    included: [
      ...CORE_FEATURES,
      `${PLAN_LIMITS.growth.users} gebruikers`,
      "Onbeperkte contacten",
      "5.000 AI-scans/mnd",
      "Add-ons à la carte",
    ],
  },
  {
    tier: "Pro",
    tagline: "Voor gevestigde klantenservice-operaties",
    monthly: PLAN_LIMITS.pro.priceMonthly,
    annual: PLAN_LIMITS.pro.priceAnnual,
    users: `${PLAN_LIMITS.pro.users} gebruikers`,
    aiScans: "10.000 AI-scans/mnd",
    included: [
      ...CORE_FEATURES,
      `${PLAN_LIMITS.pro.users} gebruikers`,
      "Onbeperkte contacten",
      "10.000 AI-scans/mnd",
      "Add-ons à la carte",
    ],
    featured: true,
  },
  {
    tier: "Enterprise",
    tagline: "Toegewijde groeipartnership",
    monthly: null,
    annual: null,
    users: "Onbeperkte gebruikers",
    aiScans: "Onbeperkte AI-scans",
    included: [
      "Alle kernfuncties + elke module",
      "Onbeperkte gebruikers",
      "Onbeperkte contacten",
      "Onbeperkte AI-scans",
      "Toegewijde support + SLA",
    ],
    allModules: true,
    enterprise: true,
  },
];

const addOns = [
  { Icon: TicketIcon, name: "Tickets", desc: "Volg, wijs toe en sluit supportverzoeken af met SLA-meldingen en bulkacties.", price: MODULE_PRICES.tickets },
  { Icon: AiIcon, name: "AI Inbox", desc: "Maak automatisch concepttickets en antwoorden van binnenkomende berichten.", price: MODULE_PRICES.ai },
  { Icon: CalendarIcon, name: "Calendar + Booking", desc: "Deel boekingslinks en beheer afspraken.", price: MODULE_PRICES.calendar },
  { Icon: KanbanIcon, name: "Pipeline", desc: "Visuele Kanban-borden om contacten door aangepaste fases te bewegen.", price: MODULE_PRICES.pipeline },
  { Icon: ChatIcon, name: "Live Chat", desc: "Integreer een chatwidget en beheer WhatsApp-gesprekken.", price: MODULE_PRICES.chat },
  { Icon: MailTrackIcon, name: "Marketing", desc: "E-mailcampagnes, A/B-testen, open-tracking en drip-reeksen.", price: MODULE_PRICES.marketing },
  { Icon: TeamIcon, name: "Departments", desc: "Stuur tickets en chats automatisch door naar het juiste team.", price: MODULE_PRICES.departments },
  { Icon: BillingIcon, name: "Billing", desc: "Stuur facturen, volg betalingen en beheer abonnementen.", price: MODULE_PRICES.billing },
  { Icon: ContractIcon, name: "Contracts", desc: "Sla getekende contracten op, volg verlengingen en opzegtermijnen, en ontvang tijdig herinneringen.", price: MODULE_PRICES.contracts },
  { Icon: TrackingIcon, name: "Shipment Tracking", desc: "Live vervoerdersupdates voor DHL, UPS, PostNL en FedEx, gekoppeld aan contacten.", price: MODULE_PRICES.tracking },
  { Icon: SalesIcon, name: "Sales", desc: "Volg productweergaven, toevoegingen aan winkelwagen en aankopen. Identificeer kopers met hoge koopintentie.", price: MODULE_PRICES.sales },
  { Icon: SaasIcon, name: "SaaS Analytics", desc: "Terugkerende abonnementen, MRR/churn-tracking, gekoppeld aan contacten.", price: MODULE_PRICES.saas },
];

const PLAN_RANK = ["Starter", "Growth", "Pro", "Enterprise"] as const;

export default function PricingPage() {
  const [annual, setAnnual] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  // Questionnaire state
  const [teamSize, setTeamSize] = useState("4–10");
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
  // Annual: add-ons are billed ×12 with the same 10% discount CustomForm applies.
  const addOnPrice = (name: string) => {
    const monthly = MODULE_PRICE_MAP[name] ?? 0;
    return annual ? Math.round(monthly * 12 * 0.9) : monthly;
  };
  const addOnsTotal = isEnterprise ? 0 : recommendations.reduce((sum, m) => sum + addOnPrice(m), 0);
  const estimatedTotal = planPrice != null ? planPrice + addOnsTotal : null;

  return (
    <div className={styles.page}>
      <SiteNav />

      <section className={styles.hero}>
        <img src="/logo-white-bg-mark.svg" alt="" aria-hidden="true" className={contentStyles.pageLogoMark} />
        <div className={styles.heroTag}>
          <span className={styles.heroTagDot} />
          Transparante prijzen, geen verborgen kosten
        </div>
        <h1 className={styles.heroTitle}>Schaal zonder limieten.</h1>
        <p className={styles.heroSub}>
          Elk abonnement bevat onbeperkte contacten. Betaal voor de teamgrootte
          en AI-capaciteit die je nodig hebt. Voeg modules à la carte toe
          naarmate je groeit. Geen verborgen kosten, op elk moment opzegbaar.
        </p>

        <div className={styles.toggle}>
          <button
            type="button"
            className={`${styles.toggleOption} ${!annual ? styles.toggleActive : ""}`}
            onClick={() => setAnnual(false)}
          >
            Maandelijks
          </button>
          <button
            type="button"
            className={`${styles.toggleOption} ${annual ? styles.toggleActive : ""}`}
            onClick={() => setAnnual(true)}
          >
            Jaarlijks
            <span className={styles.toggleSave}>Bespaar 10%</span>
          </button>
        </div>
      </section>

      <section className={styles.plansSection}>
        <div className={styles.founderBanner}>
          <span className={styles.founderBadge}>Beperkt aanbod</span>
          <p className={styles.founderText}>
            <strong>Founding Member: nog {FOUNDER_SPOTS_LEFT} van de {FOUNDER_SPOTS_TOTAL} plekken beschikbaar</strong> voor €{PLAN_LIMITS.founder.priceMonthly}/mnd voor tot 10 gebruikers, alle kernfuncties en 50% korting op alle betaalde add-on modules.
          </p>
          <a href="/signup?plan=founder" className={styles.founderBtn}>Claim een foundersplek →</a>
        </div>

        <div className={styles.plansGrid}>
          {plans.map((plan, planIdx) => {
            // "Everything in X, plus…" — show only what this tier adds over the
            // previous paid tier, instead of repeating the full list. Presentation
            // only: the underlying `included` entitlements are unchanged.
            const prev = planIdx > 0 && !plan.enterprise ? plans[planIdx - 1] : null;
            const inheritsFrom = prev ? prev.tier : null;
            const deltaFeatures = prev
              ? plan.included.filter((f) => !prev.included.includes(f))
              : plan.included;
            return (
            <div
              key={plan.tier}
              className={`${styles.planCard} ${plan.featured ? styles.featured : ""}`}
            >
              {plan.featured && <span className={styles.popularBadge}>Meest gekozen</span>}
              <p className={styles.planTier}>{plan.tier}</p>
              <p className={styles.planTagline}>{plan.tagline}</p>
              {plan.enterprise ? (
                <p className={styles.planPrice}>Op maat</p>
              ) : (
                <p className={styles.planPrice}>
                  €{annual ? plan.annual : plan.monthly}
                  <sub>{annual ? "/jr" : "/mnd"}</sub>
                </p>
              )}
              {annual && !plan.enterprise && plan.monthly != null && plan.annual != null && (
                <p className={styles.planDiscount}>
                  Bespaar €{plan.monthly * 12 - plan.annual}/jr (was €{plan.monthly * 12})
                </p>
              )}
              {!plan.enterprise && (
                <p className={styles.planBilling}>
                  {annual ? "jaarlijks gefactureerd" : "maandelijks gefactureerd"}
                </p>
              )}
              {inheritsFrom && (
                <p className={styles.planInherits}>Alles van {inheritsFrom}, plus:</p>
              )}
              <ul className={styles.planFeatures}>
                {deltaFeatures.map((f) => (
                  <li key={f}>
                    <span className={styles.planCheck}>✓</span>
                    {f}
                  </li>
                ))}
              </ul>
              <a
                href={plan.enterprise ? TALK_PATH : "/signup"}
                className={`${styles.planBtn} ${plan.featured ? styles.featuredBtn : ""}`}
              >
                {plan.enterprise ? "Plan een gesprek" : "Start je gratis proefperiode"}
              </a>
            </div>
            );
          })}
        </div>
      </section>

      <section className={styles.quizSection}>
        <p className={styles.eyebrow}>Vind je abonnement</p>
        <h2 className={styles.sectionTitle}>Vertel ons over je bedrijf</h2>
        <p className={styles.sectionSub}>
          Beantwoord een paar korte vragen en we raden je het passende abonnement
          en de bijpassende add-ons aan, inclusief een geschatte {annual ? "jaarprijs" : "maandprijs"}.
        </p>

        <div className={styles.quiz}>
          <div className={styles.quizForm}>
            <div className={styles.quizQuestion}>
              <p className={styles.quizLabel}>Hoe groot is je team?</p>
              <div className={styles.quizOptions}>
                {TEAM_SIZES.map((o) => (
                  <button
                    key={o}
                    type="button"
                    className={`${styles.quizOption} ${teamSize === o ? styles.quizSelected : ""}`}
                    onClick={() => setTeamSize(teamSize === o ? "" : o)}
                  >
                    {o} mensen
                  </button>
                ))}
              </div>
            </div>

            <div className={styles.quizQuestion}>
              <p className={styles.quizLabel}>In welke branche zit je?</p>
              <div className={styles.quizOptions}>
                {INDUSTRIES.map((o) => (
                  <button
                    key={o}
                    type="button"
                    className={`${styles.quizOption} ${industry === o ? styles.quizSelected : ""}`}
                    onClick={() => setIndustry(industry === o ? "" : o)}
                  >
                    {INDUSTRY_LABELS_NL[o] ?? o}
                  </button>
                ))}
              </div>
            </div>

            <div className={styles.quizQuestion}>
              <p className={styles.quizLabel}>Welke tools gebruik je nu?</p>
              <div className={styles.quizOptions}>
                {TOOLS.map((o) => (
                  <button
                    key={o}
                    type="button"
                    className={`${styles.quizOption} ${currentTools.includes(o) ? styles.quizSelected : ""}`}
                    onClick={() => toggleMulti(o, currentTools, setCurrentTools)}
                  >
                    {TOOL_LABELS_NL[o] ?? o}
                  </button>
                ))}
              </div>
            </div>

            <div className={styles.quizQuestion}>
              <p className={styles.quizLabel}>Grootste knelpunten?</p>
              <div className={styles.quizOptions}>
                {PAIN_POINTS.map((o) => {
                  const selected = painPoints.includes(o);
                  return (
                    <button
                      key={o}
                      type="button"
                      className={`${styles.quizOption} ${selected ? styles.quizSelected : ""}`}
                      onClick={() => toggleMulti(o, painPoints, setPainPoints)}
                    >
                      {PAIN_POINT_LABELS_NL[o] ?? o}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className={styles.quizResult}>
            {answered && recommendedPlan ? (
              <>
                <p className={styles.quizResultEyebrow}>Ons advies</p>
                <p className={styles.quizResultPlan}>{recommendedPlan.tier}</p>
                <p className={styles.quizResultTagline}>{recommendedPlan.tagline}</p>
                {isEnterprise ? (
                  <p className={styles.quizResultNote}>
                    Enterprise-prijzen zijn op maat. Laten we bespreken wat bij jouw bedrijf past.
                  </p>
                ) : (
                  <div className={styles.quizBreakdown}>
                    <div className={styles.quizRow}>
                      <span>{recommendedPlan.tier} abonnement</span>
                      <span>€{planPrice}{annual ? "/jr" : "/mnd"}</span>
                    </div>
                    {recommendations.map((m) =>
                      MODULE_PRICE_MAP[m] != null ? (
                        <div key={m} className={styles.quizRow}>
                          <span>+ {moduleLabel(m)}</span>
                          <span>€{addOnPrice(m)}{annual ? "/jr" : "/mnd"}</span>
                        </div>
                      ) : null
                    )}
                    <div className={`${styles.quizRow} ${styles.quizTotal}`}>
                      <span>Geschat totaal</span>
                      <span>€{estimatedTotal}{annual ? "/jr" : "/mnd"}</span>
                    </div>
                  </div>
                )}
                {!isEnterprise && (
                  <p className={styles.quizResultNote}>
                    {annual ? "Jaarlijks gefactureerd (10% korting)." : "Maandelijks gefactureerd."}{" "}
                    Add-ons zijn per workspace. Modules gebaseerd op je antwoorden.
                  </p>
                )}
                <a href={isEnterprise ? TALK_PATH : "/signup"} className={styles.quizResultBtn}>
                  {isEnterprise ? "Plan een gesprek →" : "Start je gratis proefperiode →"}
                </a>
              </>
            ) : (
              <div className={styles.quizEmpty}>
                <div className={styles.quizEmptyIcon}><LayersIcon size={30} /></div>
                <p className={styles.quizEmptyText}>
                  Vertel ons over je team om je aanbevolen abonnement en geschatte prijs te zien.
                </p>
              </div>
            )}
          </div>
        </div>
      </section>

      <section className={styles.addOnsSection}>
        <p className={styles.eyebrow}>Add-ons</p>
        <h2 className={styles.sectionTitle}>Voeg de functies toe die je nodig hebt</h2>
        <p className={styles.sectionSub}>
          Begin met de kern en activeer elke module à la carte. Elke add-on heeft
          één vaste prijs per workspace, {annual ? "per jaar (10% korting ten opzichte van maandelijks)." : "per maand."}
        </p>
        <div className={styles.addOnsGrid}>
          {addOns.map((a) => (
            <div key={a.name} className={styles.addOnCard}>
              <div className={styles.addOnIcon}><a.Icon size={22} /></div>
              <h3 className={styles.addOnName}>{moduleLabel(a.name)}</h3>
              <p className={styles.addOnDesc}>{a.desc}</p>
              <p className={styles.addOnPrice}>
                €{annual ? Math.round(a.price * 12 * 0.9) : a.price}
                <span>{annual ? "/jr" : "/mnd"}</span>
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className={styles.faqSection}>
        <p className={styles.eyebrow}>Veelgestelde vragen</p>
        <h2 className={styles.sectionTitle}>Vragen, beantwoord</h2>
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
        <h2 className={styles.ctaTitle}>Klaar om je workspace te bouwen?</h2>
        <p className={styles.ctaSub}>
          Beantwoord een paar korte vragen, kies je modules en stap in via
          de link die we je mailen. De eerste 30 dagen gratis – geen betaalgegevens nodig.
        </p>
        <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", justifyContent: "center" }}>
          <a href="/signup" className={styles.btnPrimary}>
            Start je gratis proefperiode →
          </a>
          <a href={TALK_PATH} className={contentStyles.btnGhost}>
            Plan een gesprek
          </a>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
