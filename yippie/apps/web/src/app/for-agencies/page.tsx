import type { Metadata } from "next";
import SiteNav from "../components/SiteNav";
import SiteFooter from "../components/SiteFooter";
import styles from "../components/content.module.css";

const DEMO_URL = process.env.NEXT_PUBLIC_DEMO_URL ?? "/request-demo";

export const metadata: Metadata = {
  title: "Yippie voor bureaus | Multiclient helpdesk & gedeelde inboxsoftware",
  description:
    "Beheer klantcommunicatie op schaal met Yippie's multitenanthelpdesksoftware. Gedeelde inbox, contactlabels, bedrijven en campagne-e-mails houden elk klantaccount overzichtelijk.",
  alternates: { canonical: "/for-agencies" },
  openGraph: {
    title: "Yippie voor bureaus | Multiclient klantenservicesoftware",
    description:
      "Multitenant gedeelde inbox, contactlabels en campagne-e-mails voor bureaus die klantenservice voor meerdere klanten beheren.",
    url: "https://getyippie.com/for-agencies",
    type: "website",
  },
};

const painSolutions = [
  {
    pain: "Elke klant heeft zijn eigen inbox, login en tool. Vijf keer per dag wisselen tussen accounts kost je focus en je marge.",
    solve: "Yippie is van nature multitenant. Elke klant heeft zijn eigen geïsoleerde werkruimte en je team beheert ze allemaal vanuit één klantenserviceplatform. Geen gedoe meer met wachtwoorden.",
  },
  {
    pain: "Voortdurend schakelen betekent dat je vergeet waar een gesprek was gebleven — en klanten merken dat je de draad kwijt bent.",
    solve: "Een uniforme gedeelde inbox met contactlabels en bedrijfsgroepering koppelt elk gesprek, ticket en elke pipelinefase aan het juiste klantaccount. Je pakt precies op waar je was gebleven.",
  },
  {
    pain: "Klanten bijwerken is een klus. Handmatige statusmails vreten aan je week en voelen toch onpersoonlijk.",
    solve: "Campagne-e-mails met rijke sjablonen en tracking laten je gepolijste, on-brand updates op schaal versturen. Voor je eigen salespipeline schuiven contacten automatisch door Kanban-fasen wanneer ze op een actieknop klikken, zodat je pipeline actueel blijft zonder dat je er iets voor hoeft te doen.",
  },
  {
    pain: "Andere platforms rekenen meer per klantcontact, waardoor groei een duur probleem wordt in plaats van een succes.",
    solve: "Elke werkruimte krijgt onbeperkte contacten. Voeg klanten toe, laat hun databases groeien en schaal je bureau zonder je druk te maken over een limiet.",
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
          Voor bureaus
        </div>
        <h1 className={styles.heroTitle}>
          Beheer klantcommunicatie op schaal, zonder de persoonlijke touch te verliezen
        </h1>
        <p className={styles.heroSub}>
          Yippie is de multiclienthelpdesksoftware die bureaus gebruiken om
          klantenservice voor elk account te runnen. Één gedeelde inbox, schone
          tenantisolatie en AI die het zware werk doet.
        </p>
        <div className={styles.heroActions}>
          <a href={DEMO_URL} className={styles.btnPrimary}>Demo aanvragen →</a>
          <a href="/modules" className={styles.btnGhost}>Alle functies bekijken</a>
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionInner}>
          <p className={styles.eyebrow}>Het probleem</p>
          <h2 className={styles.sectionTitle}>Bureausupport, zonder de chaos</h2>
          <p className={styles.sectionSub}>
            De verborgen kosten van het beheren van veel klanten, en hoe Yippie ze wegneemt.
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
        </div>
      </section>

      <section className={styles.ctaSection}>
        <h2 className={styles.ctaTitle}>Beheer elk klantaccount vanuit één platform</h2>
        <p className={styles.ctaSub}>
          Zie hoe bureaus Yippie gebruiken om klantenservice te schalen zonder
          meer personeel. Probeer de directe demo vandaag nog.
        </p>
        <a href={DEMO_URL} className={styles.btnPrimary}>Demo aanvragen →</a>
      </section>

      <SiteFooter />
    </div>
  );
}
