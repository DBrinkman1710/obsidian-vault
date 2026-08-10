import React from "react";
import Image from "next/image";
import type { Metadata } from "next";
import styles from "./page.module.css";

export const metadata: Metadata = {
  alternates: { canonical: "/" },
};
import SiteNav from "./components/SiteNav";
import SiteFooter from "./components/SiteFooter";
import Reveal from "./components/Reveal";
import ROICalculator from "./components/ROICalculator";
import PricingTeaser from "./components/PricingTeaser";
import UseCaseStories from "./components/UseCaseStories";
import { PLAN_LIMITS } from "@/lib/config";
// import HourCounter from "./components/HourCounter";
import {
  InboxIcon,
  TicketIcon,
  ChatIcon,
  UsersIcon,
  ActivityIcon,
  BillingIcon,
  CalendarIcon,
  KanbanIcon,
  MailTrackIcon,
  TemplateIcon,
  TeamIcon,
  TrackingIcon,
  SalesIcon,
  SaasIcon,
  ArrowRightIcon,
} from "./components/icons";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.getyippie.com";
const DEMO_URL = process.env.NEXT_PUBLIC_DEMO_URL ?? "/request-demo";

const FOUNDER_SPOTS_TOTAL = 5;
const FOUNDER_SPOTS_LEFT = parseInt(process.env.NEXT_PUBLIC_FOUNDER_SPOTS_LEFT ?? "5", 10);

const featureGroups = [
  {
    label: "Support",
    items: [
      {
        Icon: InboxIcon,
        title: "Smart Inbox",
        desc: "One shared inbox for the whole team. Add the AI Inbox add-on and AI drafts the ticket subject, priority, and description. Review, approve, done.",
      },
      {
        Icon: TicketIcon,
        title: "Tickets",
        desc: "Track, assign, and close requests in one place. SLA alerts fire before anything slips through.",
      },
      {
        Icon: UsersIcon,
        title: "Contacts",
        desc: "Full customer history in one view: emails, tickets, pipeline stage, and company. No inbox digging.",
      },
      {
        Icon: ChatIcon,
        title: "Live Chat",
        desc: "Embed a chat widget with one line of code. Every conversation lands in the shared inbox alongside email.",
      },
      {
        Icon: TemplateIcon,
        title: "Templates",
        desc: "Build a shared library of canned responses. Pick and personalise before sending. Fast and on-brand.",
      },
    ],
  },
  {
    label: "Sales & Growth",
    items: [
      {
        Icon: KanbanIcon,
        title: "Pipeline",
        desc: "Drag-and-drop Kanban to track contacts through custom stages. Campaign buttons auto-advance contacts on click.",
      },
      {
        Icon: MailTrackIcon,
        title: "Marketing",
        desc: "Stage-targeted email campaigns with A/B testing, real-time tracking, and pipeline auto-advance on click.",
      },
      {
        Icon: SalesIcon,
        title: "Sales",
        desc: "Track product views, add-to-cart, and purchase events. See which contacts are high-intent buyers.",
      },
      {
        Icon: SaasIcon,
        title: "SaaS Analytics",
        desc: "Manage recurring subscriptions, track MRR and churn, and link every subscription to a contact.",
      },
    ],
  },
  {
    label: "Operations",
    items: [
      {
        Icon: CalendarIcon,
        title: "Calendar",
        desc: "Monthly calendar with events, deadlines, and bookings. Send booking links so customers pick their own slot.",
      },
      {
        Icon: TeamIcon,
        title: "Departments",
        desc: "Create departments, add agents, and let inbound email route automatically to the right team.",
      },
      {
        Icon: BillingIcon,
        title: "Billing",
        desc: "Create and send invoices from your workspace. Track payment status without a separate billing tool.",
      },
      {
        Icon: ActivityIcon,
        title: "Activity",
        desc: "Real-time log of everything across your workspace. Always know who did what and when.",
      },
      {
        Icon: TeamIcon,
        title: "Team",
        desc: "Invite agents, set roles, and organise into departments. Tickets route to the right person automatically.",
      },
      {
        Icon: TrackingIcon,
        title: "Tracking",
        desc: "Connect your ERP or shop and shipments land on the right contact automatically. Live carrier updates for DHL, UPS, PostNL, and FedEx. No copy-pasting.",
      },
    ],
  },
];

const steps = [
  {
    n: "01",
    title: "Customer sends a message",
    desc: "An email or WhatsApp message lands in your Yippie inbox automatically.",
  },
  {
    n: "02",
    title: "AI drafts the ticket",
    desc: "The AI Inbox add-on reads the message and suggests subject, priority, and description.",
  },
  {
    n: "03",
    title: "You approve in one click",
    desc: "Edit if you want, then approve. It becomes a real ticket instantly.",
  },
];

/* Real product screenshot in the same browser frame, with a soft scrim so an
   optional caption stays readable. Reuses the /shots assets from the modules page. */
