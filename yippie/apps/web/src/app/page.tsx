import styles from "./page.module.css";
import ROICalculator from "./components/ROICalculator";
import HourCounter from "./components/HourCounter";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.getyippie.com";
// Phase 12: demo-request form lives at /demo once built; falls back to app login for now
const DEMO_URL = process.env.NEXT_PUBLIC_DEMO_URL ?? APP_URL;

const features = [
  {
    icon: "📬",
    title: "Smart Inbox",
    desc: "Emails and WhatsApp auto-scan into draft tickets. Review and approve in one click — no manual write-up.",
  },
  {
    icon: "🎫",
    title: "Ticket Management",
    desc: "Track, assign, and close requests in one place. SLA alerts fire before anything slips through.",
  },
  {
    icon: "💬",
    title: "Live Chat",
    desc: "Embed a chat widget with one line of code. Every conversation lands in a single dashboard.",
  },
  {
    icon: "👥",
    title: "Contact Management",
    desc: "Full customer history — emails, tickets, invoices — visible at a glance. No inbox digging.",
  },
  {
    icon: "📊",
    title: "Activity Feed",
    desc: "Real-time log of everything in your business. Always know who did what and when.",
  },
  {
    icon: "💳",
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
    features: ["2 users", "1,000 contacts", "Inbox + Contacts", "Add-ons à la carte", "Email support"],
    cta: "Request demo",
    featured: false,
  },
  {
    tier: "Starter",
    price: "€29",
    desc: "For small teams",
    features: ["5 users", "5,000 contacts", "Inbox + Contacts", "Add-ons à la carte", "Email support"],
    cta: "Request demo",
    featured: false,
  },
  {
    tier: "Growth",
    price: "€69",
    desc: "For growing businesses",
    features: ["15 users", "25,000 contacts", "Inbox + Contacts", "Add-ons à la carte", "Priority support"],
    cta: "Request demo",
    featured: true,
  },
  {
    tier: "Pro",
    price: "€99",
    desc: "For established companies — everything included",
    features: ["Unlimited users", "Unlimited contacts", "All modules included", "Dedicated support"],
    cta: "Request demo",
    featured: false,
  },
];

const inboxItems = [
  { sender: "Acme BV", subject: "Invoice INV-0421 question", dot: "", badge: "review" },
  { sender: "TechCorp", subject: "Login issue — account locked", dot: "amber", badge: "review" },
  { sender: "Nordex", subject: "Pricing plan upgrade", dot: "green", badge: "done" },
  { sender: "Bloom Agency", subject: "Onboarding call request", dot: "", badge: "review" },
];

