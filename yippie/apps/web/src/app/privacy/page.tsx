import type { Metadata } from "next";
import SiteNav from "../components/SiteNav";
import SiteFooter from "../components/SiteFooter";
import styles from "../components/content.module.css";

const TITLE = "Privacybeleid | Yippie";
const DESCRIPTION =
  "Hoe Yippie je gegevens verzamelt, gebruikt en beschermt, inclusief ons gebruik van cookies en Google Analytics met Consent Mode.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/privacy" },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: "https://getyippie.com/privacy",
    type: "website",
  },
};

export default function PrivacyPage() {
  return (
    <div className={styles.page}>
      <SiteNav />

      <article className={styles.article}>
        {/* NL VERTALING — juridische tekst automatisch vertaald. Laten controleren door een jurist voordat je hierop vertrouwt. */}
        <div className={styles.articleDate}>Laatst bijgewerkt: 1 juli 2026</div>
        <h1 className={styles.articleTitle}>Privacybeleid</h1>

        <div className={styles.articleBody}>
          <p>
            Bij Yippie hechten we waarde aan transparantie. Dit beleid legt uit
            welke gegevens we verzamelen wanneer je getyippie.com bezoekt, waarom
            we dat doen, de wettelijke grondslag voor elk doel, en welke keuzes
            je hebt. We verzamelen alleen wat nodig is om de site te beheren en
            te verbeteren.
          </p>

          <h2>Verwerkingsverantwoordelijke</h2>
          <p>
            De partij die verantwoordelijk is voor de verwerking van je
            persoonsgegevens (verwerkingsverantwoordelijke) is:
          </p>
          <p>
            <strong>GetYippie</strong>
            <br />
            KVK nummer: 42124040
            <br />
            BTW nummer: NL005516514B24
            <br />
            E-mail:{" "}
            <a href="mailto:support@getyippie.com">support@getyippie.com</a>
          </p>

          <h2>Gegevens die we verzamelen en de wettelijke grondslag</h2>
          <p>
            We verwerken persoonsgegevens voor de volgende doeleinden. Bij elk
            doel vermelden we de wettelijke grondslag zoals vereist door artikel 6
            van de AVG (GDPR).
          </p>

          <h3>1. Website-analyse</h3>
          <p>
            We verzamelen <strong>anonieme gebruiksstatistieken</strong> (bekeken
            pagina's, geschatte locatie, type apparaat en browser, en hoe je de
            site hebt gevonden) om te begrijpen hoe de site wordt gebruikt en
            deze te verbeteren.
          </p>
          <p>
            <strong>Wettelijke grondslag:</strong> Toestemming (art. 6 lid 1
            onder a AVG). We activeren analytische cookies pas nadat je via onze
            cookiebanner akkoord hebt gegeven. Als je weigert, blijft analytics
            in cookieloze modus en worden er geen persoonsgegevens opgeslagen.
          </p>

          <h3>2. Demoverzoeken en contact</h3>
          <p>
            Als je een demo aanvraagt of contact met ons opneemt, verzamelen we
            de gegevens die je invult (zoals je naam, e-mailadres en bedrijf) om
            je vraag te beantwoorden en eventueel op te volgen.
          </p>
          <p>
            <strong>Wettelijke grondslag:</strong> Uitvoering van
            precontractuele maatregelen op jouw verzoek (art. 6 lid 1 onder b
            AVG) — de verwerking is noodzakelijk om stappen te ondernemen vóór
            het sluiten van een overeenkomst — en ons gerechtvaardigd belang bij
            het afhandelen van zakelijke vragen (art. 6 lid 1 onder f AVG).
          </p>

          <h2>Yippie Inbox Analyser: Chrome-extensie</h2>
          <p>
            De Yippie Inbox Analyser is een gratis Chrome-extensie die de
            metadata van je Gmail-inbox uitleest om te schatten hoeveel tijd je
            besteedt aan handmatige e-mailtriage.
          </p>

          <h3>Wat de extensie toegang tot heeft</h3>
          <p>
            De extensie vraagt de <strong>gmail.metadata</strong> OAuth-scope
            aan. Dit geeft alleen leestoegang tot e-mailmetadata: het
            afzenderadres, ontvangersadres, onderwerpregel en de datum van elk
            bericht. Er wordt <strong>geen</strong> toegang verleend tot
            berichtteksten, bijlagen, concepten of andere inhoud.
          </p>

          <h3>Waar je gegevens worden verwerkt</h3>
          <p>
            Alle analyse vindt <strong>volledig in je browser</strong> plaats.
            Je e-mailmetadata wordt rechtstreeks van Gmail naar je apparaat
            opgehaald en wordt nooit doorgezonden naar de servers van Yippie,
            opgeslagen in een database, of gedeeld met derden. De extensie heeft
            geen backend en stuurt geen uitgaande verzoeken, behalve naar de
            Gmail API namens jou.
          </p>

          <h3>Wat lokaal wordt opgeslagen</h3>
          <p>
            De extensie gebruikt <code>chrome.storage.local</code> (alleen op
            je apparaat) om het analyseresultaat maximaal één uur te cachen,
            zodat de popup direct laadt bij herhaald openen. Ook worden je
            voorkeuren opgeslagen (minuten per e-mail, automatiseringsgraad,
            uurtarief). Deze gegevens verlaten je apparaat nooit en worden
            automatisch verwijderd wanneer je de extensie verwijdert.
          </p>

          <h3>Wettelijke grondslag</h3>
          <p>
            De verwerking is gebaseerd op je uitdrukkelijke toestemming (art. 6
            lid 1 onder a AVG), verleend wanneer je op &quot;Analyseer mijn
            Gmail-inbox&quot; klikt en de Gmail-toestemming goedkeurt in het
            OAuth-toestemmingsscherm. Je kunt je toestemming op elk moment
            intrekken door de toegang van de extensie tot Gmail in te trekken
            via{" "}
            <a
              href="https://myaccount.google.com/permissions"
              target="_blank"
              rel="noopener noreferrer"
            >
              myaccount.google.com/permissions
            </a>{" "}
            of door de extensie te verwijderen.
          </p>

          <h3>Je gegevens verwijderen</h3>
          <p>
            Het verwijderen van de extensie uit Chrome wist direct alle lokaal
            opgeslagen gegevens. Er bestaan nergens anders gegevens.
          </p>

          <h2>Yippie-platform: Gmail- en Outlook-integratie</h2>
          <p>
            Binnen het Yippie-klantenserviceplatform kunnen gebruikers optioneel
            hun Gmail- of Microsoft Outlook-mailbox koppelen, zodat inkomende
            e-mails samen met andere supportkanalen worden afgehandeld.
          </p>

          <h3>Waartoe we toegang hebben</h3>
          <p>
            Wanneer je een Gmail-account koppelt, vraagt Yippie de volgende
            OAuth-scopes aan:
          </p>
          <ul>
            <li>
              <strong>gmail.readonly</strong>: om inkomende berichten en
              gespreksgeschiedenis te lezen zodat deze in de Yippie-inbox kunnen
              worden weergegeven.
            </li>
            <li>
              <strong>gmail.send</strong>: om namens jou antwoorden te sturen
              rechtstreeks vanuit het Yippie-platform.
            </li>
            <li>
              <strong>gmail.modify</strong>: om berichten als gelezen te markeren
              en labels toe te passen nadat ze zijn afgehandeld.
            </li>
          </ul>
          <p>
            Wanneer je een Microsoft Outlook-account koppelt, vraagt Yippie
            vergelijkbare Microsoft Graph-machtigingen aan (
            <strong>Mail.Read</strong>, <strong>Mail.Send</strong>,{" "}
            <strong>Mail.ReadWrite</strong>) voor dezelfde doeleinden.
          </p>

          <h3>Hoe we je e-mailgegevens gebruiken</h3>
          <p>
            E-mailinhoud (afzender, ontvanger, onderwerp en berichttekst) wordt
            uitsluitend verwerkt om berichten in het Yippie-platform weer te
            geven, door AI ondersteunde antwoordsuggesties te genereren en
            gesprekken te classificeren. We gebruiken je e-mailgegevens{" "}
            <strong>niet</strong> voor advertenties, voor het opbouwen van
            profielen voor derden, of voor het trainen van AI-modellen. Inhoud
            die door onze AI-aanbieder (Mistral AI SAS) wordt verwerkt, valt
            onder een verwerkersovereenkomst en wordt niet gebruikt voor
            modeltraining.
          </p>

          <h3>Waar je gegevens worden verwerkt</h3>
          <p>
            E-mailgegevens worden van Gmail of Outlook opgehaald naar de servers
            van Yippie (gehost op Railway, EU-regio) en opgeslagen in de
            geïsoleerde database van je account. Ze worden niet gedeeld met
            andere tenants en niet verkocht of doorgegeven aan derden buiten de
            verwerkers die in dit beleid worden vermeld.
          </p>

          <h3>Wettelijke grondslag</h3>
          <p>
            De verwerking is gebaseerd op je uitdrukkelijke toestemming (art. 6
            lid 1 onder a AVG), verleend wanneer je je mailbox koppelt via het
            OAuth-toestemmingsscherm. Je kunt je mailbox op elk moment loskoppelen
            via je Yippie-accountinstellingen, waarmee onze toegangstoken
            onmiddellijk wordt ingetrokken. Je kunt de toegang ook rechtstreeks
            intrekken via{" "}
            <a
              href="https://myaccount.google.com/permissions"
              target="_blank"
              rel="noopener noreferrer"
            >
              myaccount.google.com/permissions
            </a>{" "}
            (Gmail) of via de beveiligingsinstellingen van je Microsoft-account
            (Outlook).
          </p>

          <h3>Bewaartermijn</h3>
          <p>
            E-mailberichten die naar Yippie zijn gesynchroniseerd, worden bewaard
            zolang je account actief is. Wanneer je een gesprek verwijdert of je
            account sluit, worden de bijbehorende berichtgegevens binnen 30 dagen
            uit onze systemen verwijderd.
          </p>

          <h2>Cookies &amp; analyse</h2>
          <p>
            We gebruiken <strong>Google Analytics 4</strong> met Google{" "}
            <strong>Consent Mode v2</strong> om te begrijpen hoe de site wordt
            gebruikt. Totdat je een keuze maakt in onze cookiebanner, is alle
            opslag voor analyse en advertenties standaard op{" "}
            <strong>geweigerd</strong> ingesteld. Er worden geen
            trackingcookies geplaatst. Google Analytics kan nog wel anonieme,
            cookieloze signalen (pings) ontvangen zodat we het totale verkeer
            kunnen meten zonder jou te identificeren.
          </p>
          <p>
            Wanneer je <strong>Accepteren</strong> kiest, werken we je
            toestemming bij om analyse en advertentieopslag toe te staan, en
            plaatst Google Analytics zijn cookies. Wanneer je{" "}
            <strong>Weigeren</strong> kiest, wordt er geen toestemming verleend
            en blijft Analytics in cookieloze modus. Je keuze wordt opgeslagen
            in de lokale opslag van je browser.
          </p>

          <h2>Je toestemming intrekken of wijzigen</h2>
          <p>
            Je kunt je keuze op elk moment wijzigen. Het wissen van de
            sitegegevens van getyippie.com in je browser (of het verwijderen van
            de{" "}
            <code>yippie_consent</code> vermelding uit de lokale opslag) zorgt
            ervoor dat de cookiebanner bij je volgende bezoek opnieuw verschijnt,
            zodat je opnieuw een keuze kunt maken.
          </p>

          <h2>Externe dienstverleners (verwerkers)</h2>
          <p>
            We verkopen je gegevens niet. Om deze website te kunnen beheren,
            delen we echter gegevens met externe dienstverleners (verwerkers) in
            de volgende categorieën:
          </p>
          <ul>
            <li>
              <strong>Analyseaanbieders</strong>: voor het meten van
              websiteverkeer en gebruik (bijv. Google Analytics).
            </li>
            <li>
              <strong>Hosting- en infrastructuuraanbieders</strong>: voor het
              hosten en onderhouden van de website.
            </li>
            <li>
              <strong>E-mail- en communicatieaanbieders</strong>: voor het
              verwerken en bezorgen van berichten die je ons stuurt.
            </li>
            <li>
              <strong>AI-verwerkingsaanbieders</strong>: voor door AI
              ondersteunde functies (inboxclassificatie, antwoordsuggesties en de
              Yip-assistent) kunnen berichtinhoud en contactgegevens worden
              verwerkt door Mistral AI SAS, 15 rue des Halles, 75001 Parijs,
              Frankrijk (gehost in de EU). Mistral AI gebruikt deze gegevens niet
              voor het trainen van modellen. Er is een verwerkersovereenkomst
              met Mistral AI gesloten.
            </li>
          </ul>
          <p>
            Waar de AVG dat vereist, hebben we met elk van deze aanbieders een
            verwerkersovereenkomst gesloten om te waarborgen dat je gegevens
            alleen worden verwerkt op onze instructies en met passende
            waarborgen.
          </p>

          <h2>Internationale gegevensoverdrachten</h2>
          <p>
            Sommige van onze dienstverleners, waaronder Google (Google
            Analytics), zijn gevestigd buiten de Europese Economische Ruimte
            (EER) of dragen gegevens over naar landen buiten de EER, waaronder
            de Verenigde Staten. We zorgen ervoor dat dergelijke overdrachten
            zijn onderworpen aan passende waarborgen. Voor Google zijn deze
            overdrachten gedekt door de{" "}
            <strong>
              door de Europese Commissie vastgestelde Standaard Contractuele
              Bedingen (SCB's)
            </strong>
            , die Google juridisch verplichten je gegevens te beschermen op
            hetzelfde niveau als binnen de EER.
          </p>

          <h2>Bewaartermijnen</h2>
          <p>We bewaren persoonsgegevens alleen zo lang als noodzakelijk:</p>
          <ul>
            <li>
              <strong>Analysegegevens</strong>: Google Analytics is ingesteld met
              een maximale bewaartermijn van <strong>14 maanden</strong>.
              Geaggregeerde, geanonimiseerde rapporten kunnen langer worden
              bewaard.
            </li>
            <li>
              <strong>Demoverzoeken en contactformulierinzendingen</strong>: we
              bewaren je contactgegevens tot maximaal{" "}
              <strong>12 maanden</strong> na ons laatste contact met jou, waarna
              ze worden verwijderd.
            </li>
            <li>
              <strong>Cookietoestemmingsvoorkeur</strong>: opgeslagen in de
              lokale opslag van je browser en automatisch verwijderd wanneer je
              je browsergegevens wist.
            </li>
          </ul>

          <h2>Je rechten</h2>
          <p>
            Op grond van de AVG (GDPR) heb je het recht om de persoonsgegevens
            die we van je bewaren in te zien, te corrigeren of te verwijderen,
            bezwaar te maken tegen of de verwerking te beperken, en gegevens
            over te dragen. Waar de verwerking is gebaseerd op toestemming, kun
            je die toestemming op elk moment intrekken zonder dat dit gevolgen
            heeft voor de rechtmatigheid van de verwerking vóór de intrekking.
          </p>
          <p>
            Om een van deze rechten uit te oefenen, kun je contact opnemen via
            de gegevens in de sectie <em>Verwerkingsverantwoordelijke</em>{" "}
            hierboven.
          </p>
          <p>
            Je hebt ook het recht om een klacht in te dienen bij de Nederlandse
            toezichthoudende autoriteit, de{" "}
            <strong>Autoriteit Persoonsgegevens (AP)</strong>, als je van mening
            bent dat we je persoonsgegevens onrechtmatig verwerken. Je kunt de
            AP bereiken via{" "}
            <a
              href="https://www.autoriteitpersoonsgegevens.nl"
              target="_blank"
              rel="noopener noreferrer"
            >
              autoriteitpersoonsgegevens.nl
            </a>
            .
          </p>

          <h2>Contact</h2>
          <p>
            Vragen over dit beleid of over je gegevens? Stuur ons een e-mail via{" "}
            <a href="mailto:support@getyippie.com">support@getyippie.com</a>{" "}
            en we nemen zo snel mogelijk contact met je op.
          </p>

          <p>
            <em>
              Deze pagina is een algemeen startpunt en geen juridisch advies.
              Laat deze tekst controleren door gekwalificeerde juridische
              bijstand voordat je hierop vertrouwt voor compliancedoeleinden.
            </em>
          </p>
        </div>
      </article>

      <SiteFooter />
    </div>
  );
}
