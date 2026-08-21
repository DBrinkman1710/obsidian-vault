import type { Metadata } from "next";
import SiteNav from "@/app/components/SiteNav";
import SiteFooter from "@/app/components/SiteFooter";
import styles from "@/app/components/content.module.css";

const DEMO_URL = process.env.NEXT_PUBLIC_DEMO_URL ?? "/request-demo";

export const metadata: Metadata = {
  title: "Yippie vs Front | The SMB-Friendly Front Alternative",
  description:
    "Looking for a Front alternative for small business? Yippie is purpose-built help desk software for SMBs with booking, AI ticket drafting, and flat workspace pricing from €19/month.",
  alternates: { canonical: "/en/vs-front" },
  openGraph: {
    title: "Yippie vs Front | The SMB-Friendly Alternative",
    description:
      "A deeper, flat-priced Front alternative built for SMBs. Full ticketing, booking, and AI drafting included, from €19/month.",
    url: "https://getyippie.com/vs-front",
    type: "website",
  },
};

type Cell = "yes" | "no" | string;
const rows: { feature: string; yippie: Cell; other: Cell }[] = [
  { feature: "Flat workspace pricing", yippie: "yes", other: "no" },
  { feature: "Built-in booking system", yippie: "yes", other: "no" },
  { feature: "AI ticket drafting", yippie: "yes", other: "Limited" },
  { feature: "Purpose-built for SMBs", yippie: "yes", other: "Inbox-only focus" },
  { feature: "Kanban pipeline", yippie: "yes", other: "no" },
  { feature: "Starting price", yippie: "from €19 / month", other: "~€19 / user / mo" },
];

function CellView({ value }: { value: Cell }) {
  if (value === "yes") return <span className={styles.yes} aria-label="Yes">Yes</span>;
  if (value === "no") return <span className={styles.no} aria-label="No">No</span>;
  return <span className={styles.partial}>{value}</span>;
}

export default function VsFrontPage() {
  return (
    <div className={styles.page}>
      <SiteNav />

      <section className={styles.hero}>
        <img src="/logo-white-bg-mark.svg" alt="" aria-hidden="true" className={styles.pageLogoMark} />
        <div className={styles.heroTag}>
          <span className={styles.heroTagDot} />
          Yippie vs Front
        </div>
        <h1 className={styles.heroTitle}>Yippie vs Front: the SMB-friendly alternative</h1>
        <p className={styles.heroSub}>
          Front is a polished shared inbox tool, but it stops there. If you need
          full support ticketing depth, a built-in booking system, or a kanban
          pipeline alongside your inbox, you will hit its limits quickly — and
          its per-user pricing stacks up fast. Yippie is purpose-built for small
          and medium businesses that need more than a shared inbox.
        </p>
        <p className={styles.heroSub}>
          In short: Yippie is a Front alternative for small teams with flat
          workspace pricing from €19 per month, unlimited contacts on every plan,
          AI drafted tickets, and booking built in — while Front charges roughly
          €19 per user per month and focuses solely on the inbox experience.
        </p>
        <div className={styles.heroActions}>
          <a href={DEMO_URL} className={styles.btnPrimary}>Request demo →</a>
          <a href="/en/modules" className={styles.btnGhost}>See all features</a>
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionInner}>
          <p className={styles.eyebrow}>Side by side</p>
          <h2 className={styles.sectionTitle}>How Yippie compares to Front</h2>
          <p className={styles.sectionSub}>
            All the inbox convenience of Front, plus full ticketing, booking,
            and AI drafting — at a flat workspace price.
          </p>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Feature</th>
                  <th className={styles.colYippie}>Yippie</th>
                  <th>Front</th>
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
          <h2 className={styles.sectionTitle}>More than an inbox</h2>
          <div className={styles.grid}>
            <div className={styles.card}>
              <h3 className={styles.cardTitle}>Flat, predictable pricing</h3>
              <p className={styles.cardDesc}>
                Pay per workspace from €19/month, not €19+ per user. Add teammates
                without watching the bill climb every time you grow your team.
              </p>
            </div>
            <div className={styles.card}>
              <h3 className={styles.cardTitle}>Full support depth, built in</h3>
              <p className={styles.cardDesc}>
                Go beyond shared inbox: AI ticket drafting, kanban pipeline, and
                a built-in booking system — all ready from day one, no plugins
                or integrations needed.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className={styles.ctaSection}>
        <h2 className={styles.ctaTitle}>Switch to support that fits your business</h2>
        <p className={styles.ctaSub}>
          See why SMBs choose Yippie over Front. Try the instant demo. No
          credit card required.
        </p>
        <a href={DEMO_URL} className={styles.btnPrimary}>Request demo →</a>
      </section>

      <SiteFooter />
    </div>
  );
}
