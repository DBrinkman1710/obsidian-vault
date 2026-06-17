import type { Metadata } from "next";
import Image from "next/image";
import SiteNav from "../components/SiteNav";
import SiteFooter from "../components/SiteFooter";
import Reveal from "../components/Reveal";
import contentStyles from "../components/content.module.css";
import styles from "./modules.module.css";
import {
  InboxIcon,
  TicketIcon,
  UsersIcon,
  CalendarIcon,
  KanbanIcon,
  ChatIcon,
  MailTrackIcon,
  TemplateIcon,
  ActivityIcon,
  TeamIcon,
  CheckIcon,
  ArrowRightIcon,
} from "../components/icons";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.getyippie.com";
const DEMO_URL = process.env.NEXT_PUBLIC_DEMO_URL ?? "/request-demo";

export const metadata: Metadata = {
  title: "Modules — Yippie customer service platform",
  description:
    "A deep look at every Yippie module: inbox, tickets, contacts, calendar, pipeline, live chat, email tracking, templates, activity, and team — all built for SMBs.",
  alternates: { canonical: "/modules" },
  openGraph: {
    title: "Modules — Yippie customer service platform",
    description:
      "Explore every module in Yippie: inbox, tickets, contacts, calendar, pipeline, live chat, email tracking, templates, activity, and team.",
    url: "https://getyippie.com/modules",
    type: "website",
  },
};

type Module = {
  id: string;
  kicker: string;
  title: string;
  desc: string;
  bullets: string[];
  shot: string;
  path: string;
  Icon: React.ComponentType<{ size?: number }>;
};

