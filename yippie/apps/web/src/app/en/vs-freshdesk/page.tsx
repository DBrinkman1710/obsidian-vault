import type { Metadata } from "next";
import SiteNav from "@/app/components/SiteNav";
import SiteFooter from "@/app/components/SiteFooter";
import styles from "@/app/components/content.module.css";

const DEMO_URL = process.env.NEXT_PUBLIC_DEMO_URL ?? "/request-demo";

export const metadata: Metadata = {
  title: "Yippie vs Freshdesk | The SMB-Friendly Freshdesk Alternative",
  description:
    "Looking for a Freshdesk alternative for small business? Yippie is purpose-built help desk software for SMBs with booking and flat workspace pricing from €19/month.",
  alternates: { canonical: "/en/vs-freshdesk" },
  openGraph: {
    title: "Yippie vs Freshdesk | The SMB-Friendly Alternative",
    description:
      "A simpler, flat-priced Freshdesk alternative built for SMBs. Booking and easy onboarding included, from €19/month.",
    url: "https://getyippie.com/vs-freshdesk",
    type: "website",
  },
};

type Cell = "yes" | "no" | string;
const rows: { feature: string; yippie: Cell; other: Cell }[] = [
  { feature: "Flat workspace pricing", yippie: "yes", other: "no" },
  { feature: "Built-in booking system", yippie: "yes", other: "no" },
  { feature: "Easy onboarding (live in a day)", yippie: "yes", other: "Complex setup" },
  { feature: "Purpose-built for SMBs", yippie: "yes", other: "Enterprise-first" },
  { feature: "Kanban pipeline", yippie: "yes", other: "no" },
  { feature: "Starting price", yippie: "from €19 / month", other: "~€15 / agent / mo" },
];

function CellView({ value }: { value: Cell }) {
  if (value === "yes") return <span className={styles.yes} aria-label="Yes">Yes</span>;
  if (value === "no") return <span className={styles.no} aria-label="No">No</span>;
  return <span className={styles.partial}>{value}</span>;
}

export default function VsFreshdeskPage() {
  return (
    <div className={styles.page}>
      <SiteNav />

      <section className={styles.hero}>
        <img src="/logo-white-bg-mark.svg" alt="" aria-hidden="true" className={styles.pageLogoMark} />
        <div className={styles.heroTag}>
          <span className={styles.heroTagDot} />
          Yippie vs Freshdesk
        </div>
        <h1 className={styles.heroTitle}>Yippie vs Freshdesk: the SMB-friendly alternative</h1>
        <p className={styles.heroSub}>
          Freshdesk offers a broad feature set built for complex support
          operations, but that breadth comes with a learning curve and per-agent
          pricing that grows with every new hire. Yippie is purpose-built for
          small and medium businesses: simpler, faster to set up, and flat
          workspace pricing instead of per-agent fees.
        </p>
        <p className={styles.heroSub}>
          In short: Yippie is a Freshdesk alternative for small teams with flat
          workspace pricing from €19 per month, unlimited contacts on every plan,
          AI drafted tickets, and booking built in — while Freshdesk charges
          roughly €15 per agent per month and is designed with enterprise
          complexity in mind.
        </p>
        <div className={styles.heroActions}>
          <a href={DEMO_URL} className={styles.btnPrimary}>Request demo →</a>
          <a href="/en/modules" className={styles.btnGhost}>See all features</a>
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionInner}>
          <p className={styles.eyebrow}>Side by side</p>
          <h2 className={styles.sectionTitle}>How Yippie compares to Freshdesk</h2>
          <p className={styles.sectionSub}>
            Same core help desk capabilities, without the per-agent pricing or
            setup overhead.
          </p>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Feature</th>
                  <th className={styles.colYippie}>Yippie</th>
                  <th>Freshdesk</th>
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
        </div>
      </section>

      <section className={styles.sectionLight}>
        <div className={styles.sectionInner}>
          <p className={styles.eyebrow}>Why SMBs switch</p>
          <h2 className={styles.sectionTitle}>Built for your size, not theirs</h2>
          <div className={styles.grid}>
            <div className={styles.card}>
              <h3 className={styles.cardTitle}>Flat, predictable pricing</h3>
              <p className={styles.cardDesc}>
                Pay per workspace from €19/month, not €15+ per agent. Add teammates
                without watching the bill climb every time you hire.
              </p>
            </div>
            <div className={styles.card}>
              <h3 className={styles.cardTitle}>Live in a day, not a quarter</h3>
              <p className={styles.cardDesc}>
                No complex configuration required. Connect your inbox, invite
                your team, and you are answering tickets the same afternoon.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className={styles.ctaSection}>
        <h2 className={styles.ctaTitle}>Switch to support that fits your business</h2>
        <p className={styles.ctaSub}>
          See why SMBs choose Yippie over Freshdesk. Try the instant demo. No
          credit card required.
        </p>
        <a href={DEMO_URL} className={styles.btnPrimary}>Request demo →</a>
      </section>

      <SiteFooter />
    </div>
  );
}
