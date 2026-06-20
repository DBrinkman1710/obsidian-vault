import styles from "./SiteChrome.module.css";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.getyippie.com";
const DEMO_URL = process.env.NEXT_PUBLIC_DEMO_URL ?? "/request-demo";

const columns = [
  {
    title: "Product",
    links: [
      { href: "/modules", label: "Modules" },
      { href: "/pricing", label: "Pricing" },
      { href: DEMO_URL, label: "Request demo" },
    ],
  },
  {
    title: "Use cases",
    links: [
      { href: "/for-smbs", label: "For SMBs" },
      { href: "/for-agencies", label: "For agencies" },
      { href: "/vs-zendesk", label: "Yippie vs Zendesk" },
    ],
  },
  {
    title: "Company",
    links: [
      { href: "/about", label: "About" },
      { href: "/blog", label: "Blog" },
      { href: "/privacy", label: "Privacy" },
      { href: APP_URL, label: "Log in" },
    ],
  },
];

export default function SiteFooter() {
  return (
    <footer className={styles.footer}>
      <div className={styles.footerInner}>
        <div className={styles.footerBrand}>
          <a href="/" aria-label="Yippie home">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo-black-bg.svg" alt="Yippie" className={styles.footerLogo} />
          </a>
          <p className={styles.footerTagline}>
            Your growth partner in customer service. Built to scale with you.
          </p>
        </div>

        <div className={styles.footerCols}>
          {columns.map((col) => (
            <div key={col.title} className={styles.footerCol}>
              <p className={styles.footerColTitle}>{col.title}</p>
              <ul>
                {col.links.map((l) => (
                  <li key={l.label}>
                    <a href={l.href} className={styles.footerLink}>{l.label}</a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      <div className={styles.footerBar}>
        <span className={styles.footerCopy}>© {new Date().getFullYear()} Yippie. All rights reserved.</span>
        <span className={styles.footerMade}>Built for founders who mean business.</span>
      </div>
    </footer>
  );
}
