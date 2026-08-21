import type { Metadata } from "next";
import SiteNav from "../../components/SiteNav";
import SiteFooter from "../../components/SiteFooter";
import styles from "../../components/content.module.css";
import { breadcrumbJsonLd } from "../jsonld";

const DEMO_URL = process.env.NEXT_PUBLIC_DEMO_URL ?? "/request-demo";

const TITLE = "5 manieren waarop AI het MKB 10+ uur per week bespaart op klantenservice";
const DESCRIPTION =
  "AI klantenservice voor kleine ondernemingen geeft eigenaren 10+ uur per week terug via inbox triage, opgestelde reacties, suggesties en slimmere helpdesk software.";
const URL = "https://getyippie.com/blog/5-ways-ai-saves-smb-customer-service-time";
const DATE = "2026-06-12";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/blog/5-ways-ai-saves-smb-customer-service-time" },
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
        <div className={styles.articleDate}>12 juni 2026</div>
        <h1 className={styles.articleTitle}>{TITLE}</h1>
        <div className={styles.articleByline}>Door Diederik Brinkman</div>

        <div className={styles.articleBody}>
          <p>
            Voor een kleine onderneming is klantenservice de plek waar tijd stilletjes verdwijnt.
            Je beantwoordt dezelfde vragen, triage een verstrengelde inbox, en schrijft tickets
            met de hand. Het goede nieuws: <strong>AI klantenservice voor kleine
            ondernemingen</strong> is inmiddels volwassen genoeg om het routinewerk te
            afhandelen, niet door je team te vervangen, maar door het saaie werk van hun
            bureau te halen. Vijf manieren waarop dat oploopt tot 10+ uur per week.
          </p>

          <h2>1. AI triage je inbox automatisch</h2>
          <p>
            In plaats van elk bericht te lezen om te bepalen wat urgent is, laat moderne
            helpdesk software AI inkomende e-mails scannen, urgent van routinematig onderscheiden,
            en elk gesprek naar de juiste persoon routeren. Een gedeelde inbox die zichzelf
            sorteert betekent dat je ochtend begint met prioriteiten, niet met ruis.
          </p>

          <h2>2. AI maakt tickets voor je aan</h2>
          <p>
            Een ticket aanmaken (onderwerp, prioriteit, een heldere omschrijving) kost elke keer
            een à twee minuten, en die minuten stapelen zich op. AI leest het bericht van de klant
            en vult alle drie velden in. Jij controleert en keurt goed met één klik. Over tientallen
            tickets per dag telt dat op tot uren.
          </p>

          <h2>3. Voorgestelde reacties halveren het typen</h2>
          <p>
            De meeste supportantwoorden zijn variaties op een thema. AI stelt een complete,
            on-brand reactie voor die je direct kunt verzenden of in seconden kunt bijstellen.
            Een verbeteringsronde voor toon en grammatica zorgt ervoor dat zelfs haastige
            antwoorden klinken als je beste.
          </p>

          <h2>4. Klantbriefings elimineren de contextjacht</h2>
          <p>
            Voordat je antwoordt zoek je doorgaans door oude e-mails, tickets en notities om
            te herinneren wie deze klant is. AI vat de volledige geschiedenis samen in een korte
            briefing, zodat je elk gesprek al goed geïnformeerd ingaat. Geen gescrол meer nodig.
          </p>

          <h2>5. Automatisering regelt de opvolgacties</h2>
          <p>
            Boekingslinks, bevestigingsmails en pipelineupdates worden automatisch verstuurd.
            Wanneer een klant een gesprek inplant, stuurt de bevestiging zichzelf en verplaatst
            het contact naar de juiste fase. Het opvolgwerk dat vroeger bleef liggen, gebeurt
            nu gewoon vanzelf.
          </p>

          <p>
            Niets hiervan vervangt de menselijke touch. Het beschermt die juist. Door het
            repetitieve werk aan AI over te laten, besteden MKB-eigenaren hun uren aan de
            gesprekken die echt om een mens vragen. Dat is de echte belofte van AI in
            klantenservice software: niet minder mensen, maar meer tijd voor het werk dat
            er toe doet.
          </p>
        </div>

        <div className={styles.articleCta}>
          <p className={styles.articleCtaTitle}>Bekijk Yippie&apos;s AI in je eigen inbox</p>
          <a href={DEMO_URL} className={styles.btnPrimary}>Demo aanvragen →</a>
        </div>
      </article>

      <SiteFooter />
    </div>
  );
}
