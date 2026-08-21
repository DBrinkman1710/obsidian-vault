import type { Metadata } from "next";
import SiteNav from "../components/SiteNav";
import SiteFooter from "../components/SiteFooter";
import styles from "../components/content.module.css";

const DEMO_URL = process.env.NEXT_PUBLIC_DEMO_URL ?? "/request-demo";

export const metadata: Metadata = {
  title: "Yippie vs Zendesk | Het MKB-vriendelijke Zendesk-alternatief",
  description:
    "Op zoek naar een Zendesk-alternatief voor je kleine bedrijf? Yippie is helpdesksoftware speciaal voor het MKB, met boekingen en vaste werkruimteprijzen vanaf €19 per maand.",
  alternates: { canonical: "/vs-zendesk" },
  openGraph: {
    title: "Yippie vs Zendesk | Het MKB-vriendelijke alternatief",
    description:
      "Een eenvoudiger Zendesk-alternatief met vaste prijs, gebouwd voor het MKB. Boekingen en eenvoudige onboarding inbegrepen, vanaf €19 per maand.",
    url: "https://getyippie.com/vs-zendesk",
    type: "website",
  },
};

type Cell = "yes" | "no" | string;
const rows: { feature: string; yippie: Cell; other: Cell }[] = [
  { feature: "Vaste werkruimteprijs", yippie: "yes", other: "no" },
  { feature: "Ingebouwd boekingssysteem", yippie: "yes", other: "no" },
  { feature: "Eenvoudige onboarding (dezelfde dag live)", yippie: "yes", other: "Complexe installatie" },
  { feature: "Speciaal gebouwd voor het MKB", yippie: "yes", other: "Enterprise-eerst" },
  { feature: "Kanban-pipeline", yippie: "yes", other: "no" },
  { feature: "Startprijs", yippie: "vanaf €19 / mnd", other: "~€55 / gebruiker / mnd" },
];

function CellView({ value }: { value: Cell }) {
  if (value === "yes") return <span className={styles.yes} aria-label="Ja">Ja</span>;
  if (value === "no") return <span className={styles.no} aria-label="Nee">Nee</span>;
  return <span className={styles.partial}>{value}</span>;
}

export default function VsZendeskPage() {
  return (
    <div className={styles.page}>
      <SiteNav />

      <section className={styles.hero}>
        <img src="/logo-white-bg-mark.svg" alt="" aria-hidden="true" className={styles.pageLogoMark} />
        <div className={styles.heroTag}>
          <span className={styles.heroTagDot} />
          Yippie vs Zendesk
        </div>
        <h1 className={styles.heroTitle}>Yippie vs Zendesk: het MKB-vriendelijke alternatief</h1>
        <p className={styles.heroSub}>
          Zendesk is krachtige klantenservicesoftware op enterprise-niveau — en
          zo geprijsd. Yippie is speciaal gebouwd voor kleine en middelgrote
          bedrijven: eenvoudiger, sneller op te zetten en een vaste
          werkruimteprijs in plaats van kosten per gebruiker die oplopen naarmate
          je groeit.
        </p>
        <p className={styles.heroSub}>
          Kortom: Yippie is een Zendesk-alternatief voor kleine teams met een
          vaste werkruimteprijs vanaf €19 per maand, onbeperkte contacten op
          elk abonnement, AI-opgestelde tickets en boekingen ingebouwd — terwijl
          Zendesk ongeveer €55 per gebruiker per maand rekent en is ontworpen
          voor enterprise-supportteams.
        </p>
        <div className={styles.heroActions}>
          <a href={DEMO_URL} className={styles.btnPrimary}>Demo aanvragen →</a>
          <a href="/modules" className={styles.btnGhost}>Alle functies bekijken</a>
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionInner}>
          <p className={styles.eyebrow}>Naast elkaar</p>
          <h2 className={styles.sectionTitle}>Hoe Yippie zich verhoudt tot Zendesk</h2>
          <p className={styles.sectionSub}>
            Dezelfde kernfunctionaliteit van een helpdesk, zonder de
            enterprise-prijskaartje of de installatielast.
          </p>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Functie</th>
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
        </div>
      </section>

      <section className={styles.sectionLight}>
        <div className={styles.sectionInner}>
          <p className={styles.eyebrow}>Waarom MKB-bedrijven overstappen</p>
          <h2 className={styles.sectionTitle}>Gebouwd voor jouw formaat, niet voor dat van hen</h2>
          <div className={styles.grid}>
            <div className={styles.card}>
              <h3 className={styles.cardTitle}>Vaste, voorspelbare prijs</h3>
              <p className={styles.cardDesc}>
                Betaal per werkruimte vanaf €19 per maand, niet €55+ per gebruiker.
                Voeg teamleden toe zonder te zien hoe de rekening oploopt elke
                keer dat je iemand aanneemt.
              </p>
            </div>
            <div className={styles.card}>
              <h3 className={styles.cardTitle}>Dezelfde dag live, niet na een kwartaal</h3>
              <p className={styles.cardDesc}>
                Geen implementatieconsultant nodig. Verbind je inbox, nodig je
                team uit en je beantwoordt tickets nog dezelfde middag.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className={styles.ctaSection}>
        <h2 className={styles.ctaTitle}>Stap over naar support die bij je bedrijf past</h2>
        <p className={styles.ctaSub}>
          Zie waarom MKB-bedrijven kiezen voor Yippie boven Zendesk. Probeer de
          directe demo. Geen creditcard nodig.
        </p>
        <a href={DEMO_URL} className={styles.btnPrimary}>Demo aanvragen →</a>
      </section>

      <SiteFooter />
    </div>
  );
}
