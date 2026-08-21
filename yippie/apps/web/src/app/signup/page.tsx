import type { Metadata } from "next";
import { Suspense } from "react";
import SiteNav from "../components/SiteNav";
import SiteFooter from "../components/SiteFooter";
import styles from "../components/content.module.css";
import customStyles from "../custom/custom.module.css";
import OnboardingForm from "../custom/CustomForm";

export const metadata: Metadata = {
  title: "Start je gratis proefperiode van 30 dagen | Yippie",
  description:
    "Bouw je eigen Yippie-werkruimte in een paar minuten. De eerste 30 dagen gratis, geen betaalgegevens nodig.",
  alternates: { canonical: "/signup" },
  openGraph: {
    title: "Start je gratis proefperiode van 30 dagen | Yippie",
    description:
      "Bouw je eigen Yippie-werkruimte in een paar minuten. De eerste 30 dagen gratis, geen betaalgegevens nodig.",
    url: "https://getyippie.com/signup",
    type: "website",
    images: ["/og.png"],
  },
};

export default function SignupPage() {
  return (
    <div className={styles.page}>
      <SiteNav />

      <section className={styles.hero}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo-white-bg-mark.svg" alt="" aria-hidden="true" className={styles.pageLogoMark} />
        <div className={styles.heroTag}>
          <span className={styles.heroTagDot} />
          Aan de slag
        </div>
        <h1 className={styles.heroTitle}>Bouw je werkruimte</h1>
        <p className={styles.heroSub}>
          Beantwoord een paar snelle vragen, zie je werkruimte vorm krijgen en
          stap er via de link die we je mailen direct in. De eerste 30 dagen
          gratis, geen betaalgegevens nodig.
        </p>
      </section>

      <div className={customStyles.wrap}>
        <Suspense fallback={null}>
          <OnboardingForm />
        </Suspense>
      </div>

      <SiteFooter />
    </div>
  );
}
