import type { Metadata } from "next";
import SiteNav from "../components/SiteNav";
import SiteFooter from "../components/SiteFooter";
import styles from "../components/content.module.css";

const TITLE = "Algemene Voorwaarden | Yippie";
const DESCRIPTION =
  "Algemene voorwaarden voor het gebruik van Yippie, ons B2B SaaS-klantenserviceplatform. Inclusief abonnementsvoorwaarden, gegevensverwerking en aansprakelijkheid.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/terms" },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: "https://getyippie.com/terms",
    type: "website",
  },
};

export default function TermsPage() {
  return (
    <div className={styles.page}>
      <SiteNav />

      <article className={styles.article}>
        {/* NL VERTALING — juridische tekst automatisch vertaald. Laten controleren door een jurist voordat je hierop vertrouwt. */}
        <div className={styles.articleDate}>Laatst bijgewerkt: 1 juli 2026</div>
        <h1 className={styles.articleTitle}>Algemene Voorwaarden</h1>

        <div className={styles.articleBody}>
          <h2>Inleiding</h2>
          <p>
            Deze Algemene Voorwaarden (&quot;Voorwaarden&quot;) zijn van toepassing op
            je toegang tot en gebruik van Yippie (getyippie.com), een B2B
            klantenserviceplatform dat wordt beheerd door Yippie, een Nederlands
            bedrijf. Door het Platform te benaderen of te gebruiken, ga je
            akkoord met deze Voorwaarden. Als je niet akkoord gaat, mag je het
            Platform niet gebruiken.
          </p>

          <h2>Definities</h2>
          <ul>
            <li>
              <strong>Platform</strong>: het software-as-a-service aanbod van
              Yippie, toegankelijk via app.getyippie.com en aanverwante diensten.
            </li>
            <li>
              <strong>Tenant</strong>: de organisatie of rechtspersoon die een
              abonnement neemt op het Platform en verantwoordelijk is voor
              betaling en naleving.
            </li>
            <li>
              <strong>Diensten</strong>: de functionaliteit die Yippie biedt,
              waaronder beheer van klantcommunicatie, ticketroutering en
              rapportage.
            </li>
            <li>
              <strong>Gebruiker</strong>: een persoon die door de Tenant is
              gemachtigd om het Platform te gebruiken namens de Tenant.
            </li>
            <li>
              <strong>Persoonsgegevens</strong>: alle informatie betreffende een
              geïdentificeerde of identificeerbare natuurlijke persoon, zoals
              omschreven in de AVG (GDPR).
            </li>
          </ul>

          <h2>Toegang &amp; toegestaan gebruik</h2>
          <p>
            Het Platform is uitsluitend bestemd voor zakelijk gebruik
            (business-to-business). De Tenant kan toegang verlenen aan
            gemachtigde Gebruikers en is verantwoordelijk voor hun gedrag en
            naleving van deze Voorwaarden. Elk gebruikersaccount is gekoppeld
            aan één Tenant en mag niet worden gedeeld.
          </p>
          <p>
            Je stemt ermee in het Platform uitsluitend te gebruiken voor
            rechtmatige zakelijke doeleinden en in overeenstemming met de
            toepasselijke wetgeving. Het is niet toegestaan om:
          </p>
          <ul>
            <li>Het Platform te gebruiken voor illegale, frauduleuze of schadelijke activiteiten.</li>
            <li>
              Ongeautoriseerde toegang te proberen te verkrijgen tot het Platform,
              de systemen ervan, of de gegevens van andere Gebruikers.
            </li>
            <li>
              Het Platform te gebruiken op een wijze die de werking of beveiliging
              ervan kan verstoren, beschadigen of aantasten.
            </li>
            <li>
              De onderliggende code of architectuur te reverse-engineeren,
              decompileren of anderszins te proberen te achterhalen.
            </li>
            <li>Het Platform door te verkopen of te distribueren zonder voorafgaande schriftelijke toestemming.</li>
          </ul>

          <h2>Abonnement &amp; betaling</h2>
          <p>
            Het Platform wordt aangeboden op basis van een maandelijks
            abonnement. Prijzen en beschikbare modules worden weergegeven op het
            moment van aankoop. Betaling dient te geschieden binnen 14 dagen na
            factuurdatum. Abonnementen worden automatisch verlengd op de
            verlengingsdatum, tenzij opgezegd.
          </p>
          <p>
            De Tenant is verantwoordelijk voor alle kosten die zijn gemaakt onder
            zijn abonnement, inclusief eventuele meerverbruikskosten. We behouden
            ons het recht voor om toegang op te schorten als de betaling niet
            binnen 30 dagen na de vervaldatum is ontvangen.
          </p>

          <h2>Gegevensverwerking</h2>
          <p>
            De Tenant kan persoonsgegevens van zijn eigen klanten en
            eindgebruikers opslaan binnen het Platform. In het kader van de AVG
            (GDPR) is de Tenant de verwerkingsverantwoordelijke en is Yippie de
            verwerker. Een verwerkersovereenkomst (DPA) is beschikbaar op
            verzoek en regelt de verwerking van persoonsgegevens.
          </p>
          <p>
            Het Platform maakt gebruik van door AI ondersteunde functies
            (inboxclassificatie, conceptantwoorden en de Yip-assistent) via
            Mistral AI SAS (gehost in de EU, Parijs, Frankrijk). Berichtinhoud
            en contactgegevens van klanten die voor deze functies worden
            verwerkt, vallen onder een verwerkersovereenkomst met Mistral AI en
            worden niet gebruikt voor modeltraining.
          </p>
          <p>
            Yippie maakt gebruik van industriestandaard beveiligingsmaatregelen
            om gegevens in rust en tijdens overdracht te beschermen. Geen enkel
            systeem is echter volledig veilig. De Tenant blijft verantwoordelijk
            voor de rechtmatigheid en geschiktheid van de persoonsgegevens die
            hij uploadt.
          </p>

          <h2>Intellectueel eigendom</h2>
          <p>
            Yippie behoudt alle intellectueel-eigendomsrechten op het Platform,
            waaronder de software, het ontwerp, de documentatie en verbeteringen.
            Aan de Tenant wordt een niet-exclusieve, niet-overdraagbare licentie
            verleend om het Platform te gebruiken gedurende de
            abonnementsperiode, uitsluitend voor de gemachtigde zakelijke
            doeleinden.
          </p>
          <p>
            De Tenant behoudt de eigendom van alle gegevens, klantenlijsten en
            inhoud die hij naar het Platform uploadt. Bij beëindiging kan de
            Tenant een export van zijn gegevens in standaardformaten opvragen;
            we zijn echter niet verplicht deze te bewaren buiten de
            bewaartermijn zoals vastgelegd in de verwerkersovereenkomst.
          </p>

          <h2>Vertrouwelijkheid</h2>
          <p>
            Beide partijen verbinden zich ertoe de vertrouwelijke informatie van
            de andere partij geheim te houden en deze uitsluitend te gebruiken
            voor doeleinden die door deze Voorwaarden zijn toegestaan. Deze
            verplichting is niet van toepassing op informatie die openbaar
            beschikbaar is of onafhankelijk is ontwikkeld.
          </p>

          <h2>Beperking van aansprakelijkheid</h2>
          <p>
            <strong>Voor zover maximaal toegestaan door de wet:</strong>
          </p>
          <ul>
            <li>
              De totale aansprakelijkheid van Yippie die voortvloeit uit of
              verband houdt met het Platform bedraagt niet meer dan de vergoedingen
              die de Tenant heeft betaald in de 3 maanden voorafgaand aan de
              claim.
            </li>
            <li>
              Yippie is niet aansprakelijk voor indirecte, incidentele,
              gevolgschade, bijzondere of exemplaire schadevergoeding,
              waaronder gederfde winst, ook niet als Yippie op de hoogte is
              gesteld van de mogelijkheid van dergelijke schade.
            </li>
            <li>
              Deze beperkingen zijn niet van toepassing op de aansprakelijkheid
              van een van de partijen voor opzettelijke misleiding, grove
              nalatigheid of schending van de toepasselijke
              gegevensbeschermingswetgeving.
            </li>
          </ul>

          <h2>Looptijd &amp; beëindiging</h2>
          <p>
            Abonnementen zijn maandelijks opzegbaar. Beide partijen kunnen het
            abonnement beëindigen met een opzegtermijn van 30 dagen. Yippie kan
            het abonnement met onmiddellijke ingang beëindigen als de Tenant
            deze Voorwaarden schendt en de schending niet herstelt binnen 10
            dagen na kennisgeving.
          </p>
          <p>
            Bij beëindiging wordt de toegang van de Tenant tot het Platform
            ingetrokken. De bewaartermijn voor gegevens wordt geregeld door de
            verwerkersovereenkomst. De Tenant blijft aansprakelijk voor alle
            verschuldigde vergoedingen tot en met de beëindigingsdatum.
          </p>

          <h2>Toepasselijk recht &amp; jurisdictie</h2>
          <p>
            Op deze Voorwaarden is het recht van Nederland van toepassing, zonder
            inachtneming van bepalingen van internationaal privaatrecht.
            Eventuele geschillen worden uitsluitend voorgelegd aan de bevoegde
            rechter te Amsterdam, Nederland.
          </p>

          <h2>Wijzigingen in deze Voorwaarden</h2>
          <p>
            Yippie kan deze Voorwaarden op elk moment bijwerken. Wezenlijke
            wijzigingen worden minimaal 30 dagen van tevoren aan de Tenant
            meegedeeld. Voortgezet gebruik van het Platform na een dergelijke
            kennisgeving geldt als aanvaarding. Als de Tenant bezwaar maakt,
            kan hij het abonnement beëindigen zoals hierboven beschreven.
          </p>

          <h2>Vragen?</h2>
          <p>
            Voor vragen over deze Voorwaarden of om een verwerkersovereenkomst
            op te vragen, kun je contact met ons opnemen via{" "}
            <a href="mailto:support@getyippie.com">support@getyippie.com</a>.
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
