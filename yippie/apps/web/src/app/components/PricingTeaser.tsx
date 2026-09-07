"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import Reveal from "./Reveal";
import { CheckIcon } from "./icons";
import { PLAN_LIMITS } from "@/lib/config";
import { getLocale, localizeHref } from "@/lib/i18n";
import styles from "../page.module.css";

type TeaserPlan = {
  tier: string;
  monthly: number | null;
  annual: number | null;
  users: number | null;
  desc: string;
  features: string[];
  featured: boolean;
};

const planData = {
  nl: [
    {
      tier: "Starter",
      monthly: PLAN_LIMITS.starter.priceMonthly,
      annual: PLAN_LIMITS.starter.priceAnnual,
      users: PLAN_LIMITS.starter.users,
      desc: "Voor kleine teams die net beginnen",
      features: ["Inbox + Contacten", `${PLAN_LIMITS.starter.users} gebruikers`, "Onbeperkte contacten", "2.000 AI-scans/mnd", "Add-ons à la carte"],
      featured: false,
    },
    {
      tier: "Growth",
      monthly: PLAN_LIMITS.growth.priceMonthly,
      annual: PLAN_LIMITS.growth.priceAnnual,
      users: PLAN_LIMITS.growth.users,
      desc: "Voor groeiende teams met echt volume",
      features: ["Inbox + Contacten", `${PLAN_LIMITS.growth.users} gebruikers`, "Onbeperkte contacten", "5.000 AI-scans/mnd", "Add-ons à la carte"],
      featured: false,
    },
    {
      tier: "Pro",
      monthly: PLAN_LIMITS.pro.priceMonthly,
      annual: PLAN_LIMITS.pro.priceAnnual,
      users: PLAN_LIMITS.pro.users,
      desc: "Voor gevestigde supportafdelingen",
      features: ["Inbox + Contacten", `${PLAN_LIMITS.pro.users} gebruikers`, "Onbeperkte contacten", "10.000 AI-scans/mnd", "Add-ons à la carte"],
      featured: true,
    },
    {
      tier: "Enterprise",
      monthly: null,
      annual: null,
      users: null,
      desc: "Toegewijd groeipartnerschap",
      features: ["Alle modules inbegrepen", "Onbeperkt gebruikers + contacten", "Onbeperkte AI-scans", "Toegewijde support + SLA"],
      featured: false,
    },
  ] as TeaserPlan[],
  en: [
    {
      tier: "Starter",
      monthly: PLAN_LIMITS.starter.priceMonthly,
      annual: PLAN_LIMITS.starter.priceAnnual,
      users: PLAN_LIMITS.starter.users,
      desc: "For small teams getting started",
      features: ["Inbox + Contacts", `${PLAN_LIMITS.starter.users} users`, "Unlimited contacts", "2,000 AI scans/mo", "Add-ons à la carte"],
      featured: false,
    },
    {
      tier: "Growth",
      monthly: PLAN_LIMITS.growth.priceMonthly,
      annual: PLAN_LIMITS.growth.priceAnnual,
      users: PLAN_LIMITS.growth.users,
      desc: "For growing teams handling real volume",
      features: ["Inbox + Contacts", `${PLAN_LIMITS.growth.users} users`, "Unlimited contacts", "5,000 AI scans/mo", "Add-ons à la carte"],
      featured: false,
    },
    {
      tier: "Pro",
      monthly: PLAN_LIMITS.pro.priceMonthly,
      annual: PLAN_LIMITS.pro.priceAnnual,
      users: PLAN_LIMITS.pro.users,
      desc: "For established support operations",
      features: ["Inbox + Contacts", `${PLAN_LIMITS.pro.users} users`, "Unlimited contacts", "10,000 AI scans/mo", "Add-ons à la carte"],
      featured: true,
    },
    {
      tier: "Enterprise",
      monthly: null,
      annual: null,
      users: null,
      desc: "Dedicated growth partnership",
      features: ["All modules included", "Unlimited users + contacts", "Unlimited AI scans", "Dedicated support + SLA"],
      featured: false,
    },
  ] as TeaserPlan[],
};