const modules: Module[] = [
  {
    id: "inbox",
    kicker: "INBOX",
    title: "Smart Inbox — zero manual write-up",
    desc: "Every incoming email lands in a unified inbox where AI reads the message and instantly drafts the ticket subject, priority, and description. You review, edit if needed, and approve in one click — turning minutes of admin into seconds.",
    bullets: [
      "AI auto-drafts subject, priority, and description from every email",
      "Bulk approve, archive, or reassign in a single action",
      "Shared inbox for the whole team — no more CC chains",
      "SLA timers start the moment a message arrives",
    ],
    shot: "/shots/inbox.png",
    path: "/inbox",
    Icon: InboxIcon,
  },
  {
    id: "tickets",
    kicker: "TICKETS",
    title: "Tickets — track everything, miss nothing",
    desc: "Once approved, messages become structured support tickets with an assignee, priority, deadline, and full email history. SLA alerts fire before anything slips, and bulk actions let you triage a dozen issues at once.",
    bullets: [
      "SLA deadline badges with color-coded urgency alerts",
      "Assign tickets to agents or departments with one click",
      "Bulk select, reassign, or close multiple tickets at once",
      "Full conversation thread lives on the ticket — no inbox switching",
    ],
    shot: "/shots/tickets.png",
    path: "/tickets",
    Icon: TicketIcon,
  },
  {
    id: "contacts",
    kicker: "CONTACTS",
    title: "Contacts — full customer context, always",
    desc: "Every contact has a complete timeline: all emails, tickets, pipeline stage, and company membership in one view. Labels, company grouping, and CSV import/export mean your CRM lives here — not in a separate tab.",
    bullets: [
      "Unified timeline of emails, tickets, and pipeline moves",
      "Company grouping — link contacts to accounts with a click",
      "Custom labels for segmentation and quick filtering",
      "CSV import and export for existing customer lists",
    ],
    shot: "/shots/contacts.png",
    path: "/contacts",
    Icon: UsersIcon,
  },
  {
    id: "calendar",
    kicker: "CALENDAR + BOOKING",
    title: "Calendar — bookings that confirm themselves",
    desc: "A monthly calendar shows events, ticket deadlines, and booked meetings in one place. Send a personal booking link so customers pick a slot that works for them, or propose times yourself. Confirmation emails go out automatically.",
    bullets: [
      "Monthly calendar view with events, deadlines, and bookings",
      "Personal booking links — customers choose their own slot",
      "Confirmation and reminder emails send automatically",
      "Booking confirmations can push a pipeline contact to the next stage",
    ],
    shot: "/shots/calendar.png",
    path: "/calendar",
    Icon: CalendarIcon,
  },
  {
    id: "pipeline",
    kicker: "PIPELINE",
    title: "Pipeline — visualise every deal at a glance",
    desc: "A drag-and-drop Kanban board lets you track contacts through custom stages — from first touch to closed deal. Campaign buttons in emails can automatically move a contact to the right stage the moment they click.",
    bullets: [
      "Fully customisable Kanban stages — name them anything",
      "Drag contacts between stages with instant persistence",
      "Campaign buttons auto-advance contacts on click",
      "Booking confirmations trigger automatic stage moves",
    ],
    shot: "/shots/pipeline.png",
    path: "/pipeline",
    Icon: KanbanIcon,
  },
  {
    id: "chat",
    kicker: "LIVE CHAT",
    title: "Live Chat — one widget, same inbox",
    desc: "Embed a chat widget on your website with a single script tag. Every visitor conversation lands in the shared inbox alongside email and tickets — so your team sees everything in one place without juggling tabs.",
    bullets: [
      "One-line embed script — live in minutes, no third-party tools",
      "Chat conversations appear in the shared inbox automatically",
      "Assign chats to agents or let the team claim them",
      "Full chat history attached to the contact record",
    ],
    shot: "/shots/chat.png",
    path: "/chat",
    Icon: ChatIcon,
  },
  {
    id: "email-tracking",
    kicker: "EMAIL TRACKING",
    title: "Email Tracking — know what landed",
    desc: "The Sent tab shows real-time delivery status for every outbound email: delivered, opened, clicked, or bounced. Stop guessing whether your follow-up reached the right person — see exactly when they opened it.",
    bullets: [
      "Real-time open, click, and bounce tracking on all outbound mail",
      "Sent tab with delivery timestamps at a glance",
      "Bounce alerts so you can fix bad addresses immediately",
      "Works on individual replies and bulk campaign sends",
    ],
    shot: "/shots/email-tracking.png",
    path: "/billing",
    Icon: MailTrackIcon,
  },
  {
    id: "templates",
    kicker: "TEMPLATES",
    title: "Templates — polished emails in seconds",
    desc: "Build rich HTML email templates with the Unlayer drag-and-drop editor and save them for the whole team. Add campaign buttons that apply a pipeline stage the moment a customer clicks — no developer required.",
    bullets: [
      "Drag-and-drop Unlayer editor — no HTML knowledge needed",
      "Team-wide template library accessible from any reply window",
      "Campaign buttons that trigger pipeline stage moves on click",
      "Preview on desktop and mobile before sending",
    ],
    shot: "/shots/templates.png",
    path: "/settings/templates",
    Icon: TemplateIcon,
  },
  {
    id: "activity",
    kicker: "ACTIVITY",
    title: "Activity — your business in real time",
    desc: "A chronological feed of everything that happens across your workspace: emails sent, tickets updated, contacts moved, bookings confirmed. Always know who did what and when, without asking.",
    bullets: [
      "Real-time log of every action across the platform",
      "Filter by event type, user, or date range",
      "Ticket and contact links take you straight to context",
      "Perfect audit trail for team accountability",
    ],
    shot: "/shots/activity.png",
    path: "/activity",
    Icon: ActivityIcon,
  },
  {
    id: "team",
    kicker: "TEAM",
    title: "Team — the right person on every ticket",
    desc: "Invite agents, set their role (agent, admin, or superuser), and organise them into departments. Tickets and chats route to the right department automatically, so the right person always picks up the right conversation.",
    bullets: [
      "Role-based permissions — agent, admin, and superuser tiers",
      "Departments for clean routing of tickets and conversations",
      "Invite new team members with a single email link",
      "Multiple named email signatures per user",
    ],
    shot: "/shots/team.png",
    path: "/settings/team",
    Icon: TeamIcon,
  },
];

