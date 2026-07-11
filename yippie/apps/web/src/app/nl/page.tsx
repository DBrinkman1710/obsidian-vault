import type { Metadata } from "next";
import styles from "../page.module.css";

export const metadata: Metadata = {
  title: "Yippie | Klantenservice software voor MKB",
  description:
    "Yippie verwerkt elk support ticket automatisch vanuit je inbox. Gedeelde inbox, AI-tickets, onbeperkte contacten en live chat in één platform. Start je gratis proefperiode van 30 dagen.",
  alternates: {
    canonical: "/nl",
    languages: {
      en: "/",
      nl: "/nl",
    },
  },
  keywords: [
    "klantenservice software",
    "gedeelde inbox",
    "MKB",
    "helpdesk software",
    "klantenservice automatisering",
    "ticket systeem",
    "AI inbox",
    "onbeperkte contacten",
  ],
};

import SiteNav from "../components/SiteNav";
import SiteFooter from "../components/SiteFooter";
import Reveal from "../components/Reveal";
import ROICalculator from "../components/ROICalculator";
import PricingTeaser from "../components/PricingTeaser";
import { PLAN_LIMITS } from "@/lib/config";
import {
  InboxIcon,
  TicketIcon,
  ChatIcon,
  UsersIcon,
  ActivityIcon,
  BillingIcon,
  CalendarIcon,
  KanbanIcon,
  MailTrackIcon,
  TemplateIcon,
  TeamIcon,
  TrackingIcon,
  SalesIcon,
  SaasIcon,
  ArrowRightIcon,
} from "../components/icons";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.getyippie.com";
const DEMO_URL = process.env.NEXT_PUBLIC_DEMO_URL ?? "/request-demo";

const FOUNDER_SPOTS_TOTAL = 5;
const FOUNDER_SPOTS_LEFT = parseInt(process.env.NEXT_PUBLIC_FOUNDER_SPOTS_LEFT ?? "5", 10);

const featureGroups = [
  {
    label: "Support",
    items: [
      {
        Icon: InboxIcon,
        title: "Slimme inbox",
        desc: "AI leest elk bericht en stelt het ticketonderwerp, de prioriteit en de omschrijving voor. Controleer, keur goed, klaar.",
      },
      {
        Icon: TicketIcon,
        title: "Tickets",
        desc: "Volg, wijs toe en sluit verzoeken af op één plek. SLA-meldingen gaan af voordat er iets tussen wal en schip valt.",
      },
      {
        Icon: UsersIcon,
        title: "Contacten",
        desc: "Volledige klanthistorie in één overzicht: e-mails, tickets, pipelinefase en bedrijf. Nooit meer zoeken in je inbox.",
      },
      {
        Icon: ChatIcon,
        title: "Live chat",
        desc: "Voeg een chatwidget toe met één regel code. Elk gesprek belandt in de gedeelde inbox, naast e-mail.",
      },
      {
        Icon: TemplateIcon,
        title: "Sjablonen",
        desc: "Bouw een gedeelde bibliotheek met snelle antwoorden. Kies en personaliseer voor het versturen. Snel en on-brand.",
      },
    ],
  },
  {
    label: "Sales & Groei",
    items: [
      {
        Icon: KanbanIcon,
        title: "Pipeline",
        desc: "Drag-and-drop Kanban om contacten door op maat gemaakte fases te sturen. Campagnebuttons zetten contacten automatisch door bij een klik.",
      },
      {
        Icon: MailTrackIcon,
        title: "Marketing",
        desc: "E-mailcampagnes gericht op pipelinefase, met A/B-testen, realtime tracking en automatische doorplaatsing op klik.",
      },
      {
        Icon: SalesIcon,
        title: "Sales",
        desc: "Volg productweergaven, winkelwagen-acties en aankopen. Zie welke contacten koopintentie tonen.",
      },
      {
        Icon: SaasIcon,
        title: "SaaS Analytics",
        desc: "Beheer terugkerende abonnementen, volg MRR en churn, en koppel elk abonnement aan een contact.",
      },
    ],
  },
  {
    label: "Operaties",
    items: [
      {
        Icon: CalendarIcon,
        title: "Agenda",
        desc: "Maandelijkse kalender met afspraken, deadlines en boekingen. Stuur boekingslinks zodat klanten zelf een moment kiezen.",
      },
      {
        Icon: TeamIcon,
        title: "Afdelingen",
        desc: "Maak afdelingen aan, voeg medewerkers toe en laat inkomende e-mail automatisch naar het juiste team routeren.",
      },
      {
        Icon: BillingIcon,
        title: "Facturatie",
        desc: "Maak en verstuur facturen vanuit je werkruimte. Volg de betaalstatus zonder een apart factuurprogramma.",
      },
      {
        Icon: ActivityIcon,
        title: "Activiteit",
        desc: "Realtime log van alles in je werkruimte. Je weet altijd wie wat heeft gedaan en wanneer.",
      },
      {
        Icon: TeamIcon,
        title: "Team",
        desc: "Nodig medewerkers uit, stel rollen in en verdeel over afdelingen. Tickets worden automatisch naar de juiste persoon gerouteerd.",
      },
      {
        Icon: TrackingIcon,
        title: "Zendingtracking",
        desc: "Koppel je ERP of webshop en zendingen verschijnen automatisch bij het juiste contact. Live carrierupdates voor DHL, UPS, PostNL en FedEx. Geen kopiëren en plakken.",
      },
    ],
  },
];

