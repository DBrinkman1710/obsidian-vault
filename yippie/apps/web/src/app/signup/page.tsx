import type { Metadata } from "next";
import { Suspense } from "react";
import SiteNav from "../components/SiteNav";
import SiteFooter from "../components/SiteFooter";
import styles from "../components/content.module.css";
import customStyles from "../custom/custom.module.css";
import OnboardingForm from "../custom/CustomForm";

export const metadata: Metadata = {
  title: "Start your free 30 day trial | Yippie",
  description:
    "Build your own Yippie workspace in minutes. First 30 days free, no payment details needed.",
  alternates: { canonical: "/signup" },
  openGraph: {
    title: "Start your free 30 day trial | Yippie",
    description:
      "Build your own Yippie workspace in minutes. First 30 days free, no payment details needed.",
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
          Get started
        </div>
        <h1 className={styles.heroTitle}>Build your workspace</h1>
        <p className={styles.heroSub}>
          Answer a few quick questions, watch your workspace take shape, and
          step in through the link we mail you. First 30 days free — no payment
          details needed.
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
