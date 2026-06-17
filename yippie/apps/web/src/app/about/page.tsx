import type { Metadata } from "next";
import SiteNav from "../components/SiteNav";
import SiteFooter from "../components/SiteFooter";
import Reveal from "../components/Reveal";
import styles from "../components/content.module.css";
import aboutStyles from "./about.module.css";
import {
  BoltIcon,
  LayersIcon,
  ShieldIcon,
  UsersIcon,
  ArrowRightIcon,
} from "../components/icons";

const DEMO_URL = process.env.NEXT_PUBLIC_DEMO_URL ?? "/request-demo";

export const metadata: Metadata = {
  title: "About — Yippie customer service platform for SMBs",
  description:
    "Learn who we are, why we built Yippie, and the values that drive every product decision. A lean team on a mission to give SMBs the customer service tools they deserve.",
  alternates: { canonical: "/about" },
  openGraph: {
    title: "About — Yippie customer service platform for SMBs",
    description:
      "Learn who we are, why we built Yippie, and the values that drive every product decision.",
    url: "https://getyippie.com/about",
    type: "website",
  },
};

const values = [
  {
    Icon: BoltIcon,
    title: "Speed as respect",
    desc: "Every minute a customer waits is a minute of trust eroding. We build for speed — in the product and in how we ship.",
  },
  {
    Icon: LayersIcon,
    title: "Simple on the surface",
    desc: "SMBs don't have time to learn enterprise software. We hide the complexity so teams can start handling tickets in minutes, not weeks.",
  },
  {
    Icon: ShieldIcon,
    title: "Trustworthy by default",
    desc: "Your customer data is your most valuable asset. We treat it that way — row-level tenant isolation, no data mixing, ever.",
  },
  {
    Icon: UsersIcon,
    title: "Built for real teams",
    desc: "Not startups with 50 engineers, not enterprises with IT departments. We optimise for the 3-person team running everything themselves.",
  },
];

const stats = [
  { value: "2024", label: "founded" },
  { value: "12+", label: "modules shipped" },
  { value: "10h+", label: "saved per team per week" },
  { value: "100%", label: "focused on SMBs" },
];

const team = [
  { initials: "DB", name: "Diederik B.", role: "Founder & CEO" },
  { initials: "MV", name: "Marijn V.", role: "Head of Product" },
  { initials: "SR", name: "Sara R.", role: "Lead Engineer" },
  { initials: "TK", name: "Thomas K.", role: "Customer Success" },
];

export default function AboutPage() {
  return (
    <div className={styles.page}>
      <SiteNav />

      {/* Hero */}
      <section className={styles.hero}>
        <Reveal>
          <div className={styles.heroTag}>
            <span className={styles.heroTagDot} />
            Our story
          </div>
          <h1 className={styles.heroTitle}>
            Built by people who hated juggling support tools
          </h1>
          <p className={styles.heroSub}>
            Yippie started when we got tired of watching small businesses lose
            customers to slow, disjointed support. We decided to fix it.
          </p>
        </Reveal>
      </section>

      {/* Mission */}
      <section className={styles.sectionLight}>
        <div className={aboutStyles.missionWrap}>
          <Reveal>
            <p className={styles.eyebrow}>Mission</p>
            <h2 className={styles.sectionTitle}>
              Give every SMB a support team that punches above its weight
            </h2>
          </Reveal>
          <Reveal delay={80}>
            <p className={aboutStyles.missionBody}>
              Enterprise companies have dedicated support departments, custom tooling,
              and IT teams to glue it all together. Small and medium businesses have
              three people and a shared inbox. That gap is unfair — and it shows in
              every slow reply and lost customer.
            </p>
            <p className={aboutStyles.missionBody}>
              Yippie collapses the gap. We take the AI and automation that used to
              cost a fortune to build, and package it into one affordable platform
              that a two-person team can run on day one. Inbox triage, ticket
              management, booking, pipeline, email tracking — unified, and genuinely
              simple.
            </p>
          </Reveal>
        </div>
      </section>

      {/* Values */}
      <section className={styles.section}>
        <Reveal>
          <p className={styles.eyebrow}>Values</p>
          <h2 className={styles.sectionTitle}>What drives every decision we make</h2>
          <p className={styles.sectionSub}>
            These are not aspirations on a wall. They are the filters we apply
            every time we decide what to build — and what to cut.
          </p>
        </Reveal>
        <div className={styles.grid}>
          {values.map((v, i) => (
            <Reveal key={v.title} className={styles.card} delay={(i % 3) * 70}>
              <div className={styles.iconWrap}>
                <v.Icon size={22} />
              </div>
              <h3 className={styles.cardTitle}>{v.title}</h3>
              <p className={styles.cardDesc}>{v.desc}</p>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Stats row */}
      <section className={aboutStyles.statsSection}>
        {stats.map((s, i) => (
          <Reveal key={s.label} className={aboutStyles.stat} delay={i * 80}>
            <div className={aboutStyles.statValue}>{s.value}</div>
            <div className={aboutStyles.statLabel}>{s.label}</div>
          </Reveal>
        ))}
      </section>

      {/* Team */}
      <section className={styles.sectionLight}>
        <Reveal>
          <p className={styles.eyebrow}>Team</p>
          <h2 className={styles.sectionTitle}>The people behind Yippie</h2>
          <p className={styles.sectionSub}>
            A small, focused team. We use Yippie ourselves every day — which
            keeps us honest about what matters.
          </p>
        </Reveal>
        <div className={aboutStyles.teamGrid}>
          {team.map((member, i) => (
            <Reveal key={member.name} className={aboutStyles.teamCard} delay={i * 70}>
              <div className={aboutStyles.teamAvatar}>
                <span className={aboutStyles.teamInitials}>{member.initials}</span>
              </div>
              <p className={aboutStyles.teamName}>{member.name}</p>
              <p className={aboutStyles.teamRole}>{member.role}</p>
            </Reveal>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className={styles.ctaSection}>
        <Reveal>
          <h2 className={styles.ctaTitle}>Want to see what we built?</h2>
          <p className={styles.ctaSub}>
            Book a demo and we will walk you through the whole platform in
            under twenty minutes.
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
