import type { Metadata } from "next";
import styles from "../../page.module.css";
import SiteNav from "../../components/SiteNav";
import SiteFooter from "../../components/SiteFooter";
import Reveal from "../../components/Reveal";
import { ArrowRightIcon, CheckIcon } from "../../components/icons";
import { PLAN_LIMITS } from "@/lib/config";

export const metadata: Metadata = {
  title: "Yippie Prijzen | Eerlijke klantenservice software voor MKB",
  description:
    "Starter €19/mo, Growth €39/mo, Pro €69/mo. Vaste prijs per werkruimte, nooit per medewerker. Onbeperkte contacten op elk abonnement. 30 dagen gratis uitproberen.",
  alternates: {
    canonical: "/nl/pricing",
    languages: {
      en: "/pricing",
      nl: "/nl/pricing",
    },
  },
  keywords: [
    "klantenservice software prijs",
    "helpdesk software MKB",
    "gedeelde inbox prijs",
    "klantenservice automatisering kosten",
  ],
};

const plans = [
  {
    tier: "Starter",
    tagline: "Voor kleine teams die starten",
    monthly: PLAN_LIMITS.starter.priceMonthly,
    users: PLAN_LIMITS.starter.users,
    features: [
      `${PLAN_LIMITS.starter.users} gebruikers`,
      "Inbox + Contacten",
      "Onbeperkte contacten",
      "2.000 AI-scans/mo",
      "Modules à la carte",
    ],
    featured: false,
  },
  {
    tier: "Growth",
    tagline: "Voor groeiende teams met echt volume",
    monthly: PLAN_LIMITS.growth.priceMonthly,
    users: PLAN_LIMITS.growth.users,
    features: [
      `${PLAN_LIMITS.growth.users} gebruikers`,
      "Inbox + Contacten",
      "Onbeperkte contacten",
      "5.000 AI-scans/mo",
      "Modules à la carte",
    ],
    featured: true,
  },
  {
    tier: "Pro",
    tagline: "Voor gevestigde supportoperaties",
    monthly: PLAN_LIMITS.pro.priceMonthly,
    users: PLAN_LIMITS.pro.users,
    features: [
      `${PLAN_LIMITS.pro.users} gebruikers`,
      "Inbox + Contacten",
      "Onbeperkte contacten",
      "10.000 AI-scans/mo",
      "Modules à la carte",
    ],
    featured: false,
  },
];

const differentiators = [
  {
    title: "Nooit per medewerker",
    desc: "Zendesk rekent ~€55 per medewerker per maand. Yippie rekent één vaste prijs per werkruimte, hoe groot je team ook wordt.",
  },
  {
    title: "Onbeperkte contacten",
    desc: "Geen limiet op je klantenlijst. Of je nu 100 of 100.000 contacten hebt — de prijs verandert niet.",
  },
  {
    title: "Direct live in één dag",
    desc: "Geen consultants, geen weken implementatietraject. Jij bent vandaag operationeel.",
  },
  {
    title: "Gebouwd voor MKB",
    desc: "Niet afgeschaalde enterprise-software. Yippie is ontworpen voor teams van 1 tot 25 medewerkers.",
  },
];

