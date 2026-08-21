import type { Metadata } from "next";
import SiteNav from "../components/SiteNav";
import SiteFooter from "../components/SiteFooter";
import styles from "../components/content.module.css";

const DEMO_URL = process.env.NEXT_PUBLIC_DEMO_URL ?? "/request-demo";

export const metadata: Metadata = {
  title: "Yippie vs Freshdesk | Het MKB-vriendelijke Freshdesk-alternatief",
  description:
    "Op zoek naar een Freshdesk-alternatief voor je kleine bedrijf? Yippie is helpdesksoftware speciaal voor het MKB, met boekingen en vaste werkruimteprijzen vanaf €19 per maand.",
  alternates: { canonical: "/vs-freshdesk" },
  openGraph: {
    title: "Yippie vs Freshdesk | Het MKB-vriendelijke alternatief",
    description:
      "Een eenvoudiger Freshdesk-alternatief met vaste prijs, gebouwd voor het MKB. Boekingen en eenvoudige onboarding inbegrepen, vanaf €19 per maand.",
    url: "https://getyippie.com/vs-freshdesk",
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
  { feature: "Startprijs", yippie: "vanaf €19 / mnd", other: "~€15 / gebruiker / mnd" },
];

function CellView({ value }: { value: Cell }) {
  if (value === "yes") return <span className={styles.yes} aria-label="Ja">Ja</span>;
  if (value === "no") return <span className={styles.no} aria-label="Nee">Nee</span>;
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
        <h1 className={styles.heroTitle}>Yippie vs Freshdesk: het MKB-vriendelijke alternatief</h1>
        <p className={styles.heroSub}>
          Freshdesk biedt een breed functiepakket voor complexe supportoperaties,
          maar die breedte gaat gepaard met een leercurve en kosten per gebruiker
          die toenemen bij elke nieuwe aanstelling. Yippie is speciaal gebouwd
          voor kleine en middelgrote bedrijven: eenvoudiger, sneller op te zetten
          en een vaste werkruimteprijs in plaats van kosten per gebruiker.
        </p>
        <p className={styles.heroSub}>
          Kortom: Yippie is een Freshdesk-alternatief voor kleine teams met een
          vaste werkruimteprijs vanaf €19 per maand, onbeperkte contacten op
          elk abonnement, AI-opgestelde tickets en boekingen ingebouwd — terwijl
          Freshdesk ongeveer €15 per gebruiker per maand rekent en is ontworpen
          met enterprise-complexiteit in gedachten.
        </p>
        <div className={styles.heroActions}>
          <a href={DEMO_URL} className={styles.btnPrimary}>Demo aanvragen →</a>
          <a href="/modules" className={styles.btnGhost}>Alle functies bekijken</a>
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionInner}>
          <p className={styles.eyebrow}>Naast elkaar</p>
          <h2 className={styles.sectionTitle}>Hoe Yippie zich verhoudt tot Freshdesk</h2>
          <p className={styles.sectionSub}>
            Dezelfde kernfunctionaliteit van een helpdesk, zonder de kosten per
            gebruiker of de installatielast.
          </p>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Functie</th>
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
          <p className={styles.eyebrow}>Waarom MKB-bedrijven overstappen</p>
          <h2 className={styles.sectionTitle}>Gebouwd voor jouw formaat, niet voor dat van hen</h2>
          <div className={styles.grid}>
            <div className={styles.card}>
              <h3 className={styles.cardTitle}>Vaste, voorspelbare prijs</h3>
              <p className={styles.cardDesc}>
                Betaal per werkruimte vanaf €19 per maand, niet €15+ per gebruiker.
                Voeg teamleden toe zonder te zien hoe de rekening oploopt elke
                keer dat je iemand aanneemt.
              </p>
            </div>
            <div className={styles.card}>
              <h3 className={styles.cardTitle}>Dezelfde dag live, niet na een kwartaal</h3>
              <p className={styles.cardDesc}>
                Geen complexe configuratie nodig. Verbind je inbox, nodig je
                team uit en je beantwoordt tickets nog dezelfde middag.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className={styles.ctaSection}>
        <h2 className={styles.ctaTitle}>Stap over naar support die bij je bedrijf past</h2>
        <p className={styles.ctaSub}>
          Zie waarom MKB-bedrijven kiezen voor Yippie boven Freshdesk. Probeer
          de directe demo. Geen creditcard nodig.
        </p>
        <a href={DEMO_URL} className={styles.btnPrimary}>Demo aanvragen →</a>
      </section>

      <SiteFooter />
    </div>
  );
}
