"use client";

import { useState } from "react";
import Reveal from "./Reveal";
import { CheckIcon } from "./icons";
import { PLAN_LIMITS } from "@/lib/config";
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

const plans: TeaserPlan[] = [
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
];

export default function PricingTeaser() {
  const [annual, setAnnual] = useState(false);

  return (
    <>
      <div className={styles.toggleWrap}>
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
              {plan.featured && <span className={styles.priceBadge}>Most popular</span>}
              <p className={styles.priceTier}>{plan.tier}</p>
              <p className={styles.priceAmount}>
                {price == null ? "Custom" : `€${price}`}
                {price != null && <sub>{annual ? "/yr" : "/mo"}</sub>}
              </p>
              {price != null && annual && plan.monthly != null && plan.annual != null && (
                <p className={styles.priceDiscount}>
                  Save €{plan.monthly * 12 - plan.annual}/yr (was €{plan.monthly * 12})
                </p>
              )}
              {perUser != null && (
                <p className={styles.priceUser}>≈ €{perUser}/user/mo for up to {plan.users} users</p>
              )}
              {price != null && (
                <p className={styles.priceBilling}>{annual ? "billed annually" : "billed monthly"}</p>
              )}
              <p className={styles.priceDesc}>{plan.desc}</p>
              <ul className={styles.priceFeatures}>
                {plan.features.map((f) => (
                  <li key={f}><CheckIcon size={15} className={styles.priceCheck} />{f}</li>
                ))}
              </ul>
              <a href="/pricing" className={`${styles.priceBtn} ${plan.featured ? styles.priceBtnFeatured : ""}`}>
                {plan.tier === "Enterprise" ? "Contact us" : "View plan"}
              </a>
            </Reveal>
          );
        })}
      </div>
    </>
  );
}
