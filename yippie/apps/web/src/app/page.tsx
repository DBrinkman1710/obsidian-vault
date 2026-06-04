import styles from "./page.module.css";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.getyippie.com";

const features = [
  {
    icon: "📬",
    title: "Smart Inbox",
    desc: "Emails and WhatsApp messages are automatically scanned and turned into draft tickets. Review and approve in one click — no manual write-up needed.",
  },
  {
    icon: "🎫",
    title: "Ticket Management",
    desc: "Track, assign, and close support requests in one place. SLA alerts make sure nothing falls through the cracks.",
  },
  {
    icon: "💬",
    title: "Live Chat",
    desc: "Add a chat widget to your website with one line of code. All conversations land in a single dashboard.",
  },
  {
    icon: "👥",
    title: "Contact Management",
    desc: "See every customer's full history at a glance — emails, tickets, invoices. No more digging through inboxes.",
  },
  {
    icon: "📊",
    title: "Activity Feed",
    desc: "A real-time log of everything happening in your business. Always know who did what and when.",
  },
  {
    icon: "💳",
    title: "Billing",
    desc: "Send and track invoices without leaving the platform. Keep your financials and your support in sync.",
  },
];

const steps = [
  {
    number: "01",
    title: "Customer sends a message",
    desc: "An email or WhatsApp message lands in your Yippie inbox automatically.",
  },
  {
    number: "02",
    title: "AI drafts the ticket",
    desc: "Yippie reads the message and suggests a subject, priority, and description.",
  },
  {
    number: "03",
    title: "You approve in one click",
    desc: "Edit if you want, then approve — it becomes a real ticket instantly.",
  },
];

const plans = [
  {
    name: "Starter",
    price: "€29",
    desc: "Perfect for solo founders getting started",
    features: ["1 user", "500 contacts", "Inbox + Tickets", "Live chat widget", "Email support"],
    cta: "Get started",
    featured: false,
  },
  {
    name: "Growth",
    price: "€79",
    desc: "For growing teams handling more volume",
    features: ["5 users", "5,000 contacts", "All modules", "Activity feed", "Priority support"],
    cta: "Get started",
    featured: true,
  },
  {
    name: "Pro",
    price: "€199",
    desc: "For established businesses at scale",
    features: ["Unlimited users", "Unlimited contacts", "All modules", "API access", "Dedicated support"],
    cta: "Contact us",
    featured: false,
  },
];

const companies = ["Acme BV", "Bloom Agency", "Vantage Group", "Nordex", "Creato Studio"];

