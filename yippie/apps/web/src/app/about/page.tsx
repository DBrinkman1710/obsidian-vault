import type { Metadata } from "next";
import SiteNav from "../components/SiteNav";
import SiteFooter from "../components/SiteFooter";
import Reveal from "../components/Reveal";
import styles from "../components/content.module.css";
import aboutStyles from "./about.module.css";
import { BoltIcon, LayersIcon, UsersIcon, InboxIcon, CalendarIcon, TeamIcon, ArrowRightIcon } from "../components/icons";

const DEMO_URL = process.env.NEXT_PUBLIC_DEMO_URL ?? "/request-demo";

const JOURNEY = [
  {
    Icon: InboxIcon,
    company: "Bol.com",
    role: "High-volume consumer support",
    desc: "Managing thousands of customer queries daily — the shared mailbox was always one message away from chaos.",
  },
  {
    Icon: CalendarIcon,
    company: "HeatTransformers",
    role: "Heat-pump installation planning",
    desc: "Complex scheduling across field teams and customers. Coordination that should have taken minutes took hours.",
  },
  {
    Icon: TeamIcon,
    company: "Medspace",
    role: "Hospital department scheduling software",
    desc: "Critical support where nothing could slip. Enterprise tools slowed everyone down instead of speeding things up.",
  },
];

const PHILOSOPHY = [
  {
    Icon: BoltIcon,
    title: "Easy to learn",
    desc: "Zero training required. Your team can get started in under five minutes — no onboarding sessions, no documentation rabbit holes.",
  },
  {
    Icon: LayersIcon,
    title: "Pay for what you use",
    desc: "No bloated enterprise pricing. Add modules à la carte, only when your team actually needs them.",
  },
  {
    Icon: UsersIcon,
    title: "Grows with your business",
    desc: "Unlimited contacts on every plan. Unlock complexity only when your team needs it — not before.",
  },
];

export const metadata: Metadata = {
  title: "About — Yippie customer service platform for SMBs",
  description:
    "Why I built Yippie: years on the customer service frontlines, tired of shared-inbox chaos and enterprise bloat. Minimalist support software for SMBs.",
  alternates: { canonical: "/about" },
  openGraph: {
    title: "About — Yippie customer service platform for SMBs",
    description:
      "Why I built Yippie — customer support made easy for small and medium businesses.",
    url: "https://getyippie.com/about",
    type: "website",
  },
};

export default function AboutPage() {
  return (
    <div className={styles.page}>
      <SiteNav />

      {/* Hero */}
      <section className={styles.hero}>
        <Reveal>
          <p className={styles.eyebrow}>About</p>
          <h1 className={styles.heroTitle}>
            I&rsquo;m an engineer who got tired<br />of watching support break.
          </h1>
          <p className={styles.heroSub}>
            I&rsquo;m Diederik — an industrial engineer with a slightly obsessive habit of
            optimising things. Yippie is the tool I always wished existed.
          </p>
          <div className={aboutStyles.founderPill}>
            <span className={aboutStyles.founderAvatar}>DB</span>
            <span className={aboutStyles.founderName}>
              <strong>Diederik Brinkman</strong> · Founder
            </span>
          </div>
        </Reveal>
      </section>

      {/* Story */}
      <section className={styles.sectionLight}>
        <div className={aboutStyles.storyWrap}>
          <Reveal>
            <p className={aboutStyles.storyBody}>
              For years I worked the frontlines of customer service and planning — high-volume
              consumer support at <strong>Bol.com</strong>, complex installation scheduling at{" "}
              <strong>HeatTransformers</strong>, and critical software support for hospital
              departments at <strong>Medspace</strong>.
            </p>
            <p className={aboutStyles.storyBody}>
              Different industries, same two extremes — every single time:
            </p>
          </Reveal>
          <Reveal delay={60}>
            <div className={styles.gridTwo}>
              <div className={styles.card}>
                <span className={aboutStyles.extremeNum}>01</span>
                <h3 className={styles.cardTitle}>Shared mailbox chaos</h3>
                <p className={styles.cardDesc}>
                  Teams drowning in a shared Outlook or WhatsApp inbox — nobody sure who was
                  picking up which thread, things slipping through daily.
                </p>
              </div>
              <div className={styles.card}>
                <span className={aboutStyles.extremeNum}>02</span>
                <h3 className={styles.cardTitle}>Enterprise bloat</h3>
                <p className={styles.cardDesc}>
                  Over-engineered platforms like Zoho and Atlassian: heavy, hyper-complex, and
                  packed with features 90% of small businesses will never touch.
                </p>
              </div>
            </div>
          </Reveal>
          <Reveal delay={100}>
            <p className={aboutStyles.thesis}>
              I knew it could be better. As an engineer, I knew{" "}
              <span className={aboutStyles.thesisAccent}>I</span> could build better.
              So I did — I built Yippie.
            </p>
          </Reveal>
        </div>
      </section>

      {/* Journey */}
      <section className={styles.section}>
        <Reveal className={aboutStyles.sectionCenter}>
          <p className={styles.eyebrow}>The frontlines</p>
          <h2 className={styles.sectionTitle}>Where this came from</h2>
        </Reveal>
        <div className={`${styles.grid} ${aboutStyles.journeyGrid}`}>
          {JOURNEY.map((j, i) => (
            <Reveal key={j.company} delay={i * 80}>
              <div className={styles.card}>
                <div className={styles.iconWrap}>
                  <j.Icon size={22} />
                </div>
                <h3 className={styles.cardTitle}>{j.company}</h3>
                <p className={aboutStyles.journeyRole}>{j.role}</p>
                <p className={styles.cardDesc}>{j.desc}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Philosophy */}
      <section className={styles.sectionLight}>
        <Reveal className={aboutStyles.sectionCenter}>
          <p className={styles.eyebrow}>The philosophy</p>
          <h2 className={styles.sectionTitle}>Customer support, made easy.</h2>
          <p className={styles.sectionSub}>
            One simple promise: take back your time. I strip away the admin clutter so you
            can focus on what matters — your customers.
          </p>
        </Reveal>
        <div className={`${styles.grid} ${aboutStyles.philosophyGrid}`}>
          {PHILOSOPHY.map((v, i) => (
            <Reveal key={v.title} delay={i * 80}>
              <div className={styles.card}>
                <div className={styles.iconWrap}>
                  <v.Icon size={22} />
                </div>
                <h3 className={styles.cardTitle}>{v.title}</h3>
                <p className={styles.cardDesc}>{v.desc}</p>
              </div>
            </Reveal>
          ))}
        </div>
        <Reveal>
          <p className={aboutStyles.tagline}>No bloat. No missed threads. Just fast, minimalist support.</p>
        </Reveal>
      </section>

      {/* CTA */}
      <section className={styles.ctaSection}>
        <Reveal>
          <h2 className={styles.ctaTitle}>Want to see what I built?</h2>
          <p className={styles.ctaSub}>
            Request a demo and I&rsquo;ll walk you through Yippie myself — in under twenty minutes.
          </p>
          <a href={DEMO_URL} className={styles.btnPrimary}>
            Request demo <ArrowRightIcon size={17} />
          </a>
        </Reveal>
      </section>

      <SiteFooter />
    </div>
  );
}