/** Minimal browser-chrome frame wrapping a screenshot (or placeholder). */
function ScreenshotFrame({
  src,
  alt,
  url,
  Icon,
}: {
  src: string;
  alt: string;
  url: string;
  Icon: React.ComponentType<{ size?: number }>;
}) {
  return (
    <div className={styles.frame}>
      <div className={styles.frameBar}>
        <span className={styles.dot} />
        <span className={styles.dot} />
        <span className={styles.dot} />
        <span className={styles.frameUrl}>
          app.getyippie.com{url}
        </span>
      </div>
      <div className={styles.screenshotWrap}>
        <Image
          src={src}
          alt={alt}
          width={800}
          height={500}
          unoptimized
          className={styles.screenshot}
          onError={undefined}
        />
        {/* Fallback overlay — visible only when image fails to load.
            We always render the Image; the placeholder is layered behind. */}
        <div className={styles.screenshotPlaceholder} aria-hidden="true">
          <span className={styles.placeholderIcon}>
            <Icon size={22} />
          </span>
          <span className={styles.placeholderLabel}>
            // screenshot coming soon
          </span>
        </div>
      </div>
    </div>
  );
}

export default function ModulesPage() {
  return (
    <div className={contentStyles.page}>
      <SiteNav />

      {/* Hero */}
      <section className={contentStyles.hero}>
        <div className={contentStyles.heroTag}>
          <span className={contentStyles.heroTagDot} />
          The product
        </div>
        <h1 className={contentStyles.heroTitle}>
          Ten modules. One platform.
        </h1>
        <p className={contentStyles.heroSub}>
          Inbox, tickets, contacts, calendar, pipeline, live chat, email
          tracking, templates, activity, and team — all working together,
          all in one workspace.
        </p>
        <div className={contentStyles.heroActions}>
          <a href={DEMO_URL} className={contentStyles.btnPrimary}>
            Request demo →
          </a>
          <a href="/modules" className={contentStyles.btnGhost}>
            All features
          </a>
        </div>
      </section>

      {/* Sticky module nav */}
      <nav className={styles.nav} aria-label="Module navigation">
        <div className={styles.navInner}>
          {modules.map((m) => (
            <a key={m.id} href={`#${m.id}`} className={styles.navLink}>
              <m.Icon size={13} />
              {m.kicker.split(" ")[0]}
            </a>
          ))}
        </div>
      </nav>

      {/* Module blocks */}
      {modules.map((mod, i) => {
        const isEven = i % 2 === 1; // odd index → alt bg
        const isReverse = i % 2 === 0; // even index → image right, copy left

        return (
          <section
            key={mod.id}
            id={mod.id}
            className={isEven ? styles.blockAlt : undefined}
          >
            <Reveal
              className={`${styles.block} ${isReverse ? styles.reverse : ""}`}
              delay={0}
            >
              {/* Copy */}
              <div className={styles.copy}>
                <p className={styles.kicker}>
                  <span className={styles.kickerIcon}>
                    <mod.Icon size={16} />
                  </span>
                  // {mod.kicker}
                </p>
                <h2 className={styles.title}>{mod.title}</h2>
                <p className={styles.desc}>{mod.desc}</p>
                <ul className={styles.bullets}>
                  {mod.bullets.map((b) => (
                    <li key={b} className={styles.bullet}>
                      <CheckIcon size={15} className={styles.bulletCheck} />
                      {b}
                    </li>
                  ))}
                </ul>
                <a
                  href={`${APP_URL}${mod.path}`}
                  className={styles.openBtn}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Open in app
                  <ArrowRightIcon size={15} />
                </a>
              </div>

              {/* Visual */}
              <div className={styles.visual}>
                <ScreenshotFrame
                  src={mod.shot}
                  alt={`${mod.title} screenshot`}
                  url={mod.path}
                  Icon={mod.Icon}
                />
              </div>
            </Reveal>
          </section>
        );
      })}

      {/* Closing CTA */}
      <section className={styles.ctaSection}>
        <Reveal className={styles.ctaInner}>
          <p className={styles.ctaEyebrow}>// Ready to try it?</p>
          <h2 className={styles.ctaTitle}>
            See every module live in your inbox
          </h2>
          <p className={styles.ctaSub}>
            Book a personalised demo and watch Yippie connect your inbox,
            tickets, and pipeline in one clean workspace.
          </p>
          <a href={DEMO_URL} className={styles.ctaBtn}>
            Request demo <ArrowRightIcon size={16} />
          </a>
          <p className={styles.ctaMeta}>No credit card · Set up in minutes</p>
        </Reveal>
      </section>

      <SiteFooter />
    </div>
  );
}
