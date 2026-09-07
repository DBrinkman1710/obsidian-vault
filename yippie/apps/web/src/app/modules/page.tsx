import type { Metadata } from "next";
import SiteNav from "../components/SiteNav";
import SiteFooter from "../components/SiteFooter";
import Reveal from "../components/Reveal";
import contentStyles from "../components/content.module.css";
import styles from "./modules.module.css";
import Lightbox from "./Lightbox";
import {
  InboxIcon,
  TicketIcon,
  UsersIcon,
  CalendarIcon,
  KanbanIcon,
  ChatIcon,
  MailTrackIcon,
  TemplateIcon,
  ActivityIcon,
  TeamIcon,
  BillingIcon,
  ContractIcon,
  CheckIcon,
  ArrowRightIcon,
  TrackingIcon,
  SalesIcon,
  SaasIcon,
} from "../components/icons";

const DEMO_URL = process.env.NEXT_PUBLIC_DEMO_URL ?? "/request-demo";

export const metadata: Metadata = {
  title: "Modules | Yippie klantenserviceplatform",
  description:
    "Een diepgaande blik op elke Yippie module: inbox, tickets, contacten, agenda, pipeline, live chat, marketing, afdelingen, facturatie, contracten, sjablonen, activiteit, team, zendingtracking, sales en SaaS Analytics. Alles gebouwd voor MKB.",
  alternates: { canonical: "/modules" },
  openGraph: {
    title: "Modules | Yippie klantenserviceplatform",
    description:
      "Een diepgaande blik op elke Yippie module: inbox, tickets, contacten, agenda, pipeline, live chat, marketing, afdelingen, facturatie, contracten, sjablonen, activiteit, team, zendingtracking, sales en SaaS Analytics. Alles gebouwd voor MKB.",
    url: "https://getyippie.com/modules",
    type: "website",
    images: ["/og.png"],
  },
};

type Module = {
  id: string;
  kicker: string;
  title: string;
  desc: string;
  bullets: string[];
  shot: string;
  path: string;
  Icon: React.ComponentType<{ size?: number }>;
};

