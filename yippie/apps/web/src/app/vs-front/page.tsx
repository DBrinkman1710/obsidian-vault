import type { Metadata } from "next";
import SiteNav from "../components/SiteNav";
import SiteFooter from "../components/SiteFooter";
import styles from "../components/content.module.css";

const DEMO_URL = process.env.NEXT_PUBLIC_DEMO_URL ?? "/request-demo";

export const metadata: Metadata = {
  title: "Yippie vs Front | Het MKB-vriendelijke Front-alternatief",
  description:
    "Op zoek naar een Front-alternatief voor je kleine bedrijf? Yippie is helpdesksoftware speciaal voor het MKB, met boekingen, AI-ticketopstelling en vaste werkruimteprijzen vanaf €19 per maand.",
  alternates: { canonical: "/vs-front" },
  openGraph: {
    title: "Yippie vs Front | Het MKB-vriendelijke alternatief",
    description:
      "Een uitgebreider Front-alternatief met vaste prijs, gebouwd voor het MKB. Volledige ticketing, boekingen en AI-opstelling inbegrepen, vanaf €19 per maand.",
    url: "https://getyippie.com/vs-front",
    type: "website",
  },
};

type Cell = "yes" | "no" | string;
const rows: { feature: string; yippie: Cell; other: Cell }[] = [
  { feature: "Vaste werkruimteprijs", yippie: "yes", other: "no" },
  { feature: "Ingebouwd boekingssysteem", yippie: "yes", other: "no" },
  { feature: "AI-ticketopstelling", yippie: "yes", other: "Beperkt" },
  { feature: "Speciaal gebouwd voor het MKB", yippie: "yes", other: "Alleen inbox" },
  { feature: "Kanban-pipeline", yippie: "yes", other: "no" },
  { feature: "Startprijs", yippie: "vanaf €19 / mnd", other: "~€19 / gebruiker / mnd" },
];

function CellView({ value }: { value: Cell }) {
  if (value === "yes") return <span className={styles.yes} aria-label="Ja">Ja</span>;
  if (value === "no") return <span className={styles.no} aria-label="Nee">Nee</span>;
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
        <h1 className={styles.heroTitle}>Yippie vs Front: het MKB-vriendelijke alternatief</h1>
        <p className={styles.heroSub}>
          Front is een verzorgde tool voor gedeelde inboxen, maar houdt daar ook
          op. Als je volledige supportticketing nodig hebt, een ingebouwd
          boekingssysteem of een kanban-pipeline naast je inbox, loop je snel
          tegen de grenzen aan — en de kosten per gebruiker stapelen zich snel op.
          Yippie is speciaal gebouwd voor kleine en middelgrote bedrijven die meer
          nodig hebben dan een gedeelde inbox.
        </p>
        <p className={styles.heroSub}>
          Kortom: Yippie is een Front-alternatief voor kleine teams met een vaste
          werkruimteprijs vanaf €19 per maand, onbeperkte contacten op elk
          abonnement, AI-opgestelde tickets en boekingen ingebouwd — terwijl
          Front ongeveer €19 per gebruiker per maand rekent en zich uitsluitend
          richt op de inboxervaring.
        </p>
        <div className={styles.heroActions}>
          <a href={DEMO_URL} className={styles.btnPrimary}>Demo aanvragen →</a>
          <a href="/modules" className={styles.btnGhost}>Alle functies bekijken</a>
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionInner}>
          <p className={styles.eyebrow}>Naast elkaar</p>
          <h2 className={styles.sectionTitle}>Hoe Yippie zich verhoudt tot Front</h2>
          <p className={styles.sectionSub}>
            Alle inboxgemak van Front, plus volledige ticketing, boekingen en
            AI-opstelling — voor een vaste werkruimteprijs.
          </p>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Functie</th>
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
          <p className={styles.eyebrow}>Waarom MKB-bedrijven overstappen</p>
          <h2 className={styles.sectionTitle}>Meer dan een inbox</h2>
          <div className={styles.grid}>
            <div className={styles.card}>
              <h3 className={styles.cardTitle}>Vaste, voorspelbare prijs</h3>
              <p className={styles.cardDesc}>
                Betaal per werkruimte vanaf €19 per maand, niet €19+ per gebruiker.
                Voeg teamleden toe zonder te zien hoe de rekening oploopt elke
                keer dat je team groeit.
              </p>
            </div>
            <div className={styles.card}>
              <h3 className={styles.cardTitle}>Volledige supportdiepgang, ingebouwd</h3>
              <p className={styles.cardDesc}>
                Ga verder dan de gedeelde inbox: AI-ticketopstelling, kanban-pipeline
                en een ingebouwd boekingssysteem — allemaal direct beschikbaar,
                zonder plugins of integraties.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className={styles.ctaSection}>
        <h2 className={styles.ctaTitle}>Stap over naar support die bij je bedrijf past</h2>
        <p className={styles.ctaSub}>
          Zie waarom MKB-bedrijven kiezen voor Yippie boven Front. Probeer de
          directe demo. Geen creditcard nodig.
        </p>
        <a href={DEMO_URL} className={styles.btnPrimary}>Demo aanvragen →</a>
      </section>

      <SiteFooter />
    </div>
  );
}
