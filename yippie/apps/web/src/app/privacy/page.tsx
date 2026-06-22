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
        <div className={styles.articleDate}>Last updated: June 17, 2026</div>
        <h1 className={styles.articleTitle}>Privacy Policy</h1>

        <div className={styles.articleBody}>
          <p>
            At Yippie we value transparency. This policy explains what data we
            collect when you visit getyippie.com, why we collect it, and the
            choices you have. We only collect what we need to run and improve the
            site.
          </p>

          <h2>Data we collect</h2>
          <p>
            When you browse our marketing site we collect{" "}
            <strong>anonymous usage statistics</strong> — pages viewed, approximate
            location, device and browser type, and how you arrived. If you choose
            to <strong>request a demo</strong> or contact us, we collect the details
            you submit (such as your name, email address, and company) so we can
            respond to you.
          </p>

          <h2>Cookies &amp; analytics</h2>
          <p>
            We use <strong>Google Analytics 4</strong> with Google{" "}
            <strong>Consent Mode v2</strong> to understand how the site is used.
            Until you make a choice in our cookie banner, all analytics and
            advertising storage is set to <strong>denied</strong> by default — no
            tracking cookies are placed. Google Analytics may still receive
            anonymous, cookieless signals (pings) so we can measure aggregate
            traffic without identifying you.
          </p>
          <p>
            When you select <strong>Accept</strong>, we update your consent to
            allow analytics and advertising storage, and Google Analytics sets its
            cookies. When you select <strong>Decline</strong>, no consent is granted
            and Analytics stays in cookieless mode. Your choice is remembered in
            your browser&apos;s local storage.
          </p>

          <h2>Withdrawing or changing your consent</h2>
          <p>
            You can change your mind at any time. Clearing your browser&apos;s site
            data for getyippie.com (or removing the{" "}
            <code>yippie_consent</code> entry from local storage) will make the
            cookie banner appear again on your next visit, letting you choose anew.
          </p>

          <h2>Data retention</h2>
          <p>
            Aggregate analytics data is retained according to Google Analytics&apos;
            standard retention settings. Information you submit through forms is
            kept only as long as needed to handle your request and our legitimate
            business follow-up, after which it is deleted.
          </p>

          <h2>Your rights</h2>
          <p>
            Under the GDPR / AVG you have the right to access, correct, or delete
            the personal data we hold about you, to object to or restrict its
            processing, and to data portability. To exercise any of these rights,
            contact us using the details below.
          </p>

          <h2>Contact</h2>
          <p>
            Questions about this policy or your data? Email us at{" "}
            <a href="mailto:support@getyippie.com">support@getyippie.com</a> and we
            will get back to you.
          </p>

          <p>
            <em>
              This page is a general starting point and not legal advice. Please
              review it with qualified counsel before relying on it for
              compliance.
            </em>
          </p>
        </div>
      </article>

      <SiteFooter />
    </div>
  );
}