export default function NlPricingPage() {
  return (
    <>
      <SiteNav />

      {/* Hero */}
      <section className={styles.hero}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo-white-bg-mark.svg" alt="" aria-hidden="true" className={styles.heroLogoMark} />
        <div className={styles.heroInner} style={{ flexDirection: "column", textAlign: "center", gap: 0 }}>
          <Reveal className={styles.heroCopy} style={{ maxWidth: 680, margin: "0 auto" }}>
            <div className={styles.eyebrowPill}>
              <span className={styles.pillDot} />
              Transparante prijzen voor MKB
            </div>
            <h1 className={styles.heroTitle}>
              Eerlijke prijzen,<br />geen verrassingen.
            </h1>
            <p className={styles.heroSub}>
              Één vaste maandprijs per werkruimte. Onbeperkte contacten op elk abonnement.
              Voeg modules toe à la carte naarmate je groeit. Geen verborgen kosten, altijd opzegbaar.
            </p>
            <div className={styles.heroActions} style={{ justifyContent: "center" }}>
              <a href="/signup" className={styles.btnPrimary}>
                Start gratis proefperiode <ArrowRightIcon size={17} />
              </a>
              <a href="/pricing" className={styles.btnGhost}>
                Alle details bekijken (EN)
              </a>
            </div>
            <p className={styles.heroMeta}>30 dagen gratis · Geen creditcard · Altijd opzegbaar</p>
          </Reveal>
        </div>
      </section>

      {/* Plan cards */}
      <section className={styles.section}>
        <Reveal className={styles.sectionHead}>
          <p className={styles.eyebrow}>// Abonnementen</p>
          <h2 className={styles.sectionTitle}>Kies het abonnement dat bij je past</h2>
          <p className={styles.sectionSub}>
            Elk abonnement bevat Inbox en Contacten. Voeg modules toe op basis van wat je nodig hebt.
          </p>
        </Reveal>

        <div className={styles.pricingGrid}>
          {plans.map((plan, i) => (
            <Reveal
              key={plan.tier}
              className={`${styles.priceCard} ${plan.featured ? styles.priceFeatured : ""}`}
              delay={i * 60}
            >
              {plan.featured && <span className={styles.priceBadge}>Meest gekozen</span>}
              <p className={styles.priceTier}>{plan.tier}</p>
              <p className={styles.priceAmount}>
                €{plan.monthly}
                <sub>/mo</sub>
              </p>
              <p className={styles.priceBilling}>maandelijks gefactureerd</p>
              <p className={styles.priceDesc}>{plan.tagline}</p>
              <ul className={styles.priceFeatures}>
                {plan.features.map((f) => (
                  <li key={f}>
                    <CheckIcon size={15} className={styles.priceCheck} />
                    {f}
                  </li>
                ))}
              </ul>
              <a
                href="/signup"
                className={`${styles.priceBtn} ${plan.featured ? styles.priceBtnFeatured : ""}`}
              >
                Gratis starten
              </a>
            </Reveal>
          ))}
        </div>

        <div className={styles.pricingMore}>
          <a href="/pricing" className={styles.textLink}>
            Bekijk alle details, add-ons en Enterprise <ArrowRightIcon size={15} />
          </a>
        </div>
      </section>

      {/* Waarom Yippie */}
      <section className={styles.sectionLight}>
        <Reveal className={styles.sectionHead}>
          <p className={styles.eyebrow}>// Waarom Yippie</p>
          <h2 className={styles.sectionTitle}>Waarom teams kiezen voor Yippie</h2>
          <p className={styles.sectionSub}>
            Geen enterprise-prijzen, geen verborgen kosten. Gewoon eerlijke software voor MKB.
          </p>
        </Reveal>
        <div className={styles.featureRows}>
          {differentiators.map((d, i) => (
            <Reveal key={d.title} className={styles.featureRow} delay={i * 70}>
              <div className={styles.featureIcon}>
                <CheckIcon size={22} />
              </div>
              <div>
                <h3 className={styles.featureTitle}>{d.title}</h3>
                <p className={styles.featureDesc}>{d.desc}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className={styles.cta}>
        <Reveal className={styles.ctaCard}>
          <h2 className={styles.ctaTitle}>Klaar om te beginnen?</h2>
          <p className={styles.ctaSub}>
            30 dagen gratis uitproberen. Geen creditcard nodig. Je bent in minder dan een dag operationeel.
          </p>
          <a href="/signup" className={styles.btnPrimaryLg}>
            Start je gratis proefperiode <ArrowRightIcon size={18} />
          </a>
          <p className={styles.ctaSub} style={{ marginTop: 14 }}>
            <a href="/request-demo" style={{ color: "inherit", textDecoration: "underline" }}>
              Of vraag een begeleide demo aan
            </a>
          </p>
        </Reveal>
      </section>

      <SiteFooter />
    </>
  );
}
