import styles from "./SiteChrome.module.css";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.getyippie.com";

export default function SiteFooter() {
  return (
    <footer className={styles.footer}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <a href="/">
        <img src="/logo.svg" alt="Yippie" className={styles.footerLogo} />
      </a>
      <div className={styles.footerRight}>
        <a href="/features" className={styles.footerLink}>Features</a>
        <a href="/blog" className={styles.footerLink}>Blog</a>
        <a href="/pricing" className={styles.footerLink}>Pricing</a>
        <a href={APP_URL} className={styles.footerLink}>Log in</a>
        <span className={styles.footerCopy}>© {new Date().getFullYear()} Yippie</span>
      </div>
    </footer>
  );
}
