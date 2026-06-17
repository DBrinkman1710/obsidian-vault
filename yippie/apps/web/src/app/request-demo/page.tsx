import type { Metadata } from "next";
import SiteNav from "../components/SiteNav";
import SiteFooter from "../components/SiteFooter";
import styles from "../components/content.module.css";
import formStyles from "./request-demo.module.css";
import DemoForm from "./DemoForm";

export const metadata: Metadata = {
  title: "Request a demo — Yippie",
  description:
    "See Yippie in action. Book a personalised demo and watch AI turn a messy support inbox into resolved tickets in seconds.",
  alternates: { canonical: "/request-demo" },
  openGraph: {
    title: "Request a demo — Yippie",
    description:
      "See Yippie in action. Book a personalised demo and watch AI turn a messy support inbox into resolved tickets in seconds.",
    url: "https://getyippie.com/request-demo",
    type: "website",
  },
};

export default function RequestDemoPage() {
  return (
    <div className={styles.page}>
      <SiteNav />

      <section className={styles.hero}>
        <div className={styles.heroTag}>
          <span className={styles.heroTagDot} />
          Request a demo
        </div>
        <h1 className={styles.heroTitle}>See Yippie on your own inbox</h1>
        <p className={styles.heroSub}>
          Fill in the form and we&apos;ll schedule a personalised walkthrough —
          no sales pressure, just a real look at how Yippie saves your team
          hours every week.
        </p>
      </section>

      <div className={formStyles.wrap}>
        <DemoForm />
      </div>

      <SiteFooter />
    </div>
  );
}
