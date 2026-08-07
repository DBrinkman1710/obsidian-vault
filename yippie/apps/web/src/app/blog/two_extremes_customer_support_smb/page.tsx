import type { Metadata } from "next";
import SiteNav from "../../components/SiteNav";
import SiteFooter from "../../components/SiteFooter";
import styles from "../../components/content.module.css";
import { breadcrumbJsonLd } from "../jsonld";

const DEMO_URL = process.env.NEXT_PUBLIC_DEMO_URL ?? "/request-demo";

const TITLE = "The Two Extremes of Customer Support — and Why SMBs Are Stuck in the Middle";
const DESCRIPTION =
  "Most customer support software is built for one of two extremes: shared inbox chaos or enterprise complexity. Small businesses deserve something in between. Here is what that looks like.";
const URL = "https://getyippie.com/blog/two_extremes_customer_support_smb";
const DATE = "2026-07-10";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/blog/two_extremes_customer_support_smb" },
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
        <div className={styles.articleDate}>July 10, 2026</div>
        <h1 className={styles.articleTitle}>{TITLE}</h1>
        <div className={styles.articleByline}>By Diederik Brinkman</div>

        <div className={styles.articleBody}>
          <p>
            Customer support software exists at two extremes. On one end: the shared Gmail or
            Outlook inbox your whole team logs into. On the other: Zendesk, Freshdesk, and their
            enterprise cousins, with pricing pages that say &quot;Contact sales&quot; and onboarding
            processes that cost more than the software.
          </p>
          <p>
            Small and medium businesses sit uncomfortably in the middle. Too big for the chaos of
            a shared inbox. Too small — and too sane — to justify enterprise software designed
            for 500 person support teams.
          </p>
          <p>
            I built Yippie because I kept seeing the same situation play out. Let me explain what
            both extremes actually look like when they go wrong.
          </p>

          <h2>Extreme one: the shared inbox</h2>
          <p>
            A team shares a single support email address. Everyone has the password. Messages come
            in, get read, sometimes get answered, and occasionally get forgotten entirely. Here is
            how it usually breaks down.
          </p>
          <p>
            Two people reply to the same message. The customer gets contradicting answers — one
            from an agent who read the thread on Tuesday morning, another from someone who opened
            it fresh on Tuesday afternoon and had no idea the first reply had already gone out.
            Embarrassing to fix. Damaging to trust.
          </p>
          <p>
            Or the quieter version: a message sits in the inbox for three days because everyone
            assumed someone else was handling it. Nobody owned it. Nobody asked. It just aged
            there, a silent promise broken. The customer&apos;s follow up — &quot;did you receive my
            email?&quot; — is the first sign anything was wrong.
          </p>
          <p>
            And then there is the channel fragmentation problem that gets worse every year. The
            same customer emails you and messages you on WhatsApp. In a shared inbox world, those
            two threads live in completely separate places. One agent handles the email, another
            picks up the WhatsApp, neither knows the other exists. So the customer has to explain
            themselves twice, and your team has built two separate contact records for the same
            person. Nobody has the full picture. Everyone is starting from scratch.
          </p>

          <h2>Extreme two: the enterprise tool</h2>
          <p>
            So you look for a proper solution. You land on Zendesk, Freshdesk, Zoho Desk. The
            feature lists are impressive. Then you start configuring.
          </p>
          <p>
            SLA policies with multi level approval workflows. Manager sign off before an escalation
            fires. Skill based routing rules that assign tickets to specialists based on tag
            combinations. These are real features that solve real problems — for a 200 person
            support organisation where a ticket escalating incorrectly genuinely creates an incident.
          </p>
          <p>
            For a team of three, they are friction. You spend a Saturday setting up routing rules
            for a team small enough to shout across the office. You configure SLA policies for
            tickets that everyone already knows are urgent because you can see the customer name
            in the subject line.
          </p>
          <p>
            The pricing is the final insult. Per agent fees that climb every time you hire someone.
            Annual contracts before you have established that the tool even fits your workflow.
            Minimums, add ons, a &quot;Contact sales&quot; button where the price should be. I once
            opened a competitor&apos;s pricing page, tried to calculate what it would cost for a
            ten person team with the features we needed, and gave up before I found the answer.
            That is not an accident.
          </p>

          <h2>Why the middle is so poorly served</h2>
          <p>
            The shared inbox is free and familiar. Enterprise software is well funded and feature rich.
            The companies building for SMBs either start from one of those two poles and add features,
            or build something so generic it solves neither problem well.
          </p>
          <p>
            What a ten person team actually needs is not complicated. They need to see who owns
            which message. They need a single view that unifies email and WhatsApp so the same
            customer does not have two contact records. They need something that takes five minutes
            to set up, not five days. And they need a price that does not assume they are a
            cost centre with a dedicated procurement team.
          </p>
          <p>
            That is the design brief for Yippie. Flat workspace pricing — one number, regardless of
            how many agents you add. An inbox that brings email and WhatsApp together so one contact
            record exists per customer. AI that reads incoming messages and drafts the ticket
            write up so your team reviews instead of types. No approval workflows, no skill based
            routing trees, no &quot;Contact sales.&quot;
          </p>
          <p>
            The goal is not to be a scaled down Zendesk. It is to be exactly the right size for
            a team that takes customer service seriously but has ten other things to do today.
          </p>
        </div>

        <div className={styles.articleCta}>
          <p className={styles.articleCtaTitle}>See what the middle ground looks like</p>
          <a href={DEMO_URL} className={styles.btnPrimary}>Request demo →</a>
        </div>
      </article>

      <SiteFooter />
    </div>
  );
}
