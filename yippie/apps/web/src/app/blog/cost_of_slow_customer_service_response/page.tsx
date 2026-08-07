import type { Metadata } from "next";
import SiteNav from "../../components/SiteNav";
import SiteFooter from "../../components/SiteFooter";
import styles from "../../components/content.module.css";
import { breadcrumbJsonLd } from "../jsonld";

const DEMO_URL = process.env.NEXT_PUBLIC_DEMO_URL ?? "/request-demo";

const TITLE = "What a Slow Customer Service Response Actually Costs You";
const DESCRIPTION =
  "Slow support is not just frustrating — it costs revenue, drives negative reviews, and creates more work internally. Here is what the numbers say.";
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
        <a href="/blog" className={styles.backLink}>← Back to blog</a>
        <div className={styles.articleDate}>June 26, 2026</div>
        <h1 className={styles.articleTitle}>{TITLE}</h1>
        <div className={styles.articleByline}>By Diederik Brinkman</div>

        <div className={styles.articleBody}>
          <p>
            Most small businesses know that slow support is bad. Fewer realize
            exactly how bad — or how quickly the cost compounds. It is not just
            a lost customer. It is a customer who tells others, a review that
            discourages future buyers, and a competitive advantage handed to
            whoever replies faster. Here is what the research actually shows.
          </p>

          <h2>The first-hour window matters more than you think</h2>
          <p>
            A Harvard Business Review study of B2B companies found that those
            who responded to an inquiry within the first hour were nearly seven
            times more likely to have a meaningful follow-up conversation than
            those who waited even two hours. The window for a warm response
            closes fast. By the time a customer has been waiting half a day,
            the odds of a productive outcome have dropped significantly — and
            they know it too.
          </p>

          <h2>Slow replies drive negative reviews</h2>
          <p>
            When customers are unhappy with response time, they say so
            publicly. Per Zendesk&apos;s CX Trends research, 61 percent of
            customers would switch to a competitor after a single bad service
            experience. Speed is not the only factor, but it is the one
            customers feel immediately. A slow reply on a sensitive issue is
            often what pushes someone to leave a review they would otherwise
            never have written.
          </p>

          <h2>The time cost falls on your team too</h2>
          <p>
            Slow responses are not just a customer experience problem — they
            create more work internally. Customers who have not heard back
            follow up, sometimes multiple times. Each follow-up is another
            message to read, triage, and reply to. SuperOffice research found
            that the average first response time for customer service emails
            across industries is over 12 hours. That gap fills with chaser
            messages that did not need to exist.
          </p>

          <h2>Pricing power erodes with poor service</h2>
          <p>
            Good service lets you charge more. The American Express Customer
            Service Barometer found that consumers are willing to spend an
            average of 17 percent more with companies that deliver excellent
            service. The inverse is also true: customers who feel their time
            was wasted often leave entirely and take their full lifetime value
            with them. Response time is not just a service metric — it feeds
            directly into revenue.
          </p>

          <h2>What fast actually means, by channel</h2>
          <p>
            Customers define fast differently depending on where they reached
            you. Forrester research finds that 41 percent of customers expect
            an email reply within six hours. For live chat, the expectation is
            under a minute. Setting different SLAs by channel and meeting them
            consistently is what separates businesses that retain customers from
            those that lose them on the second interaction.
          </p>

          <p>
            The math is uncomfortable but clear: slow support costs money in
            every direction. The good news is that response time is one of the
            most fixable metrics in the business. The bottleneck is almost
            never the team — it is the tools and the workflow around them.
          </p>
        </div>

        <div className={styles.articleCta}>
          <p className={styles.articleCtaTitle}>Meet every SLA with Yippie</p>
          <a href={DEMO_URL} className={styles.btnPrimary}>Request demo →</a>
        </div>
      </article>

      <SiteFooter />
    </div>
  );
}
