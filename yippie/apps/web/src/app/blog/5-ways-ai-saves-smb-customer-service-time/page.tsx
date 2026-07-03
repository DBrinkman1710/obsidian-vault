import type { Metadata } from "next";
import SiteNav from "../../components/SiteNav";
import SiteFooter from "../../components/SiteFooter";
import styles from "../../components/content.module.css";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.getyippie.com";
const DEMO_URL = process.env.NEXT_PUBLIC_DEMO_URL ?? APP_URL;

const TITLE = "5 Ways AI Is Saving SMBs 10+ Hours a Week on Customer Service";
const DESCRIPTION =
  "AI customer service for small business is giving owners back 10+ hours a week through inbox triage, drafted replies, suggested responses, and smarter help desk software.";
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

      <article className={styles.article}>
        <a href="/blog" className={styles.backLink}>← Back to blog</a>
        <div className={styles.articleDate}>June 12, 2026</div>
        <h1 className={styles.articleTitle}>{TITLE}</h1>
        <div className={styles.articleByline}>By Diederik Brinkman</div>

        <div className={styles.articleBody}>
          <p>
            For a small business, customer service is where time quietly
            disappears. You answer the same questions, triage a tangled inbox,
            and write up tickets by hand. The good news: <strong>AI customer
            service for small business</strong> has matured to the point where it
            handles the busywork, not by replacing your team, but by clearing the
            grunt work off their desk. Here are five ways it adds up to 10+ hours a
            week.
          </p>

          <h2>1. AI triages your inbox automatically</h2>
          <p>
            Instead of reading every message to decide what matters, modern help
            desk software lets AI scan incoming email, sort urgent from routine,
            and route each conversation to the right person. A shared inbox that
            sorts itself means your morning starts with priorities, not noise.
          </p>

          <h2>2. It drafts tickets for you</h2>
          <p>
            Writing up a ticket (subject, priority, a clean description) takes a
            minute or two every time, and those minutes stack up. AI reads the
            customer&apos;s message and fills in all three. You review and approve
            in one click. Across dozens of tickets a day, that is hours back.
          </p>

          <h2>3. Suggested replies cut typing in half</h2>
          <p>
            Most support answers are variations on a theme. AI suggests a complete,
            on-brand reply you can send as-is or tweak in seconds. An
            improve-reply pass tightens tone and grammar, so even rushed responses
            read like your best ones.
          </p>

          <h2>4. Customer briefings remove the context hunt</h2>
          <p>
            Before answering, you usually dig through past emails, tickets, and
            notes to remember who this customer is. AI summarizes the full history
            into a short briefing, so you walk into every conversation already
            informed. No scrolling required.
          </p>

          <h2>5. Automation handles the follow-ups</h2>
          <p>
            Booking links, confirmation emails, and pipeline updates fire
            automatically. When a customer books a call, the confirmation sends
            itself and the contact moves to the right stage. The follow-up work
            that used to slip now just happens.
          </p>

          <p>
            None of this removes the human touch. It protects it. By handing the
            repetitive work to AI, SMB owners spend their hours on the
            conversations that actually need a person. That is the real promise of
            AI in customer support software: not fewer people, but more time for
            the work that matters.
          </p>
        </div>

        <div className={styles.articleCta}>
          <p className={styles.articleCtaTitle}>See Yippie&apos;s AI on your own inbox</p>
          <a href={DEMO_URL} className={styles.btnPrimary}>Request demo →</a>
        </div>
      </article>

      <SiteFooter />
    </div>
  );
}
