import type { Metadata } from "next";
import SiteNav from "../components/SiteNav";
import SiteFooter from "../components/SiteFooter";
import styles from "../components/content.module.css";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.getyippie.com";
const DEMO_URL = process.env.NEXT_PUBLIC_DEMO_URL ?? APP_URL;

export const metadata: Metadata = {
  title: "Yippie vs Zendesk — The SMB-Friendly Zendesk Alternative",
  description:
    "Looking for a Zendesk alternative for small business? Yippie is purpose-built help desk software for SMBs — AI inbox triage, booking, and flat workspace pricing from €9.",
  alternates: { canonical: "/vs-zendesk" },
  openGraph: {
    title: "Yippie vs Zendesk — The SMB-Friendly Alternative",
    description:
      "A simpler, flat-priced Zendesk alternative built for SMBs. AI inbox triage, booking, and easy onboarding included.",
    url: "https://getyippie.com/vs-zendesk",
    type: "website",
  },
};

type Cell = "yes" | "no" | string;
const rows: { feature: string; yippie: Cell; other: Cell }[] = [
  { feature: "AI inbox triage included", yippie: "yes", other: "Paid add-on" },
  { feature: "Flat workspace pricing", yippie: "yes", other: "no" },
  { feature: "Built-in booking system", yippie: "yes", other: "no" },
  { feature: "Easy onboarding (live in a day)", yippie: "yes", other: "Complex setup" },
  { feature: "Purpose-built for SMBs", yippie: "yes", other: "Enterprise-first" },
  { feature: "Kanban pipeline", yippie: "yes", other: "no" },
  { feature: "Starting price", yippie: "from €9 / workspace", other: "~€55 / agent / mo" },
];

function CellView({ value }: { value: Cell }) {
  if (value === "yes") return <span className={styles.yes} aria-label="Yes">✓</span>;
  if (value === "no") return <span className={styles.no} aria-label="No">✗</span>;
  return <span className={styles.partial}>{value}</span>;
}

export default function VsZendeskPage() {
  return (
    <div className={styles.page}>
      <SiteNav />

      <section className={styles.hero}>
        <div className={styles.heroTag}>
          <span className={styles.heroTagDot} />
          Yippie vs Zendesk
        </div>
        <h1 className={styles.heroTitle}>Yippie vs Zendesk — the SMB-friendly alternative</h1>
        <p className={styles.heroSub}>
          Zendesk is powerful, enterprise-grade customer support software — and
          priced like it. Yippie is purpose-built for small and medium businesses:
          simpler, faster to set up, and flat workspace pricing instead of
          per-agent fees that climb as you grow.
        </p>
        <div className={styles.heroActions}>
          <a href={DEMO_URL} className={styles.btnPrimary}>Try Yippie free →</a>
          <a href="/modules" className={styles.btnGhost}>See all features</a>
        </div>
      </section>

      <section className={styles.section}>
        <p className={styles.eyebrow}>Side by side</p>
        <h2 className={styles.sectionTitle}>How Yippie compares to Zendesk</h2>
        <p className={styles.sectionSub}>
          Same core help desk capabilities — without the enterprise price tag or
          setup overhead.
        </p>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Feature</th>
                <th className={styles.colYippie}>Yippie</th>
                <th>Zendesk</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.feature}>
                  <td>{r.feature}</td>
                  <td className={styles.center}><CellView value={r.yippie} /></td>
                  <td className={styles.center}><CellView value={r.other} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className={styles.sectionLight}>
        <p className={styles.eyebrow}>Why SMBs switch</p>
        <h2 className={styles.sectionTitle}>Built for your size, not theirs</h2>
        <div className={styles.grid}>
          <div className={styles.card}>
            <div className={styles.iconWrap}>💸</div>
            <h3 className={styles.cardTitle}>Flat, predictable pricing</h3>
            <p className={styles.cardDesc}>
              Pay per workspace from €9, not €55+ per agent. Add teammates without
              watching the bill balloon every time you hire.
            </p>
          </div>
          <div className={styles.card}>
            <div className={styles.iconWrap}>⚡</div>
            <h3 className={styles.cardTitle}>Live in a day, not a quarter</h3>
            <p className={styles.cardDesc}>
              No implementation consultant required. Connect your inbox, invite
              your team, and you are answering tickets the same afternoon.
            </p>
          </div>
          <div className={styles.card}>
            <div className={styles.iconWrap}>🤖</div>
            <h3 className={styles.cardTitle}>AI included, not upsold</h3>
            <p className={styles.cardDesc}>
              Inbox triage, suggested replies, and customer briefings come standard
              — no premium AI tier to unlock the features that save you time.
            </p>
          </div>
        </div>
      </section>

      <section className={styles.ctaSection}>
        <h2 className={styles.ctaTitle}>Switch to support that fits your business</h2>
        <p className={styles.ctaSub}>
          See why SMBs choose Yippie over Zendesk. Try it free — no credit card
          required.
        </p>
        <a href={DEMO_URL} className={styles.btnPrimary}>Try Yippie free →</a>
      </section>

      <SiteFooter />
    </div>
  );
}