const copy = {
  nl: {
    monthly: "Maandelijks",
    annual: "Jaarlijks",
    save: "Bespaar 10%",
    mostPopular: "Meest gekozen",
    custom: "Op maat",
    yr: "/jr",
    mo: "/mnd",
    perUserMo: (perUser: number, users: number | null) =>
      `≈ €${perUser}/gebruiker/mnd voor max ${users} gebruikers`,
    saveDiscount: (saved: number, was: number) =>
      `Bespaar €${saved}/jr (was €${was})`,
    billedAnnually: "jaarlijks gefactureerd",
    billedMonthly: "maandelijks gefactureerd",
    contactUs: "Neem contact op",
    viewPlan: "Bekijk abonnement",
  },
  en: {
    monthly: "Monthly",
    annual: "Annual",
    save: "Save 10%",
    mostPopular: "Most popular",
    custom: "Custom",
    yr: "/yr",
    mo: "/mo",
    perUserMo: (perUser: number, users: number | null) =>
      `≈ €${perUser}/user/mo for up to ${users} users`,
    saveDiscount: (saved: number, was: number) =>
      `Save €${saved}/yr (was €${was})`,
    billedAnnually: "billed annually",
    billedMonthly: "billed monthly",
    contactUs: "Contact us",
    viewPlan: "View plan",
  },
} as const;

export default function PricingTeaser() {
  const [annual, setAnnual] = useState(false);
  const pathname = usePathname();
  const locale = getLocale(pathname);
  const t = copy[locale];
  const plans = planData[locale];

  return (
    <>
      <div className={styles.toggleWrap}>
        <div className={styles.toggle}>
          <button
            type="button"
            className={`${styles.toggleOption} ${!annual ? styles.toggleActive : ""}`}
            onClick={() => setAnnual(false)}
          >
            {t.monthly}
          </button>
          <button
            type="button"
            className={`${styles.toggleOption} ${annual ? styles.toggleActive : ""}`}
            onClick={() => setAnnual(true)}
          >
            {t.annual}
            <span className={styles.toggleSave}>{t.save}</span>
          </button>
        </div>
      </div>

      <div className={styles.pricingGrid}>
        {plans.map((plan, i) => {
          const price = annual ? plan.annual : plan.monthly;
          // Per-user framing so the headline price is never shown in isolation:
          // a small monthly figure per seat anchors the value.
          const perUser = plan.monthly != null && plan.users
            ? Math.round(plan.monthly / plan.users)
            : null;
          return (
            <Reveal
              key={plan.tier}
              className={`${styles.priceCard} ${plan.featured ? styles.priceFeatured : ""}`}
              delay={i * 60}
            >
              {plan.featured && <span className={styles.priceBadge}>{t.mostPopular}</span>}
              <p className={styles.priceTier}>{plan.tier}</p>
              <p className={styles.priceAmount}>
                {price == null ? t.custom : `€${price}`}
                {price != null && <sub>{annual ? t.yr : t.mo}</sub>}
              </p>
              {price != null && annual && plan.monthly != null && plan.annual != null && (
                <p className={styles.priceDiscount}>
                  {t.saveDiscount(plan.monthly * 12 - plan.annual, plan.monthly * 12)}
                </p>
              )}
              {perUser != null && (
                <p className={styles.priceUser}>{t.perUserMo(perUser, plan.users)}</p>
              )}
              {price != null && (
                <p className={styles.priceBilling}>{annual ? t.billedAnnually : t.billedMonthly}</p>
              )}
              <p className={styles.priceDesc}>{plan.desc}</p>
              <ul className={styles.priceFeatures}>
                {plan.features.map((f) => (
                  <li key={f}><CheckIcon size={15} className={styles.priceCheck} />{f}</li>
                ))}
              </ul>
              <a href={localizeHref("/pricing", locale)} className={`${styles.priceBtn} ${plan.featured ? styles.priceBtnFeatured : ""}`}>
                {plan.tier === "Enterprise" ? t.contactUs : t.viewPlan}
              </a>
            </Reveal>
          );
        })}
      </div>
    </>
  );
}
