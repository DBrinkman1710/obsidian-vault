import type { Metadata } from "next";
import SiteNav from "../../components/SiteNav";
import SiteFooter from "../../components/SiteFooter";
import styles from "../../components/content.module.css";
import { breadcrumbJsonLd } from "../jsonld";

const DEMO_URL = process.env.NEXT_PUBLIC_DEMO_URL ?? "/request-demo";

const TITLE = "Wat een trage klantenservice reactie je echt kost";
const DESCRIPTION =
  "Trage support is niet alleen frustrerend: het kost omzet, leidt tot negatieve reviews en creëert meer werk intern. Dit is wat de cijfers zeggen.";
const URL = "https://getyippie.com/blog/cost_of_slow_customer_service_response";
const DATE = "2026-06-26";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/blog/cost_of_slow_customer_service_response" },
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
        <div className={styles.articleDate}>26 juni 2026</div>
        <h1 className={styles.articleTitle}>{TITLE}</h1>
        <div className={styles.articleByline}>Door Diederik Brinkman</div>

        <div className={styles.articleBody}>
          <p>
            De meeste kleine ondernemingen weten dat trage support slecht is. Minder weten
            precies hoe slecht, of hoe snel de kosten zich opstapelen. Het is niet alleen
            een verloren klant. Het is een klant die het anderen vertelt, een review die
            toekomstige kopers afschrikt, en een concurrentievoordeel dat je weggeeft aan
            degene die sneller reageert. Dit is wat het onderzoek werkelijk laat zien.
          </p>

          <h2>Het eerste uur telt zwaarder dan je denkt</h2>
          <p>
            Een onderzoek van Harvard Business Review onder B2B-bedrijven toonde aan dat
            bedrijven die binnen het eerste uur reageerden op een aanvraag bijna zeven keer
            zo vaak een zinvol vervolgsgesprek hadden als bedrijven die zelfs maar twee uur
            wachtten. Het venster voor een warme reactie sluit snel. Tegen de tijd dat een
            klant een halve dag heeft gewacht, zijn de kansen op een productief resultaat
            aanzienlijk gedaald, en de klant voelt dat ook.
          </p>

          <h2>Trage reacties leiden tot negatieve reviews</h2>
          <p>
            Wanneer klanten ontevreden zijn over de reactietijd, zeggen ze dat publiekelijk.
            Volgens Zendesk&apos;s CX Trends-onderzoek zou 61 procent van de klanten na één slechte
            service-ervaring overstappen naar een concurrent. Snelheid is niet de enige factor,
            maar het is degene die klanten direct voelen. Een trage reactie op een gevoelig
            probleem is vaak wat iemand aanzet tot het schrijven van een review die ze
            anders nooit hadden geschreven.
          </p>

          <h2>De tijdkosten vallen ook op je team</h2>
          <p>
            Trage reacties zijn niet alleen een klantervaring-probleem: ze creëren ook meer
            werk intern. Klanten die nog niets gehoord hebben, sturen een vervolgbericht,
            soms meerdere keren. Elk vervolgbericht is weer een bericht om te lezen, te
            triagen en te beantwoorden. SuperOffice-onderzoek toonde aan dat de gemiddelde
            eerste reactietijd voor klantenservice-e-mails over alle sectoren heen meer dan
            12 uur is. Dat gat vult zich met chasemailtjes die er nooit hadden hoeven zijn.
          </p>

          <h2>Prijskracht neemt af bij slechte service</h2>
          <p>
            Goede service stelt je in staat meer te vragen. De American Express Customer
            Service Barometer toonde aan dat consumenten bereid zijn gemiddeld 17 procent
            meer te besteden bij bedrijven die uitstekende service leveren. Het omgekeerde
            geldt ook: klanten die het gevoel hebben dat hun tijd verspild is, haken vaak
            volledig af en nemen hun volledige klantwaarde mee. Reactietijd is niet alleen
            een servicemaat: het werkt rechtstreeks door op de omzet.
          </p>

          <h2>Wat snel precies betekent, per kanaal</h2>
          <p>
            Klanten definiëren snel anders afhankelijk van waar ze je bereikten. Forrester-onderzoek
            laat zien dat 41 procent van de klanten een e-mailreactie verwacht binnen zes uur.
            Voor live chat is de verwachting onder een minuut. Verschillende SLA's per kanaal
            instellen en ze consistent nakomen is wat onderscheidt: bedrijven die klanten
            behouden van bedrijven die ze bij het tweede contact verliezen.
          </p>

          <p>
            De rekensom is ongemakkelijk maar helder: trage support kost geld in elke richting.
            Het goede nieuws is dat reactietijd één van de meest oplosbare maatstaven in het
            bedrijf is. De bottleneck is bijna nooit het team. Het zijn de tools en de workflow
            eromheen.
          </p>
        </div>

        <div className={styles.articleCta}>
          <p className={styles.articleCtaTitle}>Haal elke SLA met Yippie</p>
          <a href={DEMO_URL} className={styles.btnPrimary}>Demo aanvragen →</a>
        </div>
      </article>

      <SiteFooter />
    </div>
  );
}
