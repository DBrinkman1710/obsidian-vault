import styles from "./page.module.css";
import SiteNav from "./components/SiteNav";
import SiteFooter from "./components/SiteFooter";
import Reveal from "./components/Reveal";
import ROICalculator from "./components/ROICalculator";
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
  CheckIcon,
} from "./components/icons";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.getyippie.com";
const DEMO_URL = process.env.NEXT_PUBLIC_DEMO_URL ?? "/request-demo";

const features = [
  {
    Icon: InboxIcon,
    title: "Smart Inbox",
    desc: "AI reads every message and drafts the ticket subject, priority, and description. Review, approve, done.",
  },
  {
    Icon: TicketIcon,
    title: "Tickets",
    desc: "Track, assign, and close requests in one place. SLA alerts fire before anything slips through.",
  },
  {
    Icon: UsersIcon,
    title: "Contacts",
    desc: "Full customer history — emails, tickets, pipeline stage, and company — in one view. No inbox digging.",
  },
  {
    Icon: CalendarIcon,
    title: "Calendar",
    desc: "Monthly calendar with events, deadlines, and bookings. Send booking links so customers pick their own slot.",
  },
  {
    Icon: KanbanIcon,
    title: "Pipeline",
    desc: "Drag-and-drop Kanban to track contacts through custom stages. Campaign buttons auto-advance contacts on click.",
  },
  {
    Icon: ChatIcon,
    title: "Live Chat",
    desc: "Embed a chat widget with one line of code. Every conversation lands in the shared inbox alongside email.",
  },
  {
    Icon: MailTrackIcon,
    title: "Marketing",
    desc: "Stage-targeted email campaigns with A/B testing, real-time tracking, and pipeline auto-advance on click.",
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
    Icon: TemplateIcon,
    title: "Templates",
    desc: "Build a shared library of canned responses. Pick and personalise before sending — fast and on-brand.",
  },
  {
    Icon: TrackingIcon,
    title: "Tracking",
    desc: "Connect your ERP or shop and shipments land on the right contact automatically. Live carrier updates for DHL, UPS, PostNL, and FedEx — no copy-pasting.",
  },
  {
    Icon: SalesIcon,
    title: "Sales",
    desc: "Track product views, add-to-cart, and purchase events. See which contacts are high-intent buyers.",
  },
  {
    Icon: SaasIcon,
    title: "SaaS Billing",
    desc: "Manage recurring subscriptions, track MRR and churn, and link every subscription to a contact.",
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
    desc: "Yippie reads the message and suggests subject, priority, and description.",
  },
  {
    n: "03",
    title: "You approve in one click",
    desc: "Edit if you want, approve — it becomes a real ticket instantly.",
  },
];

const plans = [
  {
    tier: "Starter",
    price: `€${PLAN_LIMITS.starter.priceMonthly}`,
    desc: "For small teams getting started",
    features: ["Inbox + Contacts + Activity", "3 users", "Unlimited contacts", "2,000 AI scans/mo", "Add-ons à la carte"],
    featured: false,
  },
  {
    tier: "Growth",
    price: `€${PLAN_LIMITS.growth.priceMonthly}`,
    desc: "For growing teams handling real volume",
    features: ["Inbox + Contacts + Activity", "5 users", "Unlimited contacts", "5,000 AI scans/mo", "Add-ons à la carte"],
    featured: false,
  },
  {
    tier: "Pro",
    price: `€${PLAN_LIMITS.pro.priceMonthly}`,
    desc: "For established support operations",
    features: ["Inbox + Contacts + Activity", "10 users", "Unlimited contacts", "10,000 AI scans/mo", "Add-ons à la carte"],
    featured: true,
  },
  {
    tier: "Enterprise",
    price: "Custom",
    desc: "Dedicated growth partnership",
    features: ["All modules included", "Unlimited users + contacts", "Unlimited AI scans", "Dedicated support + SLA"],
    featured: false,
  },
];

const inboxItems = [
  { sender: "Acme BV", subject: "Invoice INV-0421 question", dot: "", badge: "review" },
  { sender: "TechCorp", subject: "Login issue — account locked", dot: "amber", badge: "review" },
  { sender: "Nordex", subject: "Pricing plan upgrade", dot: "green", badge: "done" },
  { sender: "Bloom Agency", subject: "Onboarding call request", dot: "", badge: "review" },
];

