import type { Metadata } from "next";
import SiteNav from "../components/SiteNav";
import SiteFooter from "../components/SiteFooter";
import Reveal from "../components/Reveal";
import styles from "../components/content.module.css";
import aboutStyles from "./about.module.css";
import { BoltIcon, LayersIcon, UsersIcon, InboxIcon, CalendarIcon, TeamIcon, ArrowRightIcon } from "../components/icons";

const DEMO_URL = process.env.NEXT_PUBLIC_DEMO_URL ?? "/request-demo";

const JOURNEY = [
  {
    Icon: InboxIcon,
    company: "Een grote online retailer",
    role: "Grootschalige klantenservice",
    desc: "Dagelijks duizenden klantvragen beheren. De gedeelde inbox was altijd één bericht verwijderd van chaos.",
  },
  {
    Icon: CalendarIcon,
    company: "Een warmtepompinstallateur",
    role: "Planning van warmtepompinstallaties",
    desc: "Complexe planning over buitendienstteams en klanten heen. Afstemming die minuten had moeten kosten, kostte uren.",
  },
  {
    Icon: TeamIcon,
    company: "Een leverancier van zorgplanning",
    role: "Planningssoftware voor ziekenhuisafdelingen",
    desc: "Kritieke ondersteuning waarbij niets mis mocht gaan. Enterprise tools vertraagden iedereen in plaats van te helpen.",
  },
];

const PHILOSOPHY = [
  {
    Icon: BoltIcon,
    title: "Direct te leren",
    desc: "Geen training nodig. Je team is in minder dan vijf minuten aan de slag. Geen onboardingssessies, geen documentatiedoolhof.",
  },
  {
    Icon: LayersIcon,
    title: "Betaal voor wat je gebruikt",
    desc: "Geen opgeblazen enterprise prijzen. Voeg modules à la carte toe, alleen wanneer je team ze echt nodig heeft.",
  },
  {
    Icon: UsersIcon,
    title: "Groeit mee met je bedrijf",
    desc: "Onbeperkte contacten in elk abonnement. Schakel complexiteit pas in wanneer je team er klaar voor is, niet eerder.",
  },
];

export const metadata: Metadata = {
  title: "Over ons | Yippie klantenserviceplatform voor MKB",
  description:
    "Waarom ik Yippie heb gebouwd: jaren aan de frontlinie van klantenservice, klaar met gedeelde-inbox chaos en enterprise bloat. Minimalistische supportsoftware voor MKB.",
  alternates: { canonical: "/about" },
  openGraph: {
    title: "Over ons | Yippie klantenserviceplatform voor MKB",
    description:
      "Waarom ik Yippie heb gebouwd: klantenservice eenvoudig gemaakt voor het MKB.",
    url: "https://getyippie.com/about",
    type: "website",
  },
};

