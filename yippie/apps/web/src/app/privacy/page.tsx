import type { Metadata } from "next";
import SiteNav from "../components/SiteNav";
import SiteFooter from "../components/SiteFooter";
import styles from "../components/content.module.css";

const TITLE = "Privacy Policy — Yippie";
const DESCRIPTION =
  "How Yippie collects, uses, and protects your data, including our use of cookies and Google Analytics with Consent Mode.";

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
        <div className={styles.articleDate}>Last updated: June 23, 2026</div>
        <h1 className={styles.articleTitle}>Privacy Policy</h1>

        <div className={styles.articleBody}>
          <p>
            At Yippie we value transparency. This policy explains what data we
            collect when you visit getyippie.com, why we collect it, the legal
            basis for each purpose, and the choices you have. We only collect
            what we need to run and improve the site.
          </p>

          <h2>Data controller</h2>
          <p>
            The party responsible for the processing of your personal data
            (verwerkingsverantwoordelijke) is:
          </p>
          <p>
            <strong>[BEDRIJFSNAAM INVULLEN]</strong>
            <br />
            [VESTIGINGSADRES INVULLEN]
            <br />
            KVK-nummer: [KVK INVULLEN]
            <br />
            E-mail:{" "}
            <a href="mailto:support@getyippie.com">support@getyippie.com</a>
          </p>

          <h2>Data we collect and legal basis</h2>
          <p>
            We process personal data for the following purposes. For each
            purpose we state the legal basis as required by Article 6 of the
            GDPR / AVG.
          </p>

          <h3>1. Website analytics</h3>
          <p>
            We collect <strong>anonymous usage statistics</strong> — pages
            viewed, approximate location, device and browser type, and how you
            arrived — to understand how the site is used and improve it.
          </p>
          <p>
            <strong>Legal basis:</strong> Consent (Art. 6(1)(a) GDPR). We only
            activate analytics cookies after you accept via our cookie banner.
            If you decline, analytics stays in cookieless mode and no personal
            data is stored.
          </p>

          <h3>2. Demo requests and contact</h3>
          <p>
            If you request a demo or contact us, we collect the details you
            submit (such as your name, email address, and company) so we can
            respond to your enquiry and follow up.
          </p>
          <p>
            <strong>Legal basis:</strong> Pre-contractual measures at your
            request (Art. 6(1)(b) GDPR) — processing is necessary to take
            steps before entering into an agreement — and our legitimate
            interest in managing business enquiries (Art. 6(1)(f) GDPR).
          </p>

          <h2>Cookies &amp; analytics</h2>
          <p>
            We use <strong>Google Analytics 4</strong> with Google{" "}
            <strong>Consent Mode v2</strong> to understand how the site is
            used. Until you make a choice in our cookie banner, all analytics
            and advertising storage is set to <strong>denied</strong> by
            default — no tracking cookies are placed. Google Analytics may
            still receive anonymous, cookieless signals (pings) so we can
            measure aggregate traffic without identifying you.
          </p>
          <p>
            When you select <strong>Accept</strong>, we update your consent to
            allow analytics and advertising storage, and Google Analytics sets
            its cookies. When you select <strong>Decline</strong>, no consent
            is granted and Analytics stays in cookieless mode. Your choice is
            remembered in your browser&apos;s local storage.
          </p>

          <h2>Withdrawing or changing your consent</h2>
          <p>
            You can change your mind at any time. Clearing your browser&apos;s
            site data for getyippie.com (or removing the{" "}
            <code>yippie_consent</code> entry from local storage) will make the
            cookie banner appear again on your next visit, letting you choose
            anew.
          </p>

          <h2>Third-party service providers (data processors)</h2>
          <p>
            We do not sell your data. However, to operate this website we share
            data with third-party service providers (verwerkers) in the
            following categories:
          </p>
          <ul>
            <li>
              <strong>Analytics providers</strong> — to measure website traffic
              and usage (e.g. Google Analytics).
            </li>
            <li>
              <strong>Hosting and infrastructure providers</strong> — to serve
              and maintain the website.
            </li>
            <li>
              <strong>Email and communication providers</strong> — to process
              and deliver messages you send us.
            </li>
          </ul>
          <p>
            Where required under the GDPR, we have concluded a data processing
            agreement (verwerkersovereenkomst) with each of these providers to
            ensure your data is processed only on our instructions and with
            appropriate safeguards in place.
          </p>

          <h2>International data transfers</h2>
          <p>
            Some of our service providers — including Google (Google Analytics)
            — are based outside the European Economic Area (EEA) or transfer
            data to countries outside the EEA, including the United States. We
            ensure that such transfers are subject to appropriate safeguards.
            For Google, these transfers are covered by the{" "}
            <strong>
              Standard Contractual Clauses (SCCs) adopted by the European
              Commission
            </strong>
            , which legally bind Google to protect your data to the same
            standard as within the EEA.
          </p>

          <h2>Data retention</h2>
          <p>We retain personal data only as long as necessary:</p>
          <ul>
            <li>
              <strong>Analytics data</strong>: Google Analytics is configured
              with a maximum retention period of <strong>14 months</strong>.
              Aggregate, anonymised reports may be kept longer.
            </li>
            <li>
              <strong>Demo requests and contact form submissions</strong>: we
              retain your contact details for up to{" "}
              <strong>12 months</strong> after our last interaction with you,
              after which they are deleted.
            </li>
            <li>
              <strong>Cookie consent preference</strong>: stored in your
              browser&apos;s local storage and automatically removed when you
              clear your browser data.
            </li>
          </ul>

          <h2>Your rights</h2>
          <p>
            Under the GDPR / AVG you have the right to access, correct, or
            delete the personal data we hold about you, to object to or
            restrict its processing, and to data portability. Where processing
            is based on consent, you may withdraw that consent at any time
            without affecting the lawfulness of processing before withdrawal.
          </p>
          <p>
            To exercise any of these rights, contact us using the details in
            the <em>Data controller</em> section above.
          </p>
          <p>
            You also have the right to lodge a complaint with the Dutch
            supervisory authority, the{" "}
            <strong>Autoriteit Persoonsgegevens (AP)</strong>, if you believe
            we are processing your personal data unlawfully. You can reach the
            AP at{" "}
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
            Questions about this policy or your data? Email us at{" "}
            <a href="mailto:support@getyippie.com">support@getyippie.com</a>{" "}
            and we will get back to you.
          </p>

          <p>
            <em>
              This page is a general starting point and not legal advice.
              Please review it with qualified counsel before relying on it for
              compliance.
            </em>
          </p>
        </div>
      </article>

      <SiteFooter />
    </div>
  );
}