/* Light, browser-framed product mockup reused in hero + product moment. */
function ProductMockup({ wide = false }: { wide?: boolean }) {
  return (
    <div className={`${styles.frame} ${wide ? styles.frameWide : ""}`}>
      <div className={styles.frameBar}>
        <span className={styles.dot} />
        <span className={styles.dot} />
        <span className={styles.dot} />
        <span className={styles.frameUrl}>app.getyippie.com/inbox</span>
      </div>
      <div className={styles.app}>
        <div className={styles.appSidebar}>
          {[true, false, false, false, false, false].map((active, i) => (
            <div key={i} className={`${styles.appNav} ${active ? styles.appNavActive : ""}`} />
          ))}
        </div>
        <div className={styles.appMain}>
          <div className={styles.appTop}>
            <span className={styles.appTitle}>Inbox</span>
            <span className={styles.appAvatar} />
          </div>
          <div className={styles.appStats}>
            <div className={styles.appStat}>
              <span className={styles.appStatLabel}>Open</span>
              <span className={`${styles.appStatVal} ${styles.brand}`}>12</span>
            </div>
            <div className={styles.appStat}>
              <span className={styles.appStatLabel}>Pending</span>
              <span className={`${styles.appStatVal} ${styles.amber}`}>4</span>
            </div>
            <div className={styles.appStat}>
              <span className={styles.appStatLabel}>Resolved</span>
              <span className={`${styles.appStatVal} ${styles.green}`}>31</span>
            </div>
          </div>
          <div className={styles.appList}>
            {inboxItems.map((item) => (
              <div key={item.sender} className={styles.appRow}>
                <span className={`${styles.appRowDot} ${item.dot === "amber" ? styles.amber : item.dot === "green" ? styles.green : ""}`} />
                <span className={styles.appRowText}>
                  <span className={styles.appRowSender}>{item.sender}</span>
                  <span className={styles.appRowSubject}>{item.subject}</span>
                </span>
                <span className={`${styles.appBadge} ${item.badge === "done" ? styles.badgeDone : styles.badgeReview}`}>
                  {item.badge}
                </span>
              </div>
            ))}
          </div>
        </div>
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
              Yippie auto-drafts every support ticket from your inbox — and grows
              alongside your business. Review, approve, done.
            </p>
            <div className={styles.heroActions}>
              <a href="/custom" className={styles.btnPrimary}>
                Start growing with us <ArrowRightIcon size={17} />
              </a>
              <a href="/modules" className={styles.btnGhost}>See the product</a>
            </div>
            <p className={styles.heroMeta}>No credit card · Unlimited contacts · Cancel anytime</p>
          </Reveal>

          <Reveal className={styles.heroVisual} delay={120}>
            <ProductMockup />
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

      {/* Features */}
      <section id="features" className={styles.section}>
        <Reveal className={styles.sectionHead}>
          <p className={styles.eyebrow}>// Features</p>
          <h2 className={styles.sectionTitle}>Everything your support team needs</h2>
          <p className={styles.sectionSub}>
            Fifteen modules — inbox, tickets, contacts, pipeline, marketing, live chat, and more.
            One platform, stop juggling tools.
          </p>
        </Reveal>
        <div className={styles.featureRows}>
          {features.map((f, i) => (
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
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className={styles.sectionLight}>
        <Reveal className={styles.sectionHead}>
          <p className={styles.eyebrow}>// How it works</p>
          <h2 className={styles.sectionTitle}>From email to resolved — in seconds</h2>
          <p className={styles.sectionSub}>
            Yippie&apos;s AI reads every incoming message and does the write-up for you.
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
                From your first customer to your ten-thousandth — your contact limit never
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
            Inbox, tickets, contacts, and pipeline share the same screen — so nothing
            falls through the cracks and every reply has full context.
          </p>
        </Reveal>
        <Reveal className={styles.momentVisual} delay={120}>
          <ProductMockup wide />
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
            <strong>Founding Member — first 5 spots:</strong> €{PLAN_LIMITS.founder.priceMonthly}/mo for up to 10 users, all core features, and 50% off all paid add-on modules.
          </p>
          <a href="/signup?plan=founder" className={styles.founderBtn}>Claim a founder spot →</a>
        </div>

        <div className={styles.pricingGrid}>
          {plans.map((plan, i) => (
            <Reveal
              key={plan.tier}
              className={`${styles.priceCard} ${plan.featured ? styles.priceFeatured : ""}`}
              delay={i * 60}
            >
              {plan.featured && <span className={styles.priceBadge}>Most popular</span>}
              <p className={styles.priceTier}>{plan.tier}</p>
              <p className={styles.priceAmount}>
                {plan.price}
                {plan.price !== "Custom" && <sub>/mo</sub>}
              </p>
              <p className={styles.priceDesc}>{plan.desc}</p>
              <ul className={styles.priceFeatures}>
                {plan.features.map((f) => (
                  <li key={f}><CheckIcon size={15} className={styles.priceCheck} />{f}</li>
                ))}
              </ul>
              <a href="/pricing" className={`${styles.priceBtn} ${plan.featured ? styles.priceBtnFeatured : ""}`}>
                {plan.tier === "Enterprise" ? "Contact us" : "View plan"}
              </a>
            </Reveal>
          ))}
        </div>
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
            No credit card required.
          </p>
          <a href={DEMO_URL} className={styles.btnPrimaryLg}>
            Request demo <ArrowRightIcon size={18} />
          </a>
        </Reveal>
      </section>

      <SiteFooter />
    </>
  );
}