const modules: Module[] = [
  {
    id: "inbox",
    kicker: "INBOX",
    title: "Slimme inbox: nul handmatige invoer",
    desc: "Elke inkomende e-mail komt binnen in een gedeelde inbox. Voeg de AI Inbox add-on toe en AI leest het bericht en stelt direct het ticketonderwerp, de prioriteit en omschrijving op. Jij controleert, past aan indien nodig, en keurt goed met één klik. Minuten aan administratie worden seconden.",
    bullets: [
      "AI Inbox add-on stelt automatisch onderwerp, prioriteit en omschrijving op uit elke e-mail",
      "Bulkgoed keuren, archiveren of opnieuw toewijzen in één actie",
      "Gedeelde inbox voor het hele team. Geen CC-ketens meer.",
      "SLA-timers starten zodra een bericht binnenkomt",
    ],
    shot: "/shots/inbox.png",
    path: "/inbox",
    Icon: InboxIcon,
  },
  {
    id: "tickets",
    kicker: "TICKETS",
    title: "Tickets: alles bijhouden, niets missen",
    desc: "Na goedkeuring worden berichten gestructureerde supporttickets met een toegewezen medewerker, prioriteit, deadline en volledige e-mailgeschiedenis. SLA-meldingen gaan af voordat er iets misgaat, en bulkacties laten je een dozijn problemen tegelijk triageren.",
    bullets: [
      "SLA-deadlinebadges met kleurgecodeerde urgentiemeldingen",
      "Tickets toewijzen aan medewerkers of afdelingen met één klik",
      "Meerdere tickets tegelijk bulkselecteren, opnieuw toewijzen of sluiten",
      "Het volledige gesprek staat op het ticket. Geen inbox wisselen.",
    ],
    shot: "/shots/tickets.png",
    path: "/tickets",
    Icon: TicketIcon,
  },
  {
    id: "contacts",
    kicker: "CONTACTEN",
    title: "Contacten: altijd de volledige klantcontext",
    desc: "Elk contact heeft een complete tijdlijn: alle e-mails, tickets, pipelinestatus en bedrijfslidmaatschap in één overzicht. Labels, bedrijfsgroepering en CSV import/export betekenen dat je CRM hier staat, niet in een apart tabblad.",
    bullets: [
      "Gecombineerde tijdlijn van e-mails, tickets en pipelinebewegingen",
      "Bedrijfsgroepering: koppel contacten aan accounts met één klik",
      "Aangepaste labels voor segmentatie en snel filteren",
      "CSV import en export voor bestaande klantenlijsten",
    ],
    shot: "/shots/contacts.png",
    path: "/contacts",
    Icon: UsersIcon,
  },
  {
    id: "calendar",
    kicker: "AGENDA + BOEKINGEN",
    title: "Agenda: boekingen die zichzelf bevestigen",
    desc: "Een maandagenda toont evenementen, ticketdeadlines en geplande afspraken op één plek. Stuur een persoonlijke boekingslink zodat klanten zelf een geschikt moment kiezen, of stel zelf tijden voor. Bevestigingsmails gaan automatisch uit.",
    bullets: [
      "Maandagendaweergave met evenementen, deadlines en boekingen",
      "Persoonlijke boekingslinks. Klanten kiezen zelf hun tijdslot.",
      "Bevestigings en herinneringsmails worden automatisch verstuurd",
      "Boekingsbevestigingen kunnen een pipelinecontact naar de volgende fase schuiven",
    ],
    shot: "/shots/calendar.png",
    path: "/calendar",
    Icon: CalendarIcon,
  },
  {
    id: "pipeline",
    kicker: "PIPELINE",
    title: "Pipeline: elk deal in één oogopslag",
    desc: "Een drag-and-drop kanbanbord laat je contacten door aangepaste fases volgen, van eerste contact tot gesloten deal. Campagneknopppen in e-mails kunnen een contact automatisch naar de juiste fase verplaatsen zodra ze klikken.",
    bullets: [
      "Volledig aanpasbare kanbanfases. Geef ze elke naam.",
      "Contacten slepen tussen fases met directe opslag",
      "Campagneknopppen zetten contacten automatisch een stap verder bij klikken",
      "Boekingsbevestigingen activeren automatische fasebewegingen",
    ],
    shot: "/shots/pipeline.png",
    path: "/pipeline",
    Icon: KanbanIcon,
  },
  {
    id: "chat",
    kicker: "LIVE CHAT",
    title: "Live chat: één widget, dezelfde inbox",
    desc: "Voeg een chatwidget toe aan je website met één scriptregel. Elk bezoekersgesprèk komt in de gedeelde inbox naast e-mail en tickets, zodat je team alles op één plek ziet zonder te wisselen van tabblad.",
    bullets: [
      "Eénregelige embedscript. Live in minuten, geen tools van derden.",
      "Chatgesprekken verschijnen automatisch in de gedeelde inbox",
      "Chats toewijzen aan medewerkers of laten claimen door het team",
      "Volledige chatgeschiedenis gekoppeld aan het contactrecord",
    ],
    shot: "/shots/chat.png",
    path: "/chat",
    Icon: ChatIcon,
  },
  {
    id: "marketing",
    kicker: "MARKETING",
    title: "Marketing: campagnes die converteren",
    desc: "Stuur gepersonaliseerde e-mailcampagnes naar elk publiekssegment, voer A/B-tests uit en volg elke opening en klik in realtime. Contacten zetten automatisch een stap verder in je pipeline wanneer ze op een actieknop klikken. Geen CRM-administratie vereist. Direct ingebouwd in je werkruimte.",
    bullets: [
      "Drag-and-drop e-maileditor met A/B varianttests",
      "Fasegericht publiek: stuur naar alle contacten in een kanbanfase tegelijk",
      "Contacten zetten automatisch een stap verder in je pipeline wanneer ze op een actieknop klikken",
      "Realtime tracking van openingen, klikken en bounces op alle verzendingen",
      "Dripsequenties voor geautomatiseerde follow-up totdat een contact reageert",
    ],
    shot: "/shots/marketing.png",
    path: "/marketing",
    Icon: MailTrackIcon,
  },
  {
    id: "departments",
    kicker: "AFDELINGEN",
    title: "Afdelingen: de juiste persoon, elke keer",
    desc: "Maak afdelingen aan, voeg medewerkers toe aan elke afdeling en laat inkomende e-mail automatisch doorsturen naar het juiste team. Tickets en live chats volgen dezelfde routeringsregels, zodat klantvragen nooit in de verkeerde inbox belanden.",
    bullets: [
      "Afdelingen aanmaken en medewerkers toewijzen met één klik",
      "Inkomende e-mail wordt automatisch gerouteerd op ontvangstadres",
      "Tickets nemen de afdeling mee van inbox tot afhandeling",
      "Persoonlijke afdelingsinboxtabbladen in de gedeelde inbox",
    ],
    shot: "/shots/departments.png",
    path: "/settings/departments",
    Icon: TeamIcon,
  },
  {
    id: "billing",
    kicker: "FACTURATIE",
    title: "Facturatie: facturen zonder gedoe",
    desc: "Maak facturen aan en verstuur ze direct vanuit je werkruimte. Volg betalingsstatus, exporteer in bulk voor je boekhouder en sla KvK en BTW-nummers op bij elk contact. Geen apart factuurprogramma nodig.",
    bullets: [
      "Facturen aanmaken met regelitems, vervaldatums en statustracking",
      "Facturen in bulk verwijderen of exporteren als CSV of XLSX",
      "KvK en BTW-nummers opslaan bij de organisatie en contacten",
      "Direct zoeken door alle facturen",
    ],
    shot: "/shots/billing.png",
    path: "/billing",
    Icon: BillingIcon,
  },
  {
    id: "contracts",
    kicker: "CONTRACTEN",
    title: "Contracten: ondertekenen, opslaan en nooit een verlenging missen",
    desc: "Sla ondertekende contracten op bij elk contact, volg opzegtermijnen en verlengingsdata en ontvang een herinnering voordat er iets verloopt. Upload pdf's of stuur ter elektronische ondertekening direct vanuit je werkruimte.",
    bullets: [
      "Contracten uploaden en koppelen aan elk contact of bedrijf",
      "Verlengingsdata en opzegtermijnen bijhouden met automatische herinneringen",
      "Contracten ter ondertekening sturen zonder Yippie te verlaten",
      "Filteren op status: concept, verstuurd, ondertekend, verlopen",
    ],
    shot: "/shots/contracts.png",
    path: "/contracts",
    Icon: ContractIcon,
  },
  {
    id: "activity",
    kicker: "ACTIVITEIT",
    title: "Activiteit: je bedrijf in realtime",
    desc: "Een chronologische feed van alles wat er in je werkruimte gebeurt: e-mails verstuurd, tickets bijgewerkt, contacten verplaatst, boekingen bevestigd. Altijd weten wie wat deed en wanneer, zonder te hoeven vragen.",
    bullets: [
      "Realtime log van elke actie op het platform",
      "Filteren op gebeurtenistype, gebruiker of datumbereik",
      "Ticket en contactlinks brengen je direct naar de context",
      "Perfecte audittrail voor teamverantwoordelijkheid",
    ],
    shot: "/shots/activity.png",
    path: "/activity",
    Icon: ActivityIcon,
  },
  {
    id: "team",
    kicker: "TEAM",
    title: "Team: de juiste persoon op elk ticket",
    desc: "Nodig medewerkers uit, stel hun rol in (medewerker, beheerder of supergebruiker) en organiseer ze in afdelingen. Tickets en chats worden automatisch naar de juiste afdeling gerouteerd, zodat de juiste persoon altijd het juiste gesprek oppakt.",
    bullets: [
      "Rolgebaseerde rechten: lagen voor medewerker, beheerder en supergebruiker",
      "Afdelingen voor overzichtelijke routering van tickets en gesprekken",
      "Nieuwe teamleden uitnodigen met één e-maillink",
      "Meerdere benoemde e-mailhandtekeningen per gebruiker",
    ],
    shot: "/shots/team.png",
    path: "/settings/team",
    Icon: TeamIcon,
  },
  {
    id: "templates",
    kicker: "SJABLONEN",
    title: "Sjablonen: antwoorden die altijd on-brand zijn",
    desc: "Bouw een bibliotheek met standaardantwoorden voor je meestgestelde vragen. Medewerkers kiezen het juiste sjabloon met één klik en personaliseren voor het versturen. Elk antwoord is snel, consistent en on-brand.",
    bullets: [
      "Gedeelde sjablonenbibliotheek voor het hele team",
      "Personaliseer voor het versturen. Bewerk inline zonder het ticket te verlaten.",
      "Drag-and-drop e-maileditor voor rijke HTML-campagnes",
      "Door AI aangedreven onderwerp en tekstsuggesties",
    ],
    shot: "/shots/templates.png",
    path: "/settings/templates",
    Icon: TemplateIcon,
  },
  {
    id: "tracking",
    kicker: "ZENDINGTRACKING",
    title: "Zendingtracking: alle zendingen in één overzicht",
    desc: "Koppel je ERP of webshop en Yippie maakt of bijgewerkte contacten automatisch aan bij elke bestelling. Live vervoerdersupdates voor DHL, UPS, PostNL en FedEx staan direct naast het ticket van de klant. Geen kopiëren en plakken.",
    bullets: [
      "DHL, UPS, FedEx en PostNL tracking standaard ingebouwd",
      "Zendingen koppelen aan contacten en tickets voor volledige context",
      "Live statusupdates: in behandeling, onderweg, bezorgd",
      "Bezorgmeldingen houden je team en klant op de hoogte",
      "ERP-ordersynchronisatie: contacten worden automatisch aangemaakt of bijgewerkt bij elke bestelling",
    ],
    shot: "/shots/tracking.png",
    path: "/tracking",
    Icon: TrackingIcon,
  },
  {
    id: "sales",
    kicker: "SALES",
    title: "Sales: begrijp wat converteert",
    desc: "Volg elke productweergave, winkelwagentoeevoeging en aankoopgebeurtenis vanuit je webshop. Zie welke contacten koopintentie tonen en start support of outreach op precies het juiste moment.",
    bullets: [
      "Realtime feed van productweergaven, winkelwagen en aankoopgebeurtenissen",
      "Omzet en conversiesamenvatting per contact",
      "Hoge-intentiesignalen verschijnen automatisch in de inbox",
      "Geen analysetool van derden nodig",
    ],
    shot: "/shots/sales.png",
    path: "/sales",
    Icon: SalesIcon,
  },
  {
    id: "saas",
    kicker: "SAAS ANALYTICS",
    title: "SaaS Analytics: abonnementen en MRR in één oogopslag",
    desc: "Beheer terugkerende abonnementen, volg MRR en churn en koppel elk abonnement aan een contact. Je finance en supportteam zien dezelfde data. Geen spreadsheetexports meer nodig.",
    bullets: [
      "Maandelijkse of jaarlijkse abonnementen aanmaken en beheren",
      "MRR, churn en lifetime value automatisch bijgehouden",
      "Elk abonnement gekoppeld aan een contactrecord",
      "CSV-export voor je boekhouder met één klik",
    ],
    shot: "/shots/saas.png",
    path: "/saas",
    Icon: SaasIcon,
  },
];

