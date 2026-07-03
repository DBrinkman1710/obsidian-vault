import type { Metadata } from "next";
import SiteNav from "../components/SiteNav";
import SiteFooter from "../components/SiteFooter";
import styles from "../components/content.module.css";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.getyippie.com";
const DEMO_URL = process.env.NEXT_PUBLIC_DEMO_URL ?? APP_URL;

export const metadata: Metadata = {
  title: "Yippie for Agencies | Multi-client help desk & shared inbox software",
  description:
    "Manage client communication at scale with Yippie's multi-tenant help desk software. Shared inbox, contact labels, companies, and campaign emails keep every client account organized.",
  alternates: { canonical: "/for-agencies" },
  openGraph: {
    title: "Yippie for Agencies | Multi-client customer support software",
    description:
      "Multi-tenant shared inbox, contact labels, and campaign emails for agencies managing customer support across many clients.",
    url: "https://getyippie.com/for-agencies",
    type: "website",
  },
};

const painSolutions = [
  {
    pain: "Every client has their own inbox, login, and tool. Switching between five accounts a day kills your focus and your margins.",
    solve: "Yippie is multi-tenant by design. Each client lives in its own isolated workspace, and your team manages them all from one customer support platform. No more password juggling.",
  },
  {
    pain: "Constant context switching means you forget where a conversation left off, and clients notice the dropped ball.",
    solve: "A unified shared inbox with contact labels and company grouping keeps every conversation, ticket, and pipeline stage tied to the right client account. Pick up exactly where you left off.",
  },
  {
    pain: "Keeping clients updated is a chore. Manual status emails eat your week and still feel impersonal.",
    solve: "Campaign emails with rich templates and tracking let you send polished, on-brand updates at scale. For your own sales pipeline, contacts auto-advance through Kanban stages when they click an action button, so your pipeline stays current without lifting a finger.",
  },
  {
    pain: "Other platforms charge more per client contact, making growth an expensive problem rather than a win.",
    solve: "Every workspace gets unlimited contacts. Add clients, grow their databases, and scale your agency without worrying about hitting a quota.",
  },
];

export default function ForAgenciesPage() {
  return (
    <div className={styles.page}>
      <SiteNav />

      <section className={styles.hero}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo-white-bg-mark.svg" alt="" aria-hidden="true" className={styles.pageLogoMark} />
        <div className={styles.heroTag}>
          <span className={styles.heroTagDot} />
          For agencies
        </div>
        <h1 className={styles.heroTitle}>
          Manage client communication at scale, without losing the personal touch
        </h1>
        <p className={styles.heroSub}>
          Yippie is the multi-client help desk software agencies use to run
          customer support across every account. One shared inbox, clean tenant
          isolation, and AI doing the heavy lifting.
        </p>
        <div className={styles.heroActions}>
          <a href={DEMO_URL} className={styles.btnPrimary}>Request demo →</a>
          <a href="/modules" className={styles.btnGhost}>See all features</a>
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionInner}>
          <p className={styles.eyebrow}>The problem</p>
          <h2 className={styles.sectionTitle}>Agency support, without the chaos</h2>
          <p className={styles.sectionSub}>
            The hidden costs of managing many clients, and how Yippie removes them.
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
        </div>
      </section>

      <section className={styles.ctaSection}>
        <h2 className={styles.ctaTitle}>Run every client from one platform</h2>
        <p className={styles.ctaSub}>
          See how agencies use Yippie to scale customer support without scaling
          headcount. Book a demo today.
        </p>
        <a href={DEMO_URL} className={styles.btnPrimary}>Request demo →</a>
      </section>

      <SiteFooter />
    </div>
  );
}
