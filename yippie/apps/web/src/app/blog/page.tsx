import type { Metadata } from "next";
import SiteNav from "../components/SiteNav";
import SiteFooter from "../components/SiteFooter";
import styles from "../components/content.module.css";

export const metadata: Metadata = {
  title: "Yippie Blog | Klantenservice software tips voor het MKB",
  description:
    "Praktische gidsen over AI klantenservice, helpdesk software, reactietijden en gedeelde inbox workflows voor kleine ondernemingen en bureaus.",
  alternates: { canonical: "/blog" },
  openGraph: {
    title: "Yippie Blog | Klantenservice software tips voor het MKB",
    description:
      "Praktische gidsen over AI klantenservice, helpdesk software en snellere reactietijden voor het MKB.",
    url: "https://getyippie.com/blog",
    type: "website",
  },
};

const posts = [
  {
    slug: "two_extremes_customer_support_smb",
    title: "De twee extremen van klantenservice, en waarom het MKB er tussenin zit",
    date: "2026-07-10",
    dateLabel: "10 juli 2026",
    excerpt:
      "De meeste klantenservice software is gebouwd voor chaos of enterprise. Kleine ondernemingen vallen in geen van beide kampen. Dit is hoe het juiste midden eruitziet, en waarom het zo zelden gebouwd wordt.",
  },
  {
    slug: "klantenservice_software_voor_mkb",
    title: "De twee extremen van klantenservice, en waarom het MKB er tussenin zit",
    date: "2026-07-10",
    dateLabel: "10 juli 2026",
    excerpt:
      "De meeste klantenservice software is gebouwd voor een gedeelde inbox of een enterprise-team. MKB zit er tussenin. Dit is wat de juiste maat er in de praktijk uitziet.",
  },
  {
    slug: "whatsapp_customer_service_for_small_business",
    title: "Waarom kleine ondernemingen klantenservice verplaatsen naar WhatsApp",
    date: "2026-07-03",
    dateLabel: "3 juli 2026",
    excerpt:
      "WhatsApp heeft 2 miljard gebruikers en berichtopenpercentages boven de 90 procent. Dit is waarom kleine ondernemingen het als supportkanaal toevoegen, en hoe je het goed inricht.",
  },
  {
    slug: "cost_of_slow_customer_service_response",
    title: "Wat een trage klantenservice reactie je echt kost",
    date: "2026-06-26",
    dateLabel: "26 juni 2026",
    excerpt:
      "Trage support is niet alleen frustrerend: het kost omzet, leidt tot negatieve reviews en creëert meer werk intern. Dit is wat de cijfers zeggen.",
  },
  {
    slug: "shared_inbox_vs_regular_email",
    title: "Gedeelde inbox vs. gewone e-mail: wanneer maak je de overstap?",
    date: "2026-06-19",
    dateLabel: "19 juni 2026",
    excerpt:
      "Regel je support nog vanuit een gewone inbox? Zo weet je wanneer gedeelde inbox software loont, en wat je er echt mee wint als je de overstap maakt.",
  },
  {
    slug: "5-ways-ai-saves-smb-customer-service-time",
    title: "5 manieren waarop AI het MKB 10+ uur per week bespaart op klantenservice",
    date: "2026-06-12",
    dateLabel: "12 juni 2026",
    excerpt:
      "Van inbox triage tot het opstellen van reacties: AI klantenservice voor kleine ondernemingen geeft eigenaren stilletjes hun week terug. Vijf concrete manieren waarop het oploopt.",
  },
  {
    slug: "how-to-reduce-customer-service-response-time",
    title: "Hoe je je klantenservice reactietijd halveert",
    date: "2026-06-05",
    dateLabel: "5 juni 2026",
    excerpt:
      "Reactietijd verkorten zonder extra personeel? Deze vijf tactieken doen het zware werk: templates, SLA's, inbox triage en nette overdrachten.",
  },
];

export default function BlogIndexPage() {
  return (
    <div className={styles.page}>
      <SiteNav />

      <section className={styles.hero}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo-white-bg-mark.svg" alt="" aria-hidden="true" className={styles.pageLogoMark} />
        <div className={styles.heroTag}>
          <span className={styles.heroTagDot} />
          Yippie blog
        </div>
        <h1 className={styles.heroTitle}>Klantenservice, slimmer gemaakt</h1>
        <p className={styles.heroSub}>
          Praktische gidsen over AI klantenservice, helpdesk software en snellere
          reactietijden, geschreven voor kleine ondernemingen en de bureaus die
          ze ondersteunen.
        </p>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionInner}>
          <div className={styles.blogGrid}>
            {posts.map((post) => (
              <a key={post.slug} href={`/blog/${post.slug}`} className={styles.blogCard}>
                <div className={styles.blogDate}>{post.dateLabel}</div>
                <h2 className={styles.blogTitle}>{post.title}</h2>
                <p className={styles.blogExcerpt}>{post.excerpt}</p>
                <span className={styles.blogReadMore}>Lees meer →</span>
              </a>
            ))}
          </div>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