export default function HomePage() {
  return (
    <>
      {/* Nav */}
      <nav className={styles.nav}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.svg" alt="Yippie" className={styles.navLogo} />
        <ul className={styles.navLinks}>
          <li><a href="/features">Features</a></li>
          <li><a href="#how-it-works">How it works</a></li>
          <li><a href="/blog">Blog</a></li>
          <li><a href="/pricing">Pricing</a></li>
          <li><a href={APP_URL} className={styles.navLogin}>Log in</a></li>
          <li>
            <a href={DEMO_URL} className={styles.navCta}>Request demo →</a>
          </li>
        </ul>
      </nav>

      {/* Hero */}
      <section className={styles.hero}>
        <div>
          <div className={styles.heroTag}>
            <span className={styles.heroTagDot} />
            Customer service platform for SMBs
          </div>
          <h1 className={styles.heroTitle}>
            Take back the time<br />that matters.
          </h1>
          <p className={styles.heroSub}>
            Stop losing hours to repetitive support tickets. Yippie automates and reduces your customer service so you can focus on building your business.
          </p>
          <div className={styles.heroActions}>
            <a href={DEMO_URL} className={styles.btnPrimary}>Request demo →</a>
            <a href="#how-it-works" className={styles.btnGhost}>See how it works</a>
          </div>
        </div>

        {/* App mockup */}
        <div className={styles.mockup}>
          <div className={styles.mockupSidebar}>
            {[true, false, false, false, false, false].map((active, i) => (
              <div key={i} className={`${styles.mockupNavItem} ${active ? styles.active : ""}`}>
                <div className={`${styles.mockupNavDot} ${active ? styles.blue : ""}`} />
              </div>
            ))}
          </div>
          <div className={styles.mockupMain}>
            <div className={styles.mockupTopBar}>
              <span className={styles.mockupTopLabel}>Inbox</span>
              <div className={styles.mockupAvatar} />
            </div>
            <div className={styles.mockupStats}>
              <div className={styles.mockupStat}>
                <div className={styles.mockupStatLabel}>Open tickets</div>
                <div className={`${styles.mockupStatValue} ${styles.blue}`}>12</div>
              </div>
              <div className={styles.mockupStat}>
                <div className={styles.mockupStatLabel}>Pending</div>
                <div className={`${styles.mockupStatValue} ${styles.amber}`}>4</div>
              </div>
              <div className={styles.mockupStat}>
                <div className={styles.mockupStatLabel}>Resolved</div>
                <div className={`${styles.mockupStatValue} ${styles.green}`}>31</div>
              </div>
            </div>
            <div className={styles.mockupList}>
              <div className={styles.mockupListHeader}>Recent messages</div>
              {inboxItems.map((item) => (
                <div key={item.sender} className={styles.mockupItem}>
                  <div className={`${styles.mockupItemDot} ${item.dot === "amber" ? styles.amber : item.dot === "green" ? styles.green : ""}`} />
                  <div className={styles.mockupItemText}>
                    <div className={styles.mockupItemSender}>{item.sender}</div>
                    <div className={styles.mockupItemSubject}>{item.subject}</div>
                  </div>
                  <span className={`${styles.mockupBadge} ${item.badge === "done" ? styles.done : styles.review}`}>
                    {item.badge}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Stats */}
      <div className={styles.statsBar}>
        {[
          { value: "10h+", label: "saved per week on average" },
          { value: "< 2min", label: "average ticket response time" },
          { value: "6", label: "modules, one platform" },
        ].map((s) => (
          <div key={s.label} className={styles.stat}>
            <div className={styles.statValue}>{s.value}</div>
            <div className={styles.statLabel}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Hour counter — live global hours saved */}
      <HourCounter statsUrl={APP_URL} />

      {/* Features */}
      <section id="features" className={styles.section}>
        <p className={styles.eyebrow}>Features</p>
        <h2 className={styles.sectionTitle}>Everything your support team needs</h2>
        <p className={styles.sectionSub}>
          One platform for inbox, tickets, live chat, contacts, billing, and activity. Stop juggling tools.
        </p>
        <div className={styles.featuresGrid}>
          {features.map((f) => (
            <div key={f.title} className={styles.featureCard}>
              <div className={styles.featureIconWrap}>{f.icon}</div>
              <h3 className={styles.featureTitle}>{f.title}</h3>
              <p className={styles.featureDesc}>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className={styles.sectionLight}>
        <p className={styles.eyebrow}>How it works</p>
        <h2 className={styles.sectionTitle}>From email to resolved — in seconds</h2>
        <p className={styles.sectionSub}>
          Yippie&apos;s AI reads every incoming message and does the write-up for you.
        </p>
        <div className={styles.steps}>
          {steps.map((s) => (
            <div key={s.n} className={styles.step}>
              <div className={styles.stepCircle}>{s.n}</div>
              <h3 className={styles.stepTitle}>{s.title}</h3>
              <p className={styles.stepDesc}>{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ROI Calculator */}
      <ROICalculator appUrl={DEMO_URL} />

      {/* Pricing */}
      <section id="pricing" className={styles.section}>
        <p className={styles.eyebrow}>Pricing</p>
        <h2 className={styles.sectionTitle}>Simple, honest pricing</h2>
        <p className={styles.sectionSub}>
          No hidden fees. Cancel anytime. Start free and upgrade when you grow.
        </p>
        <div className={styles.pricingGrid}>
          {plans.map((plan) => (
            <div key={plan.tier} className={`${styles.pricingCard} ${plan.featured ? styles.featured : ""}`}>
              {plan.featured && <span className={styles.popularBadge}>Most popular</span>}
              <p className={styles.planTier}>{plan.tier}</p>
              <p className={styles.planPrice}>{plan.price}<sub>/mo</sub></p>
              <p className={styles.planDesc}>{plan.desc}</p>
              <ul className={styles.planFeatures}>
                {plan.features.map((f) => (
                  <li key={f}>
                    <span className={styles.planCheck}>✓</span>
                    {f}
                  </li>
                ))}
              </ul>
              <a href={DEMO_URL} className={`${styles.planBtn} ${plan.featured ? styles.featuredBtn : ""}`}>
                {plan.cta}
              </a>
            </div>
          ))}
        </div>
      </section>

      {/* Dark CTA */}
      <section className={styles.ctaSection}>
        <h2 className={styles.ctaTitle}>Ready to win back your time?</h2>
        <p className={styles.ctaSub}>
          Join businesses that handle customer support in half the time with Yippie. No credit card required.
        </p>
        <a href={DEMO_URL} className={styles.btnPrimary}>Request demo →</a>
      </section>

      {/* Footer */}
      <footer className={styles.footer}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.svg" alt="Yippie" className={styles.footerLogo} />
        <div className={styles.footerRight}>
          <a href="/features" className={styles.footerLink}>Features</a>
          <a href="/blog" className={styles.footerLink}>Blog</a>
          <a href="/pricing" className={styles.footerLink}>Pricing</a>
          <a href={APP_URL} className={styles.footerLink}>Log in</a>
          <span className={styles.footerCopy}>© {new Date().getFullYear()} Yippie</span>
        </div>
      </footer>
    </>
  );
}
