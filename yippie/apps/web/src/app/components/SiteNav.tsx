import styles from "./SiteChrome.module.css";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.getyippie.com";
const DEMO_URL = process.env.NEXT_PUBLIC_DEMO_URL ?? APP_URL;

export default function SiteNav() {
  return (
    <nav className={styles.nav}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <a href="/">
        <img src="/logo-black-bg.svg" alt="Yippie" className={styles.navLogo} />
      </a>
      <ul className={styles.navLinks}>
        <li><a href="/features">Features</a></li>
        <li><a href="/blog">Blog</a></li>
        <li><a href="/pricing">Pricing</a></li>
        <li><a href={APP_URL} className={styles.navLogin}>Log in</a></li>
        <li>
          <a href={DEMO_URL} className={styles.navCta}>Request demo →</a>
        </li>
      </ul>
    </nav>
  );
}
