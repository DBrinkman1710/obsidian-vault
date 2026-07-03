import type { Metadata } from "next";
import SiteNav from "../../components/SiteNav";
import SiteFooter from "../../components/SiteFooter";
import styles from "../../components/content.module.css";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.getyippie.com";
const DEMO_URL = process.env.NEXT_PUBLIC_DEMO_URL ?? APP_URL;

const TITLE = "How to Cut Your Customer Service Response Time in Half";
const DESCRIPTION =
  "Want to reduce customer service response time without hiring? Use templates, SLAs, inbox triage, and clean team handoffs in your help desk software to answer faster.";
const URL = "https://getyippie.com/blog/how-to-reduce-customer-service-response-time";
const DATE = "2026-06-05";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/blog/how-to-reduce-customer-service-response-time" },
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
        <div className={styles.articleDate}>June 5, 2026</div>
        <h1 className={styles.articleTitle}>{TITLE}</h1>
        <div className={styles.articleByline}>By Diederik Brinkman</div>

        <div className={styles.articleBody}>
          <p>
            Response time is the metric customers feel first. A fast reply signals
            that you care; a slow one quietly erodes trust. The good news is you
            can <strong>reduce customer service response time</strong> dramatically
            without hiring a single extra person. It comes down to removing
            friction from your support workflow. Here are five tactics that
            consistently cut response time in half.
          </p>

          <h2>1. Build a library of reply templates</h2>
          <p>
            Most questions repeat. Save your best answers as reusable templates so
            agents start from 80% instead of a blank page. The right help desk
            software lets you insert a template and personalize it in seconds —
            turning a five-minute reply into a thirty-second one.
          </p>

          <h2>2. Set SLAs and make them visible</h2>
          <p>
            A service-level agreement is only useful if your team can see the clock.
            Deadline badges and SLA alerts that fire <em>before</em> a ticket goes
            overdue keep urgent requests from aging quietly in the queue. When the
            target is on screen, the whole team moves to meet it.
          </p>

          <h2>3. Triage the inbox before you answer</h2>
          <p>
            Answering in the order things arrive is slow and unfair to urgent
            cases. Sort by priority first. AI inbox triage can read each incoming
            message, flag what is urgent, and route it to the right person, so the
            important tickets get answered first, automatically.
          </p>

          <h2>4. Make team handoffs clean</h2>
          <p>
            Response time balloons when a ticket bounces between people who each
            have to rebuild context. A shared inbox with full customer history and
            clear ownership means whoever picks up a conversation already knows the
            backstory. No re-asking, no re-explaining.
          </p>

          <h2>5. Let AI draft the first response</h2>
          <p>
            Suggested replies give agents a complete draft to approve or refine
            instantly. Pair that with an improve-reply pass for tone, and your team
            sends polished answers faster than they could type &quot;Hi there.&quot;
          </p>

          <p>
            Put these together and the math is simple: less time hunting, less time
            typing, and less time waiting in the queue. Faster responses mean
            happier customers, and a support team that finally feels ahead of the
            inbox instead of buried under it.
          </p>
        </div>

        <div className={styles.articleCta}>
          <p className={styles.articleCtaTitle}>Answer faster with Yippie</p>
          <a href={DEMO_URL} className={styles.btnPrimary}>Request demo →</a>
        </div>
      </article>

      <SiteFooter />
    </div>
  );
}