export default function AboutPage() {
  return (
    <div className={styles.page}>
      <SiteNav />

      {/* Hero */}
      <section className={styles.hero}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo-white-bg-mark.svg" alt="" aria-hidden="true" className={styles.pageLogoMark} />
        <Reveal>
          <p className={styles.eyebrow}>Over ons</p>
          <h1 className={styles.heroTitle}>
            Ik ben een engineer die het zat was<br />om support te zien falen.
          </h1>
          <p className={styles.heroSub}>
            Ik ben Diederik, een industrieel ingenieur met een licht obsessieve gewoonte om
            dingen te optimaliseren. Yippie is het hulpmiddel dat ik altijd al had gewild.
          </p>
          <div className={aboutStyles.founderPill}>
            <span className={aboutStyles.founderAvatar}>DB</span>
            <span className={aboutStyles.founderName}>
              <strong>Diederik Brinkman</strong> · Oprichter
            </span>
          </div>
        </Reveal>
      </section>

      {/* Story */}
      <section className={styles.sectionLight}>
        <div className={aboutStyles.storyWrap}>
          <Reveal>
            <p className={aboutStyles.storyBody}>
              Ik werkte aan de frontlinie van klantenservice en planning: grootschalige
              klantenservice bij <strong>een grote online retailer</strong>, complexe installatieplanning
              bij <strong>een warmtepompinstallateur</strong>, en kritieke softwareondersteuning
              voor ziekenhuisafdelingen bij <strong>een leverancier van zorgplanning</strong>.
            </p>
            <p className={aboutStyles.storyBody}>
              Verschillende sectoren, dezelfde twee extremen. Elke keer opnieuw:
            </p>
          </Reveal>
          <Reveal delay={60}>
            <div className={styles.gridTwo}>
              <div className={styles.card}>
                <span className={aboutStyles.extremeNum}>01</span>
                <h3 className={styles.cardTitle}>Gedeelde inbox chaos</h3>
                <p className={styles.cardDesc}>
                  Teams die verdrinken in een gedeelde Outlook of WhatsApp inbox. Niemand weet
                  wie welk gesprek oppakt en dagelijks glipt er van alles doorheen.
                </p>
              </div>
              <div className={styles.card}>
                <span className={aboutStyles.extremeNum}>02</span>
                <h3 className={styles.cardTitle}>Enterprise bloat</h3>
                <p className={styles.cardDesc}>
                  Overontwikkelde enterprise platforms: zwaar, hypercomplexe, en
                  volgestopt met functies die 90% van het MKB nooit aanraakt.
                </p>
              </div>
            </div>
          </Reveal>
          <Reveal delay={100}>
            <p className={aboutStyles.thesis}>
              Ik wist dat het beter kon. Als engineer wist ik dat{" "}
              <span className={aboutStyles.thesisAccent}>ik</span> het beter kon bouwen.
              Dus deed ik dat. Ik bouwde Yippie.
            </p>
          </Reveal>
        </div>
      </section>

      {/* Journey */}
      <section className={styles.section}>
        <Reveal className={aboutStyles.sectionCenter}>
          <p className={styles.eyebrow}>De frontlinie</p>
          <h2 className={styles.sectionTitle}>Waar dit vandaan komt</h2>
        </Reveal>
        <div className={`${styles.grid} ${aboutStyles.journeyGrid}`}>
          {JOURNEY.map((j, i) => (
            <Reveal key={j.company} delay={i * 80}>
              <div className={styles.card}>
                <div className={styles.iconWrap}>
                  <j.Icon size={22} />
                </div>
                <h3 className={styles.cardTitle}>{j.company}</h3>
                <p className={aboutStyles.journeyRole}>{j.role}</p>
                <p className={styles.cardDesc}>{j.desc}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Philosophy */}
      <section className={styles.sectionLight}>
        <Reveal className={aboutStyles.sectionCenter}>
          <p className={styles.eyebrow}>De filosofie</p>
          <h2 className={styles.sectionTitle}>Klantenservice, eenvoudig gemaakt.</h2>
          <p className={styles.sectionSub}>
            Eén simpele belofte: pak je tijd terug. Ik verwijder de administratieve rommel zodat je
            je kunt concentreren op wat echt telt: je klanten.
          </p>
        </Reveal>
        <div className={`${styles.grid} ${aboutStyles.philosophyGrid}`}>
          {PHILOSOPHY.map((v, i) => (
            <Reveal key={v.title} delay={i * 80}>
              <div className={styles.card}>
                <div className={styles.iconWrap}>
                  <v.Icon size={22} />
                </div>
                <h3 className={styles.cardTitle}>{v.title}</h3>
                <p className={styles.cardDesc}>{v.desc}</p>
              </div>
            </Reveal>
          ))}
        </div>
        <Reveal>
          <p className={aboutStyles.tagline}>Geen bloat. Geen gemiste gesprekken. Gewoon snelle, minimalistische support.</p>
        </Reveal>
      </section>

      {/* CTA */}
      <section className={styles.ctaSection}>
        <Reveal>
          <h2 className={styles.ctaTitle}>Wil je zien wat ik heb gebouwd?</h2>
          <p className={styles.ctaSub}>
            Vraag een demo aan en ik laat je Yippie zelf zien, in minder dan twintig minuten.
          </p>
          <a href={DEMO_URL} className={styles.btnPrimary}>
            Demo aanvragen <ArrowRightIcon size={17} />
          </a>
        </Reveal>
      </section>

      <SiteFooter />
    </div>
  );
}