export default function HomePage() {
  return (
    <>
      {/* Nav */}
      <nav className={styles.nav}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.svg" alt="Yippie" className={styles.navLogo} />
        <ul className={styles.navLinks}>
          <li><a href="#features">Features</a></li>
          <li><a href="#how-it-works">How it works</a></li>
          <li><a href="#pricing">Pricing</a></li>
          <li><a href={APP_URL} className={styles.navLogin}>Log in →</a></li>
        </ul>
      </nav>

      {/* Hero */}
      <section className={styles.hero}>
        <div>
          <span className={styles.heroTag}>Customer support tool for SMBs</span>
          <h1 className={styles.heroTitle}>
            Give yourself back the time that <span>matters most</span>
          </h1>
          <p className={styles.heroSub}>
            Yippie handles your inbox, tickets, and live chat automatically — so you can focus on running your business, not answering the same emails.
          </p>
          <div className={styles.heroActions}>
            <a href={APP_URL} className={styles.btnPrimary}>Start for free →</a>
            <a href="#how-it-works" className={styles.btnSecondary}>See how it works</a>
          </div>
        </div>

        {/* App mockup */}
        <div className={styles.mockup}>
          <div className={styles.mockupSidebar}>
            {[...Array(6)].map((_, i) => (
              <div key={i} className={styles.mockupDot} />
            ))}
          </div>
          <div className={styles.mockupMain}>
            <div className={styles.mockupHeader}>Dashboard</div>
            <div className={styles.mockupCards}>
              <div className={styles.mockupCard}>
                <div className={styles.mockupCardLabel}>Open tickets</div>
                <div className={`${styles.mockupCardValue} ${styles.blue}`}>12</div>
              </div>
              <div className={styles.mockupCard}>
                <div className={styles.mockupCardLabel}>Pending inbox</div>
                <div className={`${styles.mockupCardValue} ${styles.amber}`}>4</div>
              </div>
              <div className={styles.mockupCard}>
                <div className={styles.mockupCardLabel}>Contacts</div>
                <div className={styles.mockupCardValue}>248</div>
              </div>
              <div className={styles.mockupCard}>
                <div className={styles.mockupCardLabel}>Active chats</div>
                <div className={`${styles.mockupCardValue} ${styles.green}`}>3</div>
              </div>
            </div>
            {["New email from Acme BV — invoice question", "Ticket #42 escalated — SLA breach", "Jan approved draft ticket"].map((text, i) => (
              <div key={i} className={styles.mockupRow}>
                <div className={`${styles.mockupRowDot} ${i === 1 ? styles.amber : ""}`} />
                <span>{text}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Social proof */}
      <div className={styles.companies}>
        <p className={styles.companiesLabel}>Trusted by growing businesses</p>
        <div className={styles.companiesList}>
          {companies.map((name) => (
            <span key={name} className={styles.companyBadge}>{name}</span>
          ))}
        </div>
      </div>

      {/* Features */}
      <section id="features" className={styles.section}>
        <p className={styles.sectionLabel}>Features</p>
        <h2 className={styles.sectionTitle}>Everything your support team needs</h2>
        <p className={styles.sectionSub}>
          One platform for inbox, tickets, live chat, contacts, billing, and activity. No more juggling tools.
        </p>
        <div className={styles.featuresGrid}>
          {features.map((f) => (
            <div key={f.title} className={styles.featureCard}>
              <span className={styles.featureIcon}>{f.icon}</span>
              <h3 className={styles.featureTitle}>{f.title}</h3>
              <p className={styles.featureDesc}>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className={styles.sectionAlt}>
        <p className={styles.sectionLabel}>How it works</p>
        <h2 className={styles.sectionTitle}>From email to resolved — in seconds</h2>
        <p className={styles.sectionSub}>
          Yippie&apos;s AI reads every incoming message and does the write-up for you.
        </p>
        <div className={styles.steps}>
          {steps.map((s) => (
            <div key={s.number} className={styles.step}>
              <div className={styles.stepNumber}>{s.number}</div>
              <h3 className={styles.stepTitle}>{s.title}</h3>
              <p className={styles.stepDesc}>{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className={styles.section}>
        <p className={styles.sectionLabel}>Pricing</p>
        <h2 className={styles.sectionTitle}>Simple, honest pricing</h2>
        <p className={styles.sectionSub}>
          No hidden fees. Cancel anytime. Start free and upgrade when you need to.
        </p>
        <div className={styles.pricingGrid}>
          {plans.map((plan) => (
            <div key={plan.name} className={`${styles.pricingCard} ${plan.featured ? styles.featured : ""}`}>
              {plan.featured && <span className={styles.featuredBadge}>Most popular</span>}
              <p className={styles.planName}>{plan.name}</p>
              <p className={styles.planPrice}>{plan.price}<span>/mo</span></p>
              <p className={styles.planDesc}>{plan.desc}</p>
              <ul className={styles.planFeatures}>
                {plan.features.map((f) => <li key={f}>{f}</li>)}
              </ul>
              <a href={APP_URL} className={`${styles.planBtn} ${plan.featured ? styles.featuredBtn : ""}`}>
                {plan.cta}
              </a>
            </div>
          ))}
        </div>
      </section>

      {/* CTA banner */}
      <section className={styles.ctaBanner}>
        <h2 className={styles.ctaTitle}>Ready to win back your time?</h2>
        <p className={styles.ctaSub}>Join businesses that handle support in half the time with Yippie.</p>
        <a href={APP_URL} className={styles.btnPrimary}>Log in to Yippie →</a>
      </section>

      {/* Footer */}
      <footer className={styles.footer}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.svg" alt="Yippie" className={styles.footerLogo} />
        <p className={styles.footerCopy}>© {new Date().getFullYear()} Yippie. All rights reserved.</p>
      </footer>
    </>
  );
}