function ProductShot({
  src,
  url,
  alt,
  caption,
  wide = false,
  tilt = false,
}: {
  src: string;
  url: string;
  alt: string;
  caption?: string;
  wide?: boolean;
  tilt?: boolean;
}) {
  return (
    <div className={`${styles.frame} ${wide ? styles.frameWide : ""} ${tilt ? styles.frameTilt : ""}`}>
      <div className={styles.frameBar}>
        <span className={styles.dot} />
        <span className={styles.dot} />
        <span className={styles.dot} />
        <span className={styles.frameUrl}>app.getyippie.com{url}</span>
      </div>
      <div className={styles.shotWrap}>
        <Image
          src={src}
          alt={alt}
          width={1440}
          height={900}
          unoptimized
          className={styles.shotImg}
          priority={!wide}
        />
        {caption && <span className={styles.shotScrim} aria-hidden="true" />}
        {caption && <span className={styles.shotCaption}>{caption}</span>}
      </div>
    </div>
  );
}

export default function HomePage() {
  return (
    <>
      <SiteNav />

      {/* Hero */}
      <section className={`${styles.hero} bgGrid`}>
        <div className={styles.heroGlow} aria-hidden="true" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/logo-white-bg-mark.svg"
          alt=""
          aria-hidden="true"
          className={styles.heroLogoMark}
        />
        <div className={styles.heroInner}>
          <Reveal className={styles.heroCopy}>
            <div className={styles.eyebrowPill}>
              <span className={styles.pillDot} />
              Your growth partner in customer service
            </div>
            <h1 className={styles.heroTitle}>
              Take back the time<br />that matters.
            </h1>
            <p className={styles.heroSub}>
              Yippie brings your whole support inbox into one workspace and grows
              alongside your business. Add the AI Inbox add-on and every support
              ticket is auto-drafted for you. Review, approve, done.
            </p>
            <div className={styles.heroActions}>
              <div className={styles.heroActionsTop}>
                <a href="/signup" className={styles.btnPrimary}>
                  Start your free 30 day trial <ArrowRightIcon size={17} />
                </a>
                <a href={DEMO_URL} className={styles.btnGhost}>Request demo</a>
              </div>
              <a href="#workflow" className={styles.btnHow}>
                How does it work? <span aria-hidden="true">↓</span>
              </a>
            </div>
            <p className={styles.heroMeta}>30 days free · No credit card · Cancel anytime</p>
          </Reveal>

          <Reveal className={styles.heroVisual} delay={120}>
            <ProductShot
              src="/shots/inbox.png"
              url="/inbox"
              alt="Yippie shared inbox with AI-drafted tickets"
              tilt
            />
          </Reveal>
        </div>
      </section>

      {/* Stats */}
      <section className={styles.statsBar}>
        {[
          { value: "10h+", label: "saved per week on average" },
          { value: "< 2 min", label: "average ticket response time" },
          { value: "15", label: "modules, one platform" },
        ].map((s, i) => (
          <Reveal key={s.label} className={styles.stat} delay={i * 80}>
            <div className={styles.statValue}>{s.value}</div>
            <div className={styles.statLabel}>{s.label}</div>
          </Reveal>
        ))}
      </section>

      {/* <HourCounter statsUrl={APP_URL} /> */}

      {/* Use case clickthroughs — two-button story switcher */}
      <div id="workflow" className={styles.workflowAnchor}>
        <UseCaseStories />
      </div>

      {/* Features */}
      <section id="features" className={styles.section}>
        <Reveal className={styles.sectionHead}>
          <p className={styles.eyebrow}>// Features</p>
          <h2 className={styles.sectionTitle}>Everything your support team needs</h2>
          <p className={styles.sectionSub}>
            Fifteen modules: inbox, tickets, contacts, pipeline, marketing, live chat, and more.
            One platform. Stop juggling tools.
          </p>
        </Reveal>
        <div className={styles.featureRows}>
          {featureGroups.map((group) => (
            <React.Fragment key={group.label}>
              <p className={styles.featureGroupLabel}>{group.label}</p>
              {group.items.map((f, i) => (
                <Reveal key={f.title} className={styles.featureRow} delay={(i % 2) * 70}>
                  <div className={styles.featureIcon}>
                    <f.Icon size={22} />
                  </div>
                  <div>
                    <h3 className={styles.featureTitle}>{f.title}</h3>
                    <p className={styles.featureDesc}>{f.desc}</p>
                  </div>
                </Reveal>
              ))}
            </React.Fragment>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className={styles.sectionLight}>
        <Reveal className={styles.sectionHead}>
          <p className={styles.eyebrow}>// How it works</p>
          <h2 className={styles.sectionTitle}>From email to resolved in seconds</h2>
          <p className={styles.sectionSub}>
            With the AI Inbox add-on, Yippie reads every incoming message and does the write-up for you.
          </p>
        </Reveal>
        <div className={styles.steps}>
          {steps.map((s, i) => (
            <Reveal key={s.n} className={styles.step} delay={i * 90}>
              <div className={styles.stepNum}>{s.n}</div>
              <h3 className={styles.stepTitle}>{s.title}</h3>
              <p className={styles.stepDesc}>{s.desc}</p>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Growth Partner */}
      <section className={styles.sectionLight}>
        <Reveal className={styles.sectionHead}>
          <p className={styles.eyebrow}>// Growth Partner</p>
          <h2 className={styles.sectionTitle}>When you grow, we grow with you.</h2>
          <p className={styles.sectionSub}>Choose what your company needs, no more, no less.</p>
        </Reveal>
        <div className={styles.featureRows}>
          <Reveal className={styles.featureRow}>
            <div className={styles.featureIcon}>
              <UsersIcon size={22} />
            </div>
            <div>
              <h3 className={styles.featureTitle}>Unlimited contacts, on every plan</h3>
              <p className={styles.featureDesc}>
                From your first customer to your ten-thousandth, your contact limit never
                changes. No forced upgrade, no surprise cap.
              </p>
            </div>
          </Reveal>
          <Reveal className={styles.featureRow} delay={70}>
            <div className={styles.featureIcon}>
              <BillingIcon size={22} />
            </div>
            <div>
              <h3 className={styles.featureTitle}>Transparent pricing, no games</h3>
              <p className={styles.featureDesc}>
                One flat monthly price. No hidden fees, no per-contact charges.
                You always know exactly what you pay.
              </p>
            </div>
          </Reveal>
          <Reveal className={styles.featureRow} delay={140}>
            <div className={styles.featureIcon}>
              <ChatIcon size={22} />
            </div>
            <div>
              <h3 className={styles.featureTitle}>Reachable people, not a black box</h3>
              <p className={styles.featureDesc}>
                We&apos;re here when you need us. Not a ticket queue, not a chatbot.
                Founders who want to see you succeed.
              </p>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ROI calculator */}
      <ROICalculator appUrl={DEMO_URL} />

      {/* Product moment (dark) */}
      <section className={`${styles.moment} bgDots`}>
        <Reveal className={styles.momentHead}>
          <p className={styles.eyebrowDark}>// One workspace</p>
          <h2 className={styles.momentTitle}>Everything in one place</h2>
          <p className={styles.momentSub}>
            Inbox, tickets, contacts, and pipeline share the same screen, so nothing
            falls through the cracks and every reply has full context.
          </p>
        </Reveal>
        <Reveal className={styles.momentVisual} delay={120}>
          <ProductShot
            src="/shots/contacts.png"
            url="/contacts"
            alt="Contact record with full history: emails, tickets, and pipeline stage"
            caption="Every contact, with full history in one view"
            wide
          />
        </Reveal>
      </section>

      {/* Pricing teaser */}
      <section id="pricing" className={styles.section}>
        <Reveal className={styles.sectionHead}>
          <p className={styles.eyebrow}>// Pricing</p>
          <h2 className={styles.sectionTitle}>Simple, honest pricing</h2>
          <p className={styles.sectionSub}>
            No hidden fees. Unlimited contacts. Start small and add modules as you grow.
          </p>
        </Reveal>

        <div className={styles.founderBanner}>
          <span className={styles.founderBadge}>Limited offer</span>
          <p className={styles.founderText}>
            <strong>Founding Member: {FOUNDER_SPOTS_LEFT} of {FOUNDER_SPOTS_TOTAL} spots left</strong> at €{PLAN_LIMITS.founder.priceMonthly}/mo for up to 10 users, all core features, and 50% off all paid add-on modules.
          </p>
          <a href="/signup?plan=founder" className={styles.founderBtn}>Claim a founder spot →</a>
        </div>

        <PricingTeaser />
        <div className={styles.pricingMore}>
          <a href="/pricing" className={styles.textLink}>
            Compare all plans &amp; add-ons <ArrowRightIcon size={15} />
          </a>
        </div>
      </section>

      {/* CTA */}
      <section className={styles.cta}>
        <Reveal className={styles.ctaCard}>
          <h2 className={styles.ctaTitle}>Ready to win back your time?</h2>
          <p className={styles.ctaSub}>
            Join businesses that handle customer support in half the time with Yippie.
            30 days free, no credit card required.
          </p>
          <a href="/signup" className={styles.btnPrimaryLg}>
            Start your free 30 day trial <ArrowRightIcon size={18} />
          </a>
          <p className={styles.ctaSub} style={{ marginTop: 14 }}>
            <a href={DEMO_URL} style={{ color: "inherit", textDecoration: "underline" }}>
              Or try the instant demo
            </a>
          </p>
        </Reveal>
      </section>

      <SiteFooter />
    </>
  );
}
