import type { Metadata } from "next";
import SiteNav from "../../components/SiteNav";
import SiteFooter from "../../components/SiteFooter";
import styles from "../../components/content.module.css";
import { breadcrumbJsonLd } from "../jsonld";

const DEMO_URL = process.env.NEXT_PUBLIC_DEMO_URL ?? "/request-demo";

const TITLE = "De twee extremen van klantenservice — en waarom het MKB er tussenin zit";
const DESCRIPTION =
  "De meeste klantenservice software is gebouwd voor twee extremen: chaos in een gedeelde inbox, of enterprise-complexiteit voor grote teams. MKB verdient iets daartussenin. Dit is hoe dat eruitziet.";
const URL = "https://getyippie.com/blog/klantenservice_software_voor_mkb";
const DATE = "2026-07-10";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/blog/klantenservice_software_voor_mkb" },
  keywords: [
    "klantenservice software",
    "klantenservice software voor MKB",
    "gedeelde inbox",
    "helpdesk MKB",
    "klantenservice automatisering",
    "MKB software",
  ],
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
  inLanguage: "nl",
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
        <div className={styles.articleDate}>10 juli 2026</div>
        <h1 className={styles.articleTitle}>{TITLE}</h1>
        <div className={styles.articleByline}>Door Diederik Brinkman</div>

        <div className={styles.articleBody}>
          <p>
            Klantenservice software bestaat in twee smaken. Aan de ene kant: een gedeelde Gmail- of
            Outlook-inbox waar het hele team inlogt. Aan de andere kant: Zendesk, Freshdesk en hun
            enterprise-neven, met prijspagina&apos;s die zeggen &quot;Contact sales&quot; en
            implementatieprocessen die meer kosten dan de software zelf.
          </p>
          <p>
            MKB-bedrijven zitten ongemakkelijk in het midden. Te groot voor de chaos van een
            gedeelde inbox. Te klein — en te nuchter — om enterprise-software te rechtvaardigen
            die is gebouwd voor teams van vijfhonderd mensen.
          </p>
          <p>
            Ik bouwde Yippie omdat ik deze situatie steeds opnieuw zag. Hieronder leg ik uit hoe
            beide extremen er in de praktijk uitzien als ze misgaan.
          </p>

          <h2>Extreem één: de gedeelde inbox</h2>
          <p>
            Een team deelt één e-mailadres voor klantvragen. Iedereen heeft het wachtwoord.
            Berichten komen binnen, worden soms gelezen, soms beantwoord, en soms vergeten. Zo
            loopt het vast.
          </p>
          <p>
            Twee mensen reageren op hetzelfde bericht. De klant krijgt twee tegenstrijdige antwoorden
            — de ene van een medewerker die de thread dinsdagochtend las, de andere van iemand die
            hem dinsdagmiddag opende en niet wist dat er al gereageerd was. Lastig te herstellen,
            en schadelijk voor het vertrouwen.
          </p>
          <p>
            Of de stillere variant: een bericht blijft drie dagen onaangeroerd in de inbox staan
            omdat iedereen ervan uitging dat een ander het oppakte. Niemand had het in bezit genomen.
            Niemand vroeg ernaar. De klant&apos;s vervolgmailtje — &quot;heeft u mijn bericht ontvangen?&quot;
            — is het eerste signaal dat er iets mis ging.
          </p>
          <p>
            En dan is er het kanaalprobleem dat elk jaar erger wordt. Dezelfde klant stuurt je een
            e-mail én een WhatsApp-bericht. In een gedeelde inbox zijn dat twee losse threads in
            twee verschillende systemen. Eén medewerker handelt de e-mail af, een ander pakt
            de WhatsApp op — en geen van beiden weet van de ander. De klant moet zichzelf tweemaal
            uitleggen, en je team heeft twee aparte contactrecords aangemaakt voor dezelfde persoon.
            Niemand heeft het complete plaatje. Iedereen begint opnieuw.
          </p>

          <h2>Extreem twee: de enterprise-tool</h2>
          <p>
            Je besluit een serieuze oplossing te zoeken. Je belandt op Zendesk, Freshdesk of
            Zoho Desk. De functieoverzichten zijn indrukwekkend. Dan begin je te configureren.
          </p>
          <p>
            SLA-beleid met meerdere goedkeuringsniveaus. Manager-akkoord voordat een escalatie
            plaatsvindt. Routeringsregels op basis van vaardigheden, zodat tickets worden toegewezen
            aan specialisten via tagcombinaties. Dit zijn echte functies die echte problemen oplossen
            — voor een supportafdeling van tweehonderd mensen waar een verkeerde escalatie daadwerkelijk
            een incident veroorzaakt.
          </p>
          <p>
            Voor een team van drie mensen is het wrijving. Je besteedt een zaterdag aan het
            instellen van routeringsregels voor een team dat klein genoeg is om naar elkaar te
            roepen. Je configureert SLA-beleid voor tickets die iedereen al urgent noemt, simpelweg
            omdat je de klantnaam in de onderwerpregel ziet.
          </p>
          <p>
            De prijs is de laatste klap. Per-agent-kosten die stijgen elke keer dat je iemand
            aanneemt. Jaarcontracten voordat je weet of het systeem überhaupt bij je past. Minimums,
            add-ons, een &quot;Contact sales&quot;-knop waar de prijs zou moeten staan. Ik opende
            ooit een prijspagina van een concurrent en probeerde te berekenen wat het zou kosten
            voor een team van tien met de functies die we nodig hadden. Ik gaf het op voor ik
            het antwoord vond. Dat is geen toeval.
          </p>

          <h2>Waarom het midden zo slecht bediend wordt</h2>
          <p>
            De gedeelde inbox is gratis en vertrouwd. Enterprise-software is goed gefinancierd en
            functierijk. Bedrijven die software bouwen voor het MKB beginnen óf vanuit een van
            deze twee kanten en voegen functies toe, óf ze bouwen iets zo generiek dat het geen
            van beide problemen goed oplost.
          </p>
          <p>
            Wat een team van tien mensen echt nodig heeft is niet ingewikkeld. Ze willen weten wie
            welk bericht in behandeling heeft. Ze willen een overzicht dat e-mail en WhatsApp
            samenvoegt zodat één klant één contactrecord heeft. Ze willen iets wat in vijf minuten
            draait, niet vijf dagen. En ze willen een prijs die er niet van uitgaat dat ze een
            kostenplaats zijn met een eigen inkoopteam.
          </p>
          <p>
            Dit is het ontwerp van Yippie. Vaste werkruimteprijzen — één bedrag, ongeacht hoeveel
            medewerkers je toevoegt. Een inbox die e-mail en WhatsApp samenvoegt zodat één
            contactrecord per klant bestaat. AI die inkomende berichten leest en de ticketomschrijving
            schrijft zodat je team controleert in plaats van typt. Geen goedkeuringsworkflows,
            geen routeringsregels, geen &quot;Contact sales.&quot;
          </p>
          <p>
            Het doel is niet een afgeslankte Zendesk te zijn. Het doel is precies de juiste maat
            voor een team dat klantenservice serieus neemt, maar vandaag ook nog tien andere dingen
            te doen heeft.
          </p>
        </div>

        <div className={styles.articleCta}>
          <p className={styles.articleCtaTitle}>Benieuwd hoe het midden eruitziet?</p>
          <a href={DEMO_URL} className={styles.btnPrimary}>Demo aanvragen →</a>
        </div>
      </article>

      <SiteFooter />
    </div>
  );
}
