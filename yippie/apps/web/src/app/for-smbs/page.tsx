import type { Metadata } from "next";
import SiteNav from "../components/SiteNav";
import SiteFooter from "../components/SiteFooter";
import styles from "../components/content.module.css";

const DEMO_URL = process.env.NEXT_PUBLIC_DEMO_URL ?? "/request-demo";

export const metadata: Metadata = {
  title: "Yippie voor het MKB | AI-klantenservice die uren bespaart",
  description:
    "Gebouwd voor kleine bedrijven die klantenservice serieus nemen. AI-inboxtriage, ticket-SLA's en boekingslinks helpen MKB-bedrijven 10+ uur per week te besparen.",
  alternates: { canonical: "/for-smbs" },
  openGraph: {
    title: "Yippie voor het MKB",
    description:
      "AI-inboxtriage, ticket-SLA's en boekingslinks voor het MKB. Bespaar 10+ uur per week op klantenservice.",
    url: "https://getyippie.com/for-smbs",
    type: "website",
  },
};

const painSolutions = [
  {
    pain: "Je inbox is een chaos. Support, sales en persoonlijke mail lopen door elkaar, en belangrijke berichten raken begraven.",
    solve: "AI-inboxtriage leest elk bericht, maakt een ticket aan met onderwerp en prioriteit, en toont wat het eerst je aandacht verdient. Één plek, overzichtelijk gesorteerd.",
  },
  {
    pain: "Tickets vallen tussen wal en schip. Een klant stelt maandag een vraag en niemand reageert totdat ze vrijdag klagen.",
    solve: "Ticket-SLA's met deadline-badges en meldingen waarschuwen je voordat er iets misgaat. Wijs toe, escaleer en sluit af. Niets wordt vergeten.",
  },
  {
    pain: "Je komt nooit toe aan opvolging. Een belafspraak plannen kost vijf e-mails om een tijdstip te vinden.",
    solve: "Stuur een boekingslink en de klant kiest zelf een tijd, of jij stelt tijdslots voor. Bevestigingsmails gaan automatisch uit. Geregeld in één bericht.",
  },
  {
    pain: "Leads opvolgen is handmatig en inconsistent. Contacten raken uit beeld en verkoopkansen verkoelen.",
    solve: "Stuur met één klik een campagne naar je volledige 'Leads'-fase. Contacten die op 'Geïnteresseerd' klikken schuiven automatisch door naar de volgende fase. Geen CRM-beheer nodig.",
  },
  {
    pain: "Andere platforms beperken je contacten en rekenen meer naarmate je groeit — je wordt gestraft voor je eigen succes.",
    solve: "Yippie heeft geen contactlimieten op welk abonnement dan ook. Je lijst groeit zo snel als je bedrijf, zonder gedwongen upgrade en zonder onverwachte kosten.",
  },
];

export default function ForSmbsPage() {
  return (
    <div className={styles.page}>
      <SiteNav />

      <section className={styles.hero}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo-white-bg-mark.svg" alt="" aria-hidden="true" className={styles.pageLogoMark} />
        <div className={styles.heroTag}>
          <span className={styles.heroTagDot} />
          Voor het MKB
        </div>
        <h1 className={styles.heroTitle}>
          Gebouwd voor kleine bedrijven die klantenservice serieus nemen
        </h1>
        <p className={styles.heroSub}>
          Je hebt geen supportteam van twintig man. Het ben jij. Yippie geeft
          kleine bedrijven de AI-kracht om snelle, persoonlijke klantenservice
          te bieden zonder te verdrinken in de inbox.
        </p>
        <div className={styles.heroActions}>
          <a href={DEMO_URL} className={styles.btnPrimary}>Demo aanvragen →</a>
          <a href="/modules" className={styles.btnGhost}>Alle functies bekijken</a>
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionInner}>
          <p className={styles.eyebrow}>Het probleem</p>
          <h2 className={styles.sectionTitle}>De dagelijkse uitdagingen, opgelost</h2>
          <p className={styles.sectionSub}>
            Drie dingen remmen elk klein bedrijf. Zo lost Yippie ze elk op.
          </p>
          <div className={styles.rows}>
            {painSolutions.map((row, i) => (
              <div key={i} className={styles.row}>
                <div className={styles.painCard}>
                  <div className={`${styles.painLabel} ${styles.painLabelBad}`}>Het probleem</div>
                  <p className={styles.painText}>{row.pain}</p>
                </div>
                <div className={styles.solveCard}>
                  <div className={`${styles.painLabel} ${styles.painLabelGood}`}>Met Yippie</div>
                  <p className={styles.painText}>{row.solve}</p>
                </div>
              </div>
            ))}
          </div>

          <div className={styles.proof}>
            <p className={styles.proofText}>Meer dan 100 MKB-bedrijven besparen 10+ uur per week</p>
            <p className={styles.proofSub}>
              Duizenden uren klantenservice al geautomatiseerd door Yippie. En het telt door.
            </p>
          </div>
        </div>
      </section>

      <section className={styles.ctaSection}>
        <h2 className={styles.ctaTitle}>Krijg je tijd terug</h2>
        <p className={styles.ctaSub}>
          Zie hoe Yippie je echte supportinbox afhandelt. Probeer de directe demo.
          Geen creditcard nodig.
        </p>
        <a href={DEMO_URL} className={styles.btnPrimary}>Demo aanvragen →</a>
      </section>

      <SiteFooter />
    </div>
  );
}
