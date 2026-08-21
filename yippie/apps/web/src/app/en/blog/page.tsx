import type { Metadata } from "next";
import SiteNav from "@/app/components/SiteNav";
import SiteFooter from "@/app/components/SiteFooter";
import styles from "@/app/components/content.module.css";

export const metadata: Metadata = {
  title: "Yippie Blog | Customer support software tips for SMBs",
  description:
    "Practical guides on AI customer service, help desk software, response times, and shared inbox workflows for small businesses and agencies.",
  alternates: { canonical: "/en/blog" },
  openGraph: {
    title: "Yippie Blog | Customer support software tips for SMBs",
    description:
      "Practical guides on AI customer service, help desk software, and faster response times for SMBs.",
    url: "https://getyippie.com/blog",
    type: "website",
  },
};

const posts = [
  {
    slug: "two_extremes_customer_support_smb",
    title: "The Two Extremes of Customer Support, and Why SMBs Are Stuck in the Middle",
    date: "2026-07-10",
    dateLabel: "July 10, 2026",
    excerpt:
      "Most support software is built for chaos or enterprise. Small businesses sit in neither camp. Here is what the right middle ground looks like, and why it is so rarely built.",
  },
  {
    slug: "klantenservice_software_voor_mkb",
    title: "De twee extremen van klantenservice, en waarom het MKB er tussenin zit",
    date: "2026-07-10",
    dateLabel: "10 juli 2026",
    excerpt:
      "De meeste klantenservice software is gebouwd voor een gedeelde inbox of een enterprise-team. MKB zit er tussenin. Dit is wat de juiste maat er in de praktijk uitziet.",
  },
  {
    slug: "whatsapp_customer_service_for_small_business",
    title: "Why Small Businesses Are Moving Customer Service to WhatsApp",
    date: "2026-07-03",
    dateLabel: "July 3, 2026",
    excerpt:
      "WhatsApp has 2 billion users and message open rates above 90 percent. Here is why small businesses are adding it as a support channel, and how to set it up properly.",
  },
  {
    slug: "cost_of_slow_customer_service_response",
    title: "What a Slow Customer Service Response Actually Costs You",
    date: "2026-06-26",
    dateLabel: "June 26, 2026",
    excerpt:
      "Slow support is not just frustrating: it costs revenue, drives negative reviews, and creates more work internally. Here is what the numbers say.",
  },
  {
    slug: "shared_inbox_vs_regular_email",
    title: "Shared Inbox vs. Regular Email: When to Make the Switch",
    date: "2026-06-19",
    dateLabel: "June 19, 2026",
    excerpt:
      "Still running support from a regular inbox? Here is how to know when shared inbox software pays off, and what you actually gain when you make the switch.",
  },
  {
    slug: "5-ways-ai-saves-smb-customer-service-time",
    title: "5 Ways AI Is Saving SMBs 10+ Hours a Week on Customer Service",
    date: "2026-06-12",
    dateLabel: "June 12, 2026",
    excerpt:
      "From inbox triage to drafting replies, AI customer service for small business is quietly giving owners back their week. Here are five concrete ways it adds up.",
  },
  {
    slug: "how-to-reduce-customer-service-response-time",
    title: "How to Cut Your Customer Service Response Time in Half",
    date: "2026-06-05",
    dateLabel: "June 5, 2026",
    excerpt:
      "Want to reduce customer service response time without hiring? These five tactics do the heavy lifting: templates, SLAs, inbox triage, and clean handoffs.",
  },
];

export default function BlogIndexPage() {
  return (
    <div className={styles.page}>
      <SiteNav />

      <section className={styles.hero}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo-white-bg-mark.svg" alt="" aria-hidden="true" className={styles.pageLogoMark} />
        <div className={styles.heroTag}>
          <span className={styles.heroTagDot} />
          Yippie blog
        </div>
        <h1 className={styles.heroTitle}>Customer support, made smarter</h1>
        <p className={styles.heroSub}>
          Practical guides on AI customer service, help desk software, and faster
          response times, written for small businesses and the agencies that
          serve them.
        </p>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionInner}>
          <div className={styles.blogGrid}>
            {posts.map((post) => (
              <a key={post.slug} href={`/blog/${post.slug}`} className={styles.blogCard}>
                <div className={styles.blogDate}>{post.dateLabel}</div>
                <h2 className={styles.blogTitle}>{post.title}</h2>
                <p className={styles.blogExcerpt}>{post.excerpt}</p>
                <span className={styles.blogReadMore}>Read more →</span>
              </a>
            ))}
          </div>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