/** Minimal browser-chrome frame wrapping a screenshot (or placeholder). */
function ScreenshotFrame({
  src,
  alt,
  url,
  Icon,
}: {
  src: string;
  alt: string;
  url: string;
  Icon: React.ComponentType<{ size?: number }>;
}) {
  return (
    <div className={styles.frame}>
      <div className={styles.frameBar}>
        <span className={styles.dot} />
        <span className={styles.dot} />
        <span className={styles.dot} />
        <span className={styles.frameUrl}>
          app.getyippie.com{url}
        </span>
      </div>
      <div className={styles.screenshotWrap}>
        <Lightbox src={src} alt={alt} imageClassName={styles.screenshot} />
        {/* Fallback overlay — visible only when image fails to load.
            We always render the Image; the placeholder is layered behind. */}
        <div className={styles.screenshotPlaceholder} aria-hidden="true">
          <span className={styles.placeholderIcon}>
            <Icon size={22} />
          </span>
          <span className={styles.placeholderLabel}>
            // schermafbeelding binnenkort beschikbaar
          </span>
        </div>
      </div>
    </div>
  );
}

export default function ModulesPage() {
  return (
    <div className={contentStyles.page}>
      <SiteNav />

      {/* Hero */}
      <section className={contentStyles.hero}>
        <img src="/logo-white-bg-mark.svg" alt="" aria-hidden="true" className={contentStyles.pageLogoMark} />
        <div className={contentStyles.heroTag}>
          <span className={contentStyles.heroTagDot} />
          Het product
        </div>
        <h1 className={contentStyles.heroTitle}>
          Zestien modules. Één platform.
        </h1>
        <p className={contentStyles.heroSub}>
          Inbox, tickets, contacten, agenda, pipeline, live chat, marketing,
          afdelingen, facturatie, sjablonen, activiteit, team, zendingtracking, sales en
          SaaS Analytics, allemaal samen in één werkruimte.
        </p>
        <div className={contentStyles.heroActions}>
          <a href={DEMO_URL} className={contentStyles.btnPrimary}>
            Demo aanvragen →
          </a>
          <a href="/pricing" className={contentStyles.btnGhost}>
            Alle functies
          </a>
        </div>
      </section>

      {/* Sticky module nav */}
      <nav className={styles.nav} aria-label="Modulenavigatie">
        <div className={styles.navInner}>
          {modules.map((m) => (
            <a key={m.id} href={`#${m.id}`} className={styles.navLink}>
              <m.Icon size={13} />
              {m.kicker.split(" ")[0]}
            </a>
          ))}
        </div>
      </nav>

      {/* Module blocks */}
      {modules.map((mod, i) => {
        const isEven = i % 2 === 1; // odd index → alt bg
        const isReverse = i % 2 === 0; // even index → image right, copy left

        return (
          <section
            key={mod.id}
            id={mod.id}
            className={isEven ? styles.blockAlt : undefined}
          >
            <Reveal
              className={`${styles.block} ${isReverse ? styles.reverse : ""}`}
              delay={0}
            >
              {/* Copy */}
              <div className={styles.copy}>
                <p className={styles.kicker}>
                  <span className={styles.kickerIcon}>
                    <mod.Icon size={16} />
                  </span>
                  // {mod.kicker}
                </p>
                <h2 className={styles.title}>{mod.title}</h2>
                <p className={styles.desc}>{mod.desc}</p>
                <ul className={styles.bullets}>
                  {mod.bullets.map((b) => (
                    <li key={b} className={styles.bullet}>
                      <CheckIcon size={15} className={styles.bulletCheck} />
                      {b}
                    </li>
                  ))}
                </ul>
                <a href="/request-demo" className={styles.openBtn}>
                  Bekijk het in een demo
                  <ArrowRightIcon size={15} />
                </a>
              </div>

              {/* Visual */}
              <div className={styles.visual}>
                <ScreenshotFrame
                  src={mod.shot}
                  alt={`${mod.title} schermafbeelding`}
                  url={mod.path}
                  Icon={mod.Icon}
                />
              </div>
            </Reveal>
          </section>
        );
      })}

      {/* Closing CTA */}
      <section className={styles.ctaSection}>
        <Reveal className={styles.ctaInner}>
          <p className={styles.ctaEyebrow}>// Klaar om het te proberen?</p>
          <h2 className={styles.ctaTitle}>
            Zie elke module live in je inbox
          </h2>
          <p className={styles.ctaSub}>
            Boek een persoonlijke demo en zie hoe Yippie je inbox,
            tickets en pipeline verbindt in één overzichtelijke werkruimte.
          </p>
          <a href={DEMO_URL} className={styles.ctaBtn}>
            Demo aanvragen <ArrowRightIcon size={16} />
          </a>
          <p className={styles.ctaMeta}>Geen creditcard · In minuten opgezet</p>
        </Reveal>
      </section>

      <SiteFooter />
    </div>
  );
}
