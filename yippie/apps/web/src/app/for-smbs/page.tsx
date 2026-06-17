import type { Metadata } from "next";
import SiteNav from "../components/SiteNav";
import SiteFooter from "../components/SiteFooter";
import styles from "../components/content.module.css";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.getyippie.com";
const DEMO_URL = process.env.NEXT_PUBLIC_DEMO_URL ?? APP_URL;

export const metadata: Metadata = {
  title: "Yippie for Small Businesses — AI customer service that saves hours",
  description:
    "Built for small businesses that take customer service seriously. AI inbox triage, ticket SLAs, and booking links help SMBs save 10+ hours a week.",
  alternates: { canonical: "/for-smbs" },
  openGraph: {
    title: "Yippie for Small Businesses",
    description:
      "AI inbox triage, ticket SLAs, and booking links built for SMBs. Save 10+ hours a week on customer service.",
    url: "https://getyippie.com/for-smbs",
    type: "website",
  },
};

const painSolutions = [
  {
    pain: "Your inbox is chaos — support, sales, and personal mail all tangled together, and important messages get buried.",
    solve: "AI inbox triage reads every message, drafts a ticket with subject and priority, and surfaces what needs you first. One place, sorted.",
  },
  {
    pain: "Tickets fall through the cracks. A customer asks something on Monday and nobody follows up until they complain on Friday.",
    solve: "Ticket SLAs with deadline badges and alerts fire before anything slips. Assign, escalate, and close — nothing gets forgotten.",
  },
  {
    pain: "You never have time to follow up — booking a call means five emails back and forth to find a slot.",
    solve: "Send a booking link and the customer picks a time, or you propose slots. Confirmation emails go out automatically. Done in one message.",
  },
];

export default function ForSmbsPage() {
  return (
    <div className={styles.page}>
      <SiteNav />

      <section className={styles.hero}>
        <div className={styles.heroTag}>
          <span className={styles.heroTagDot} />
          For small businesses
        </div>
        <h1 className={styles.heroTitle}>
          Built for small businesses that take customer service seriously
        </h1>
        <p className={styles.heroSub}>
          You don&apos;t have a 20-person support team — you have you. Yippie gives
          small businesses the AI leverage to deliver fast, personal support
          without drowning in the inbox.
        </p>
        <div className={styles.heroActions}>
          <a href={DEMO_URL} className={styles.btnPrimary}>Request demo →</a>
          <a href="/modules" className={styles.btnGhost}>See all features</a>
        </div>
      </section>

      <section className={styles.section}>
        <p className={styles.eyebrow}>The problem</p>
        <h2 className={styles.sectionTitle}>The everyday struggles — solved</h2>
        <p className={styles.sectionSub}>
          Three things slow every small business down. Here is how Yippie fixes
          each one.
        </p>
        <div className={styles.rows}>
          {painSolutions.map((row, i) => (
            <div key={i} className={styles.row}>
              <div className={styles.painCard}>
                <div className={`${styles.painLabel} ${styles.painLabelBad}`}>The pain</div>
                <p className={styles.painText}>{row.pain}</p>
              </div>
              <div className={styles.solveCard}>
                <div className={`${styles.painLabel} ${styles.painLabelGood}`}>With Yippie</div>
                <p className={styles.painText}>{row.solve}</p>
              </div>
            </div>
          ))}
        </div>

        <div className={styles.proof}>
          <p className={styles.proofText}>Join 100+ SMBs saving 10+ hours/week</p>
          <p className={styles.proofSub}>
            Thousands of hours of customer service already automated by Yippie — and counting.
          </p>
        </div>
      </section>

      <section className={styles.ctaSection}>
        <h2 className={styles.ctaTitle}>Get your time back</h2>
        <p className={styles.ctaSub}>
          See how Yippie handles your real support inbox. Book a demo — no credit
          card required.
        </p>
        <a href={DEMO_URL} className={styles.btnPrimary}>Request demo →</a>
      </section>

      <SiteFooter />
    </div>
  );
}
