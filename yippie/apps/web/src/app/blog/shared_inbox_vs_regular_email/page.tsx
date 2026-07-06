import type { Metadata } from "next";
import SiteNav from "../../components/SiteNav";
import SiteFooter from "../../components/SiteFooter";
import styles from "../../components/content.module.css";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.getyippie.com";
const DEMO_URL = process.env.NEXT_PUBLIC_DEMO_URL ?? APP_URL;

const TITLE = "Shared Inbox vs. Regular Email: When to Make the Switch";
const DESCRIPTION =
  "Still running support from a regular inbox? Here is how to know when shared inbox software pays off — and what you actually gain when you make the switch.";
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

      <article className={styles.article}>
        <a href="/blog" className={styles.backLink}>← Back to blog</a>
        <div className={styles.articleDate}>June 19, 2026</div>
        <h1 className={styles.articleTitle}>{TITLE}</h1>
        <div className={styles.articleByline}>By Diederik Brinkman</div>

        <div className={styles.articleBody}>
          <p>
            Teams get by on regular email longer than they should. It works —
            until it does not. The moment a second person joins the support
            rotation, the cracks appear: duplicate replies, messages that fall
            through, no way to see who is handling what. That is usually when
            the search for a <strong>shared inbox</strong> begins. Here is how
            to know if you have hit that point, and what the upgrade actually
            gives you.
          </p>

          <h2>1. The reply collision problem</h2>
          <p>
            Regular email was designed for one-to-one communication. When two
            people share access to a support inbox — through a forwarded alias
            or a shared login — they inevitably reply to the same message, or
            each assumes the other one handled it. Per Salesforce research, 63
            percent of service teams name duplicate handling and missed messages
            as their most common coordination failures. A shared inbox assigns
            every conversation to one owner, so collisions stop.
          </p>

          <h2>2. You lose the thread when you forward</h2>
          <p>
            The most common workaround on regular email is forwarding. Someone
            sees a customer question, forwards it to the right colleague, and
            hopes the reply makes it back. Each forward adds time — often hours
            — and strips out context along the way. A shared inbox keeps the
            full customer history visible to everyone, in one place, with no
            forwarding required.
          </p>

          <h2>3. There is no queue visibility</h2>
          <p>
            With a regular inbox, you cannot see what is waiting, what is
            overdue, or what your actual response time is. That invisibility
            makes improvement impossible. Help desk software with a shared inbox
            gives you these metrics by default: first response time, resolution
            time, and ticket backlog at a glance. You cannot fix what you cannot
            see.
          </p>

          <h2>4. SLAs need a system to enforce them</h2>
          <p>
            Setting a response-time target is easy. Keeping it is hard without
            software that tracks it. A shared inbox with SLA support shows
            deadline badges on every open ticket and fires an alert before one
            goes overdue, giving managers a clear view of where the team stands.
            That kind of visibility is impossible to replicate inside a standard
            email client.
          </p>

          <h2>5. When regular email is still fine</h2>
          <p>
            If you are the only person handling support and volume is low, a
            regular inbox with good labeling habits works fine. The tipping point
            is typically the second support agent, or roughly 20 to 30 tickets a
            week. Beyond that, the coordination overhead of regular email costs
            more time than the switch ever would.
          </p>

          <p>
            The switch from regular email to a shared inbox is not a big project.
            Most teams are up and running in a morning. The harder part is
            knowing when to do it — and most teams wait too long.
          </p>
        </div>

        <div className={styles.articleCta}>
          <p className={styles.articleCtaTitle}>Run your support from one inbox</p>
          <a href={DEMO_URL} className={styles.btnPrimary}>Request demo →</a>
        </div>
      </article>

      <SiteFooter />
    </div>
  );
}
