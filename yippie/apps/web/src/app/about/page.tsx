import type { Metadata } from "next";
import SiteNav from "../components/SiteNav";
import SiteFooter from "../components/SiteFooter";
import Reveal from "../components/Reveal";
import styles from "../components/content.module.css";
import aboutStyles from "./about.module.css";
import { ArrowRightIcon } from "../components/icons";

const DEMO_URL = process.env.NEXT_PUBLIC_DEMO_URL ?? "/request-demo";

/** Populate with real client names (and optional logo paths) when ready. */
const clients: { name: string; logoSrc?: string }[] = [];

export const metadata: Metadata = {
  title: "About — Yippie customer service platform for SMBs",
  description:
    "Why we built Yippie: years on the customer service frontlines, tired of shared-inbox chaos and enterprise bloat. Minimalist support software for SMBs.",
  alternates: { canonical: "/about" },
  openGraph: {
    title: "About — Yippie customer service platform for SMBs",
    description:
      "Why we built Yippie — customer support made easy for small and medium businesses.",
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
          <a href="/" className={aboutStyles.homeLink}>
            ← Home
          </a>
          <div className={aboutStyles.heroLogoWrap}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/logo-white-bg-mark.svg"
              alt=""
              className={aboutStyles.heroLogo}
              aria-hidden
            />
          </div>
          <h1 className={styles.heroTitle}>Behind Yippie</h1>
        </Reveal>
      </section>

      {/* Story */}
      <section className={styles.sectionLight}>
        <div className={aboutStyles.storyWrap}>
          <Reveal>
            <p className={aboutStyles.storyBody}>
              I spent years working on the frontlines of customer service. From managing
              high-volume consumer support at Bol.com and coordinating complex installation
              planning at HeatTransformers, to handling critical software support for
              hospital departments at Medspace.
            </p>
            <p className={aboutStyles.storyBody}>
              No matter the industry, I kept running into the exact same two extremes:
            </p>
          </Reveal>

          <Reveal delay={60}>
            <ol className={aboutStyles.extremesList}>
              <li>
                <strong>The Shared Mailbox Chaos:</strong> Teams drowning in shared Outlook
                or WhatsApp inboxes, completely losing track of who was picking up which
                thread.
              </li>
              <li>
                <strong>The Enterprise Bloat:</strong> Over-engineered platforms like Zoho
                and Atlassian. They are heavy, hyper-complex, and packed with features 90%
                of small and medium businesses will never touch.
              </li>
            </ol>
            <p className={aboutStyles.storyBody}>
              I knew things could be better. I decided I could do better. So, I built Yippie.
            </p>
          </Reveal>
        </div>
      </section>

      {/* Philosophy */}
      <section className={styles.section}>
        <div className={aboutStyles.philosophyWrap}>
          <Reveal>
            <h2 className={styles.sectionTitle}>Customer Support, Made Easy.</h2>
            <p className={aboutStyles.storyBody}>
              Yippie is built on a simple philosophy:{" "}
              <strong>Take back your time.</strong> We strip away the administrative clutter
              so you can focus on what actually matters—helping your customers.
            </p>
          </Reveal>
          <Reveal delay={80}>
            <ul className={aboutStyles.bulletList}>
              <li>
                <strong>Easy to Learn:</strong> Zero training required. Your team can get
                started in under five minutes.
              </li>
              <li>
                <strong>Pay What You Use:</strong> No bloated enterprise software pricing.
              </li>
              <li>
                <strong>Grow with Your Business:</strong> Unlock modular features only when
                your team and complexity actually need them.
              </li>
            </ul>
            <p className={aboutStyles.tagline}>No bloat. No missed threads. Just fast, minimalist support.</p>
          </Reveal>
        </div>
      </section>

      {/* Client logos — shell for future real customers */}
      {clients.length > 0 && (
        <section className={aboutStyles.clientsSection}>
          <Reveal>
            <p className={styles.eyebrow}>Trusted by</p>
            <div className={aboutStyles.clientsRow}>
              {clients.map((client) =>
                client.logoSrc ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={client.name}
                    src={client.logoSrc}
                    alt={client.name}
                    className={aboutStyles.clientLogo}
                  />
                ) : (
                  <span key={client.name} className={aboutStyles.clientName}>
                    {client.name}
                  </span>
                )
              )}
            </div>
          </Reveal>
        </section>
      )}

      {/* CTA */}
      <section className={styles.ctaSection}>
        <Reveal>
          <h2 className={styles.ctaTitle}>Want to see what we built?</h2>
          <p className={styles.ctaSub}>
            Request a demo and we&apos;ll walk you through the platform in under twenty minutes.
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
