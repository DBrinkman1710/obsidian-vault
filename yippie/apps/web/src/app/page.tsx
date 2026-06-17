import styles from "./page.module.css";
import SiteNav from "./components/SiteNav";
import SiteFooter from "./components/SiteFooter";
import Reveal from "./components/Reveal";
import ROICalculator from "./components/ROICalculator";
import HourCounter from "./components/HourCounter";
import {
  InboxIcon,
  TicketIcon,
  ChatIcon,
  UsersIcon,
  ActivityIcon,
  BillingIcon,
  ArrowRightIcon,
  CheckIcon,
} from "./components/icons";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.getyippie.com";
const DEMO_URL = process.env.NEXT_PUBLIC_DEMO_URL ?? "/request-demo";

const features = [
  {
    Icon: InboxIcon,
    title: "Smart Inbox",
    desc: "Emails and WhatsApp auto-scan into draft tickets. Review and approve in one click — no manual write-up.",
  },
  {
    Icon: TicketIcon,
    title: "Ticket Management",
    desc: "Track, assign, and close requests in one place. SLA alerts fire before anything slips through.",
  },
  {
    Icon: ChatIcon,
    title: "Live Chat",
    desc: "Embed a chat widget with one line of code. Every conversation lands in a single dashboard.",
  },
  {
    Icon: UsersIcon,
    title: "Contact Management",
    desc: "Full customer history — emails, tickets, invoices — visible at a glance. No inbox digging.",
  },
  {
    Icon: ActivityIcon,
    title: "Activity Feed",
    desc: "Real-time log of everything in your business. Always know who did what and when.",
  },
  {
    Icon: BillingIcon,
    title: "Billing",
    desc: "Send and track invoices without leaving the platform. Support and financials, in sync.",
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
    tier: "Founder",
    price: "€9",
    desc: "For early adopters",
    features: ["2 users", "1,000 contacts", "Inbox + Contacts", "Add-ons à la carte"],
    featured: false,
  },
  {
    tier: "Starter",
    price: "€29",
    desc: "For small teams",
    features: ["5 users", "5,000 contacts", "Inbox + Contacts", "Add-ons à la carte"],
    featured: false,
  },
  {
    tier: "Growth",
    price: "€69",
    desc: "For growing businesses",
    features: ["15 users", "25,000 contacts", "Inbox + Contacts", "Priority support"],
    featured: true,
  },
  {
    tier: "Pro",
    price: "€99",
    desc: "Everything included",
    features: ["Unlimited users", "Unlimited contacts", "All modules", "Dedicated support"],
    featured: false,
  },
];

const inboxItems = [
  { sender: "Acme BV", subject: "Invoice INV-0421 question", dot: "", badge: "review" },
  { sender: "TechCorp", subject: "Login issue — account locked", dot: "amber", badge: "review" },
  { sender: "Nordex", subject: "Pricing plan upgrade", dot: "green", badge: "done" },
  { sender: "Bloom Agency", subject: "Onboarding call request", dot: "", badge: "review" },
];

const trustNames = ["Acme BV", "Nordex", "Bloom Agency", "TechCorp", "Lumen Studio", "Vela Foods"];

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
        <div className={styles.heroInner}>
          <Reveal className={styles.heroCopy}>
            <div className={styles.eyebrowPill}>
              <span className={styles.pillDot} />
              AI customer service for SMBs
            </div>
            <h1 className={styles.heroTitle}>
              Take back the time<br />that matters.
            </h1>
            <p className={styles.heroSub}>
              Yippie auto-drafts every support ticket from your inbox. Review, approve,
              done — so you spend seconds where you used to spend minutes.
            </p>
            <div className={styles.heroActions}>
              <a href={DEMO_URL} className={styles.btnPrimary}>
                Request demo <ArrowRightIcon size={17} />
              </a>
              <a href="/modules" className={styles.btnGhost}>See the product</a>
            </div>
            <p className={styles.heroMeta}>No credit card · Set up in minutes</p>
          </Reveal>

          <Reveal className={styles.heroVisual} delay={120}>
            <ProductMockup />
          </Reveal>
        </div>
      </section>

      {/* Trust strip */}
      <section className={styles.trust}>
        <p className={styles.trustLabel}>Teams at growing businesses run support on Yippie</p>
        <div className={styles.trustRow}>
          {trustNames.map((n) => (
            <span key={n} className={styles.trustName}>{n}</span>
          ))}
        </div>
      </section>

      {/* Stats */}
      <section className={styles.statsBar}>
        {[
          { value: "10h+", label: "saved per week on average" },
          { value: "< 2 min", label: "average ticket response time" },
          { value: "6", label: "modules, one platform" },
        ].map((s, i) => (
          <Reveal key={s.label} className={styles.stat} delay={i * 80}>
            <div className={styles.statValue}>{s.value}</div>
            <div className={styles.statLabel}>{s.label}</div>
          </Reveal>
        ))}
      </section>

      <HourCounter statsUrl={APP_URL} />

      {/* Features */}
      <section id="features" className={styles.section}>
        <Reveal className={styles.sectionHead}>
          <p className={styles.eyebrow}>// Features</p>
          <h2 className={styles.sectionTitle}>Everything your support team needs</h2>
          <p className={styles.sectionSub}>
            One platform for inbox, tickets, live chat, contacts, billing, and activity.
            Stop juggling tools.
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
            No hidden fees. Cancel anytime. Start small and add modules as you grow.
          </p>
        </Reveal>
        <div className={styles.pricingGrid}>
          {plans.map((plan, i) => (
            <Reveal
              key={plan.tier}
              className={`${styles.priceCard} ${plan.featured ? styles.priceFeatured : ""}`}
              delay={i * 60}
            >
              {plan.featured && <span className={styles.priceBadge}>Most popular</span>}
              <p className={styles.priceTier}>{plan.tier}</p>
              <p className={styles.priceAmount}>{plan.price}<sub>/mo</sub></p>
              <p className={styles.priceDesc}>{plan.desc}</p>
              <ul className={styles.priceFeatures}>
                {plan.features.map((f) => (
                  <li key={f}><CheckIcon size={15} className={styles.priceCheck} />{f}</li>
                ))}
              </ul>
              <a href="/pricing" className={`${styles.priceBtn} ${plan.featured ? styles.priceBtnFeatured : ""}`}>
                View plan
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
