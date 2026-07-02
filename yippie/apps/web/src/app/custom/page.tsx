import type { Metadata } from "next";
import SiteNav from "../components/SiteNav";
import SiteFooter from "../components/SiteFooter";
import styles from "../components/content.module.css";
import customStyles from "./custom.module.css";
import CustomForm from "./CustomForm";

export const metadata: Metadata = {
  title: "Build your package — Yippie",
  description:
    "Answer a few quick questions and we'll put together a personalised plan with exactly the modules your team needs — no guesswork, no bloat.",
  alternates: { canonical: "/custom" },
  openGraph: {
    title: "Build your package — Yippie",
    description:
      "Answer a few quick questions and we'll put together a personalised plan with exactly the modules your team needs — no guesswork, no bloat.",
    url: "https://getyippie.com/custom",
    type: "website",
  },
};

export default function CustomPage() {
  return (
    <div className={styles.page}>
      <SiteNav />

      <section className={styles.hero}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo-white-bg-mark.svg" alt="" aria-hidden="true" className={styles.pageLogoMark} />
        <div className={styles.heroTag}>
          <span className={styles.heroTagDot} />
          Build your package
        </div>
        <h1 className={styles.heroTitle}>Your plan, your modules</h1>
        <p className={styles.heroSub}>
          Tell us about your team and we&apos;ll put together a personalised package —
          no guesswork, no modules you&apos;ll never use.
        </p>
      </section>

      <div className={customStyles.wrap}>
        <CustomForm />
      </div>

      <SiteFooter />
    </div>
  );
}
