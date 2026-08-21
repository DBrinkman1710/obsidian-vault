import type { Metadata } from "next";
import SiteNav from "../../components/SiteNav";
import SiteFooter from "../../components/SiteFooter";
import styles from "../../components/content.module.css";
import { breadcrumbJsonLd } from "../jsonld";

const DEMO_URL = process.env.NEXT_PUBLIC_DEMO_URL ?? "/request-demo";

const TITLE = "Hoe je je klantenservice reactietijd halveert";
const DESCRIPTION =
  "Reactietijd verkorten zonder extra personeel? Gebruik templates, SLA's, inbox triage en nette teamoverdrachten in je helpdesk software om sneller te reageren.";
const URL = "https://getyippie.com/blog/how-to-reduce-customer-service-response-time";
const DATE = "2026-06-05";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/blog/how-to-reduce-customer-service-response-time" },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: URL,
    type: "article",
    publishedTime: DATE,
  },
};

const articleJsonLd = {
  "@context": "https://schema.org",
  "@type": "Article",
  headline: TITLE,
  description: DESCRIPTION,
  datePublished: DATE,
  dateModified: DATE,
  author: { "@type": "Person", name: "Diederik Brinkman" },
  publisher: {
    "@type": "Organization",
    name: "Yippie",
    logo: { "@type": "ImageObject", url: "https://getyippie.com/logo.svg" },
  },
  mainEntityOfPage: { "@type": "WebPage", "@id": URL },
};

export default function Post() {
  return (
    <div className={styles.page}>
      <SiteNav />

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd(TITLE, URL)) }}
      />

      <article className={styles.article}>
        <a href="/blog" className={styles.backLink}>← Terug naar blog</a>
        <div className={styles.articleDate}>5 juni 2026</div>
        <h1 className={styles.articleTitle}>{TITLE}</h1>
        <div className={styles.articleByline}>Door Diederik Brinkman</div>

        <div className={styles.articleBody}>
          <p>
            Reactietijd is de maatstaf die klanten als eerste voelen. Een snelle reactie
            geeft aan dat je er om geeft; een trage ondermijnt stilletjes het vertrouwen.
            Het goede nieuws: je kunt de <strong>klantenservice reactietijd</strong> drastisch
            verkorten zonder één extra persoon in te huren. Het draait om wrijving uit je
            supportworkflow te verwijderen. Vijf tactieken die de reactietijd consequent
            halveren.
          </p>

          <h2>1. Bouw een bibliotheek met reactie-templates</h2>
          <p>
            De meeste vragen herhalen zich. Sla je beste antwoorden op als herbruikbare
            templates zodat medewerkers starten vanaf 80% in plaats van een leeg scherm.
            De juiste helpdesk software laat je een template invoegen en personaliseren
            in seconden — een reactie van vijf minuten wordt er één van dertig seconden.
          </p>

          <h2>2. Stel SLA's in en maak ze zichtbaar</h2>
          <p>
            Een serviceniveau-afspraak is alleen nuttig als je team de klok ziet. Deadlinebadges
            en SLA-waarschuwingen die afgaan <em>voordat</em> een ticket te laat is, voorkomen
            dat urgente verzoeken stil verouderen in de wachtrij. Als het doel op het scherm
            staat, beweegt het hele team om het te halen.
          </p>

          <h2>3. Triage de inbox voordat je antwoordt</h2>
          <p>
            Beantwoorden in de volgorde van binnenkomst is traag en oneerlijk voor urgente
            gevallen. Sorteer eerst op prioriteit. AI inbox triage kan elk inkomend bericht
            lezen, urgente zaken markeren en naar de juiste persoon routeren, zodat de
            belangrijke tickets als eerste worden beantwoord, automatisch.
          </p>

          <h2>4. Zorg voor nette teamoverdrachten</h2>
          <p>
            Reactietijd loopt op wanneer een ticket tussen mensen stuitert die elk de context
            opnieuw moeten opbouwen. Een gedeelde inbox met volledige klanthistorie en
            duidelijk eigenaarschap betekent dat wie een gesprek oppakt de achtergrond al
            kent. Niet opnieuw vragen, niet opnieuw uitleggen.
          </p>

          <h2>5. Laat AI de eerste reactie opstellen</h2>
          <p>
            Voorgestelde reacties geven medewerkers een compleet concept om direct goed te
            keuren of bij te schaven. Combineer dat met een verbeteringsronde voor toon, en
            je team stuurt verzorgde antwoorden sneller dan ze &quot;Goedemiddag&quot; kunnen typen.
          </p>

          <p>
            Zet dit samen en de rekensom is simpel: minder tijd zoeken, minder tijd typen,
            minder tijd wachten in de wachtrij. Snellere reacties betekenen tevredener klanten,
            en een supportteam dat eindelijk voor de inbox loopt in plaats van eronder bedolven.
          </p>
        </div>

        <div className={styles.articleCta}>
          <p className={styles.articleCtaTitle}>Reageer sneller met Yippie</p>
          <a href={DEMO_URL} className={styles.btnPrimary}>Demo aanvragen →</a>
        </div>
      </article>

      <SiteFooter />
    </div>
  );
}