const steps = [
  {
    n: "01",
    title: "Klant stuurt een bericht",
    desc: "Een e-mail of WhatsApp-bericht belandt automatisch in je Yippie-inbox.",
  },
  {
    n: "02",
    title: "AI stelt het ticket op",
    desc: "Yippie leest het bericht en stelt onderwerp, prioriteit en omschrijving voor.",
  },
  {
    n: "03",
    title: "Jij keurt het goed met één klik",
    desc: "Bewerk indien gewenst en keur dan goed. Het wordt meteen een echt ticket.",
  },
];

const inboxItems = [
  { sender: "Acme BV", subject: "Vraag over factuur INV-0421", dot: "", badge: "review" },
  { sender: "TechCorp", subject: "Inlogprobleem: account geblokkeerd", dot: "amber", badge: "review" },
  { sender: "Nordex", subject: "Upgrade naar groter abonnement", dot: "green", badge: "done" },
  { sender: "Bloom Agency", subject: "Verzoek voor onboardingsgesprek", dot: "", badge: "review" },
];

function ProductMockup({ wide = false }: { wide?: boolean }) {
  return (
    <div className={`${styles.frame} ${wide ? styles.frameWide : ""}`}>
      <div className={styles.frameBar}>
        <span className={styles.dot} />
        <span className={styles.dot} />
        <span className={styles.dot} />
        <span className={styles.frameUrl}>app.getyippie.com/inbox</span>
      </div>
      <div className={styles.app}>
        <div className={styles.appSidebar}>
          {[true, false, false, false, false, false].map((active, i) => (
            <div key={i} className={`${styles.appNav} ${active ? styles.appNavActive : ""}`} />
          ))}
        </div>
        <div className={styles.appMain}>
          <div className={styles.appTop}>
            <span className={styles.appTitle}>Inbox</span>
            <span className={styles.appAvatar} />
          </div>
          <div className={styles.appStats}>
            <div className={styles.appStat}>
              <span className={styles.appStatLabel}>Open</span>
              <span className={`${styles.appStatVal} ${styles.brand}`}>12</span>
            </div>
            <div className={styles.appStat}>
              <span className={styles.appStatLabel}>In behandeling</span>
              <span className={`${styles.appStatVal} ${styles.amber}`}>4</span>
            </div>
            <div className={styles.appStat}>
              <span className={styles.appStatLabel}>Opgelost</span>
              <span className={`${styles.appStatVal} ${styles.green}`}>31</span>
            </div>
          </div>
          <div className={styles.appList}>
            {inboxItems.map((item) => (
              <div key={item.sender} className={styles.appRow}>
                <span className={`${styles.appRowDot} ${item.dot === "amber" ? styles.amber : item.dot === "green" ? styles.green : ""}`} />
                <span className={styles.appRowText}>
                  <span className={styles.appRowSender}>{item.sender}</span>
                  <span className={styles.appRowSubject}>{item.subject}</span>
                </span>
                <span className={`${styles.appBadge} ${item.badge === "done" ? styles.badgeDone : styles.badgeReview}`}>
                  {item.badge}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function NlHomePage() {
  return (
    <>
      <SiteNav />

      {/* Hero */}
      <section className={`${styles.hero} bgGrid`}>
        <div className={styles.heroGlow} aria-hidden="true" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/logo-white-bg-mark.svg"
          alt=""
          aria-hidden="true"
          className={styles.heroLogoMark}
        />
        <div className={styles.heroInner}>
          <Reveal className={styles.heroCopy}>
            <div className={styles.eyebrowPill}>
              <span className={styles.pillDot} />
              Je groeiparter in klantenservice
            </div>
            <h1 className={styles.heroTitle}>
              Neem de tijd terug<br />die ertoe doet.
            </h1>
            <p className={styles.heroSub}>
              Yippie verwerkt elk support ticket automatisch vanuit je inbox en
              groeit mee met je bedrijf. Controleer, keur goed, klaar.
            </p>
            <div className={styles.heroActions}>
              <a href="/signup" className={styles.btnPrimary}>
                Start je gratis proefperiode van 30 dagen <ArrowRightIcon size={17} />
              </a>
              <a href={DEMO_URL} className={styles.btnGhost}>Demo aanvragen</a>
            </div>
            <p className={styles.heroMeta}>30 dagen gratis · Geen creditcard · Altijd opzegbaar</p>
          </Reveal>

          <Reveal className={styles.heroVisual} delay={120}>
            <ProductMockup />
          </Reveal>
        </div>
      </section>

      {/* Stats */}
      <section className={styles.statsBar}>
        {[
          { value: "10u+", label: "bespaard per week gemiddeld" },
          { value: "< 2 min", label: "gemiddelde reactietijd op tickets" },
          { value: "15", label: "modules, één platform" },
        ].map((s, i) => (
          <Reveal key={s.label} className={styles.stat} delay={i * 80}>
            <div className={styles.statValue}>{s.value}</div>
            <div className={styles.statLabel}>{s.label}</div>
          </Reveal>
        ))}
      </section>

      {/* Features */}
      <section id="functies" className={styles.section}>
        <Reveal className={styles.sectionHead}>
          <p className={styles.eyebrow}>// Functies</p>
          <h2 className={styles.sectionTitle}>Alles wat je supportteam nodig heeft</h2>
          <p className={styles.sectionSub}>
            Vijftien modules: inbox, tickets, contacten, pipeline, marketing, live chat en meer.
            Één platform. Stop met schakelen tussen tools.
          </p>
        </Reveal>
        <div className={styles.featureRows}>
          {featureGroups.map((group) => (
            <>
              <p key={`label_${group.label}`} className={styles.featureGroupLabel}>{group.label}</p>
              {group.items.map((f, i) => (
                <Reveal key={f.title} className={styles.featureRow} delay={(i % 2) * 70}>
                  <div className={styles.featureIcon}>
                    <f.Icon size={22} />
                  </div>
                  <div>
                    <h3 className={styles.featureTitle}>{f.title}</h3>
                    <p className={styles.featureDesc}>{f.desc}</p>
                  </div>
                </Reveal>
              ))}
            </>
          ))}
        </div>
      </section>

      {/* Hoe het werkt */}
      <section id="hoe-het-werkt" className={styles.sectionLight}>
        <Reveal className={styles.sectionHead}>
          <p className={styles.eyebrow}>// Hoe het werkt</p>
          <h2 className={styles.sectionTitle}>Van e-mail naar opgelost in seconden</h2>
          <p className={styles.sectionSub}>
            De AI van Yippie leest elk inkomend bericht en doet de administratie voor je.
          </p>
        </Reveal>
        <div className={styles.steps}>
          {steps.map((s, i) => (
            <Reveal key={s.n} className={styles.step} delay={i * 90}>
              <div className={styles.stepNum}>{s.n}</div>
              <h3 className={styles.stepTitle}>{s.title}</h3>
              <p className={styles.stepDesc}>{s.desc}</p>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Groeiparter */}
      <section className={styles.sectionLight}>
        <Reveal className={styles.sectionHead}>
          <p className={styles.eyebrow}>// Groeiparter</p>
          <h2 className={styles.sectionTitle}>Jij groeit, wij groeien mee.</h2>
          <p className={styles.sectionSub}>Kies wat je bedrijf nodig heeft, niet meer en niet minder.</p>
        </Reveal>
        <div className={styles.featureRows}>
          <Reveal className={styles.featureRow}>
            <div className={styles.featureIcon}>
              <UsersIcon size={22} />
            </div>
            <div>
              <h3 className={styles.featureTitle}>Onbeperkte contacten op elk abonnement</h3>
              <p className={styles.featureDesc}>
                Van je eerste klant tot je tienduizendste verandert je contactlimiet nooit.
                Geen gedwongen upgrade, geen onverwachte limiet.
              </p>
            </div>
          </Reveal>
          <Reveal className={styles.featureRow} delay={70}>
            <div className={styles.featureIcon}>
              <BillingIcon size={22} />
            </div>
            <div>
              <h3 className={styles.featureTitle}>Transparante prijzen, geen verrassingen</h3>
              <p className={styles.featureDesc}>
                Één vaste maandprijs. Geen verborgen kosten, geen kosten per contact.
                Je weet altijd precies wat je betaalt.
              </p>
            </div>
          </Reveal>
          <Reveal className={styles.featureRow} delay={140}>
            <div className={styles.featureIcon}>
              <ChatIcon size={22} />
            </div>
            <div>
              <h3 className={styles.featureTitle}>Bereikbare mensen, geen zwarte doos</h3>
              <p className={styles.featureDesc}>
                Wij zijn er als je ons nodig hebt. Geen ticketqueue, geen chatbot.
                Oprichters die willen dat jij slaagt.
              </p>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ROI calculator */}
      <ROICalculator appUrl={DEMO_URL} />

      {/* Product moment (dark) */}
      <section className={`${styles.moment} bgDots`}>
        <Reveal className={styles.momentHead}>
          <p className={styles.eyebrowDark}>// Één werkruimte</p>
          <h2 className={styles.momentTitle}>Alles op één plek</h2>
          <p className={styles.momentSub}>
            Inbox, tickets, contacten en pipeline delen hetzelfde scherm, zodat er niets
            verloren gaat en elk antwoord de volledige context heeft.
          </p>
        </Reveal>
        <Reveal className={styles.momentVisual} delay={120}>
          <ProductMockup wide />
        </Reveal>
      </section>

      {/* Pricing teaser */}
      <section id="prijzen" className={styles.section}>
        <Reveal className={styles.sectionHead}>
          <p className={styles.eyebrow}>// Prijzen</p>
          <h2 className={styles.sectionTitle}>Eerlijke, transparante prijzen</h2>
          <p className={styles.sectionSub}>
            Geen verborgen kosten. Onbeperkte contacten. Begin klein en voeg modules toe naarmate je groeit.
          </p>
        </Reveal>

        <div className={styles.founderBanner}>
          <span className={styles.founderBadge}>Beperkt aanbod</span>
          <p className={styles.founderText}>
            <strong>Founding Member: nog {FOUNDER_SPOTS_LEFT} van {FOUNDER_SPOTS_TOTAL} plekken beschikbaar</strong> voor €{PLAN_LIMITS.founder.priceMonthly}/mo, tot 10 gebruikers, alle kernfuncties en 50% korting op alle betaalde modules.
          </p>
          <a href="/signup?plan=founder" className={styles.founderBtn}>Claim een foundersplek →</a>
        </div>

        <PricingTeaser />
        <div className={styles.pricingMore}>
          <a href="/nl/pricing" className={styles.textLink}>
            Bekijk alle abonnementen &amp; modules <ArrowRightIcon size={15} />
          </a>
        </div>
      </section>

      {/* CTA */}
      <section className={styles.cta}>
        <Reveal className={styles.ctaCard}>
          <h2 className={styles.ctaTitle}>Klaar om je tijd terug te winnen?</h2>
          <p className={styles.ctaSub}>
            Sluit je aan bij bedrijven die klantenservice in half de tijd afhandelen met Yippie.
            30 dagen gratis, geen creditcard nodig.
          </p>
          <a href="/signup" className={styles.btnPrimaryLg}>
            Start je gratis proefperiode van 30 dagen <ArrowRightIcon size={18} />
          </a>
          <p className={styles.ctaSub} style={{ marginTop: 14 }}>
            <a href={DEMO_URL} style={{ color: "inherit", textDecoration: "underline" }}>
              Of vraag een begeleide demo aan
            </a>
          </p>
        </Reveal>
      </section>

      <SiteFooter />
    </>
  );
}
