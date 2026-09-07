import type { Metadata } from "next";
import SiteNav from "@/app/components/SiteNav";
import SiteFooter from "@/app/components/SiteFooter";
import styles from "@/app/components/content.module.css";

const TITLE = "Terms of Service | Yippie";
const DESCRIPTION =
  "Terms and conditions for using Yippie, our B2B SaaS customer service platform. Including subscription terms, data processing, and liability.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/en/terms" },
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
        <div className={styles.articleDate}>Last updated: July 1, 2026</div>
        <h1 className={styles.articleTitle}>Terms of Service</h1>

        <div className={styles.articleBody}>
          <h2>Introduction</h2>
          <p>
            These Terms of Service ("Terms") govern your access to and use of Yippie
            (getyippie.com), a B2B customer service platform operated by Yippie,
            a Dutch company. By accessing or using the Platform, you agree to be bound
            by these Terms. If you do not agree, you may not use the Platform.
          </p>

          <h2>Definitions</h2>
          <ul>
            <li>
              <strong>Platform</strong>: the Yippie software-as-a-service offering
              accessible at app.getyippie.com and related services.
            </li>
            <li>
              <strong>Tenant</strong>: the organization or legal entity subscribing to
              the Platform and responsible for payment and compliance.
            </li>
            <li>
              <strong>Services</strong>: the functionality provided by Yippie,
              including customer communication management, ticket routing, and reporting.
            </li>
            <li>
              <strong>User</strong>: an individual authorized by the Tenant to access
              and use the Platform on the Tenant&apos;s behalf.
            </li>
            <li>
              <strong>Personal Data</strong>: any information relating to an identified
              or identifiable natural person, as defined in the GDPR / AVG.
            </li>
          </ul>

          <h2>Access &amp; Permitted Use</h2>
          <p>
            The Platform is provided for business-to-business use only. The Tenant
            may grant access to authorized Users, and is responsible for their conduct
            and compliance with these Terms. Each User account is tied to one Tenant
            and may not be shared.
          </p>
          <p>
            You agree to use the Platform only for lawful business purposes and in
            compliance with applicable law. You may not:
          </p>
          <ul>
            <li>Use the Platform to engage in illegal, fraudulent, or harmful activity.</li>
            <li>
              Attempt to gain unauthorized access to the Platform, its systems, or
              other Users&apos; data.
            </li>
            <li>
              Use the Platform in a way that could disrupt, damage, or impair its
              functionality or security.
            </li>
            <li>
              Reverse-engineer, decompile, or attempt to derive the underlying code
              or architecture.
            </li>
            <li>Resell or redistribute the Platform without prior written consent.</li>
          </ul>

          <h2>Subscription &amp; Payment</h2>
          <p>
            The Platform is provided on a monthly subscription basis. Pricing and
            available modules are displayed at the time of purchase. Payment is due
            within 14 days of invoice issuance. Subscriptions renew automatically on
            the anniversary date unless cancelled.
          </p>
          <p>
            The Tenant is responsible for all costs incurred under its subscription,
            including overage fees if applicable. We reserve the right to suspend
            access if payment is not received within 30 days of the due date.
          </p>

          <h2>Data Processing</h2>
          <p>
            The Tenant may store Personal Data of its own customers and end-users
            within the Platform. For GDPR / AVG compliance, the Tenant is the data
            controller and Yippie is the data processor. A Data Processing Agreement
            (DPA) is available upon request and governs the processing of Personal
            Data.
          </p>
          <p>
            The Platform uses AI-assisted features (inbox classification, reply
            drafts, and the Yip assistant) powered by Mistral AI SAS (EU-hosted,
            Paris, France). Customer message content and contact data processed
            for these features is subject to a Data Processing Agreement with
            Mistral AI and is not used for model training.
          </p>
          <p>
            Yippie uses industry-standard security measures to protect data at rest
            and in transit. However, no system is entirely secure. The Tenant remains
            responsible for the legality and appropriateness of the Personal Data it
            uploads.
          </p>

          <h2>Intellectual Property</h2>
          <p>
            Yippie retains all intellectual property rights in the Platform, including
            its software, design, documentation, and improvements. The Tenant is
            granted a non-exclusive, non-transferable license to use the Platform
            during the subscription term solely for its authorized business purposes.
          </p>
          <p>
            The Tenant retains ownership of all data, customer lists, and content it
            uploads to the Platform. Upon termination, the Tenant may request an
            export of its data in standard formats; however, we are not obligated to
            retain it beyond the data retention period in the DPA.
          </p>

          <h2>Confidentiality</h2>
          <p>
            Each party agrees to maintain the confidentiality of the other&apos;s
            confidential information and use it only for purposes authorized by these
            Terms. This obligation does not apply to information that is publicly
            available or independently developed.
          </p>

          <h2>Liability Limitations</h2>
          <p>
            <strong>To the fullest extent permitted by law:</strong>
          </p>
          <ul>
            <li>
              Yippie&apos;s total liability arising from or related to the Platform shall
              not exceed the fees paid by the Tenant in the 3 months preceding the
              claim.
            </li>
            <li>
              Yippie is not liable for indirect, incidental, consequential, special,
              or punitive damages, including lost profits, even if advised of the
              possibility of such damages.
            </li>
            <li>
              These limitations do not apply to either party&apos;s liability for
              fraudulent misrepresentation, gross negligence, or violations of
              applicable data protection law.
            </li>
          </ul>

          <h2>Term &amp; Termination</h2>
          <p>
            Subscriptions are month-to-month. Either party may terminate with
            30 days&apos; written notice. Yippie may terminate immediately if the Tenant
            breaches these Terms and does not cure the breach within 10 days of notice.
          </p>
          <p>
            Upon termination, the Tenant&apos;s access to the Platform will be revoked.
            Data retention is governed by the DPA. The Tenant remains liable for any
            fees owed through the termination date.
          </p>

          <h2>Governing Law &amp; Jurisdiction</h2>
          <p>
            These Terms are governed by the laws of the Netherlands, without regard to
            conflicts of law principles. Any disputes shall be resolved exclusively in
            the courts of Amsterdam, Netherlands.
          </p>

          <h2>Changes to These Terms</h2>
          <p>
            Yippie may update these Terms at any time. Material changes will be
            communicated to the Tenant at least 30 days in advance. Continued use of
            the Platform following such notice constitutes acceptance. If the Tenant
            objects, it may terminate as outlined above.
          </p>

          <h2>Questions?</h2>
          <p>
            For questions about these Terms or to request a Data Processing Agreement,
            contact us at{" "}
            <a href="mailto:support@getyippie.com">support@getyippie.com</a>.
          </p>

          <p>
            <em>
              This page is a general starting point and not legal advice. Please
              review it with qualified counsel before relying on it for compliance.
            </em>
          </p>
        </div>
      </article>

      <SiteFooter />
    </div>
  );
}
