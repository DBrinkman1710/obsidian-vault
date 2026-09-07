import type { Metadata } from "next";
import SiteNav from "../../components/SiteNav";
import SiteFooter from "../../components/SiteFooter";
import styles from "../../components/content.module.css";
import { breadcrumbJsonLd } from "../jsonld";

const DEMO_URL = process.env.NEXT_PUBLIC_DEMO_URL ?? "/request-demo";

const TITLE = "Gedeelde inbox vs. gewone e-mail: wanneer maak je de overstap?";
const DESCRIPTION =
  "Regel je support nog vanuit een gewone inbox? Zo weet je wanneer gedeelde inbox software loont, en wat je er echt mee wint als je de overstap maakt.";
const URL = "https://getyippie.com/blog/shared_inbox_vs_regular_email";
const DATE = "2026-06-19";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/blog/shared_inbox_vs_regular_email" },
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
        <div className={styles.articleDate}>19 juni 2026</div>
        <h1 className={styles.articleTitle}>{TITLE}</h1>
        <div className={styles.articleByline}>Door Diederik Brinkman</div>

        <div className={styles.articleBody}>
          <p>
            Teams houden het langer vol met gewone e-mail dan ze zouden moeten. Het werkt —
            totdat het dat niet meer doet. Op het moment dat een tweede persoon de
            supportrotatie betreedt, verschijnen de barsten: dubbele reacties, berichten
            die door de mazen vallen, geen manier om te zien wie wat behandelt. Dat is
            doorgaans het moment waarop de zoektocht naar een <strong>gedeelde inbox</strong>
            begint. Zo weet je of je dat punt al bereikt hebt, en wat de upgrade je echt
            oplevert.
          </p>

          <h2>1. Het probleem van botsende reacties</h2>
          <p>
            Gewone e-mail is ontworpen voor één-op-één communicatie. Wanneer twee mensen
            toegang delen tot een supportinbox (via een doorgestuurd alias of een gedeeld
            inlogaccount) reageren ze onvermijdelijk op hetzelfde bericht, of gaat elke
            partij ervan uit dat de ander het afhandelde. Volgens Salesforce-onderzoek
            noemen 63 procent van de serviceteams dubbele afhandeling en gemiste berichten
            als hun meest voorkomende coördinatiefout. Een gedeelde inbox wijst elk gesprek
            toe aan één eigenaar, waardoor botsingen ophouden.
          </p>

          <h2>2. Je verliest de draad zodra je doorstuurt</h2>
          <p>
            De meest gebruikte noodoplossing bij gewone e-mail is doorsturen. Iemand ziet
            een klantvraag, stuurt die door naar de juiste collega, en hoopt dat het antwoord
            terugkomt. Elk doorstuurmoment kost tijd, vaak uren, en slokt onderweg context op.
            Een gedeelde inbox houdt de volledige klanthistorie voor iedereen zichtbaar, op
            één plek, zonder doorstuurbehoefte.
          </p>

          <h2>3. Er is geen zicht op de wachtrij</h2>
          <p>
            Met een gewone inbox zie je niet wat er staat te wachten, wat te laat is, of
            wat je werkelijke reactietijd is. Die onzichtbaarheid maakt verbetering onmogelijk.
            Helpdesk software met een gedeelde inbox geeft je deze maatstaven standaard:
            eerste reactietijd, oplostijd en ticketachterstand in één oogopslag. Je kunt
            niet verbeteren wat je niet kunt zien.
          </p>

          <h2>4. SLA's hebben een systeem nodig om ze na te leven</h2>
          <p>
            Een reactietijddoel instellen is makkelijk. Het halen is moeilijk zonder
            software die het bijhoudt. Een gedeelde inbox met SLA-ondersteuning toont
            deadlinebadges op elk open ticket en stuurt een waarschuwing voordat er één
            over tijd gaat, zodat managers een helder beeld hebben van waar het team
            staat. Dat soort zichtbaarheid is onmogelijk te repliceren in een standaard
            e-mailclient.
          </p>

          <h2>5. Wanneer gewone e-mail nog prima werkt</h2>
          <p>
            Als jij de enige bent die support afhandelt en het volume laag is, werkt
            een gewone inbox met goede labelgewoonten prima. Het kantelpunt is doorgaans
            de tweede supportmedewerker, of ruwweg 20 tot 30 tickets per week. Daarna
            kosten de coördinatie-overhead van gewone e-mail meer tijd dan de overstap
            ooit zou kosten.
          </p>

          <p>
            De overstap van gewone e-mail naar een gedeelde inbox is geen groot project.
            De meeste teams draaien binnen een ochtend. Het moeilijkste deel is weten
            wanneer je het moet doen. De meeste teams wachten te lang.
          </p>
        </div>

        <div className={styles.articleCta}>
          <p className={styles.articleCtaTitle}>Regel je support vanuit één inbox</p>
          <a href={DEMO_URL} className={styles.btnPrimary}>Demo aanvragen →</a>
        </div>
      </article>

      <SiteFooter />
    </div>
  );
}
