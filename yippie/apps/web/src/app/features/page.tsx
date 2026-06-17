import type { Metadata } from "next";
import SiteNav from "../components/SiteNav";
import SiteFooter from "../components/SiteFooter";
import Reveal from "../components/Reveal";
import styles from "../components/content.module.css";
import {
  InboxIcon, TicketIcon, UsersIcon, AiIcon, CalendarIcon, KanbanIcon,
  MailTrackIcon, ChatIcon, TemplateIcon, EditIcon, TeamIcon, BillingIcon,
} from "../components/icons";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.getyippie.com";
const DEMO_URL = process.env.NEXT_PUBLIC_DEMO_URL ?? APP_URL;

export const metadata: Metadata = {
  title: "Features — Yippie customer service platform for SMBs",
  description:
    "Explore every Yippie feature: AI inbox triage, ticket management, contacts, calendar booking, Kanban pipeline, email tracking, live chat, and more — all in one platform.",
  alternates: { canonical: "/features" },
  openGraph: {
    title: "Features — Yippie customer service platform for SMBs",
    description:
      "AI inbox, tickets, contacts, booking, pipeline, email tracking, live chat and more. One platform for SMB customer service.",
    url: "https://getyippie.com/features",
    type: "website",
  },
};

const features = [
  {
    Icon: InboxIcon,
    title: "Smart Inbox",
    desc: "AI reads incoming emails and autofills the ticket subject, priority, and description. You approve in one click — no manual write-up.",
  },
  {
    Icon: TicketIcon,
    title: "Ticket Management",
    desc: "Track, assign, escalate, and close support tickets. SLA alerts, deadline badges, and bulk actions keep nothing slipping through the cracks.",
  },
  {
    Icon: UsersIcon,
    title: "Contact Management",
    desc: "Full customer history — emails, tickets, and pipeline stage in one view. Labels, company grouping, and CSV import/export.",
  },
  {
    Icon: AiIcon,
    title: "AI Assistance",
    desc: "Suggested replies, improve-reply, compose suggestions, and customer briefings — powered by Claude — so every response is faster and sharper.",
  },
  {
    Icon: CalendarIcon,
    title: "Calendar + Booking",
    desc: "A monthly calendar with events and deadlines. Send booking links so customers pick a slot, or propose times yourself. Confirmation emails auto-send.",
  },
  {
    Icon: KanbanIcon,
    title: "Kanban Pipeline",
    desc: "A visual pipeline board. Drag contacts between stages to track deal progress. Booking confirmations automatically move contacts to the right stage.",
  },
  {
    Icon: MailTrackIcon,
    title: "Email Tracking",
    desc: "Track opens, clicks, and bounces on outbound email. The Sent tab shows delivery status in real time so you always know what landed.",
  },
  {
    Icon: ChatIcon,
    title: "Live Chat",
    desc: "Embed a chat widget on your site. Every conversation lands in the same shared inbox alongside email and tickets.",
  },
  {
    Icon: TemplateIcon,
    title: "Templates + Campaign Buttons",
    desc: "Rich drag-and-drop email templates built with Unlayer. Add campaign buttons that apply a pipeline stage the moment a customer clicks.",
  },
  {
    Icon: EditIcon,
    title: "Multi-signature",
    desc: "Keep multiple named email signatures per user and swap the right one per reply — personal, support, or sales.",
  },
  {
    Icon: TeamIcon,
    title: "Team Management",
    desc: "Invite team members, set roles (agent, admin, superuser), and organize them into departments for clean routing.",
  },
  {
    Icon: BillingIcon,
    title: "Billing",
    desc: "Send and track invoices without leaving the platform — support and financials finally in sync.",
  },
];

export default function FeaturesPage() {
  return (
    <div className={styles.page}>
      <SiteNav />

      <section className={styles.hero}>
        <div className={styles.heroTag}>
          <span className={styles.heroTagDot} />
          Everything in one platform
        </div>
        <h1 className={styles.heroTitle}>Every tool your support team needs</h1>
        <p className={styles.heroSub}>
          Yippie brings inbox, tickets, contacts, booking, pipeline, and email
          tracking together — with AI doing the busywork so your team focuses on
          customers.
        </p>
        <div className={styles.heroActions}>
          <a href={DEMO_URL} className={styles.btnPrimary}>Request demo →</a>
          <a href="/blog" className={styles.btnGhost}>Read the blog</a>
        </div>
      </section>

      <section className={styles.section}>
        <p className={styles.eyebrow}>Features</p>
        <h2 className={styles.sectionTitle}>One platform, twelve ways to save time</h2>
        <p className={styles.sectionSub}>
          Stop juggling tools. Everything below works together out of the box.
        </p>
        <div className={styles.grid}>
          {features.map((f, i) => (
            <Reveal key={f.title} className={styles.card} delay={(i % 3) * 70}>
              <div className={styles.iconWrap}><f.Icon size={22} /></div>
              <h3 className={styles.cardTitle}>{f.title}</h3>
              <p className={styles.cardDesc}>{f.desc}</p>
            </Reveal>
          ))}
        </div>
      </section>

      <section className={styles.ctaSection}>
        <h2 className={styles.ctaTitle}>See it on your own inbox</h2>
        <p className={styles.ctaSub}>
          Book a demo and watch Yippie turn a messy support inbox into resolved
          tickets in seconds.
        </p>
        <a href={DEMO_URL} className={styles.btnPrimary}>Request demo →</a>
      </section>

      <SiteFooter />
    </div>
  );
}
