import type { Metadata } from "next";
import SiteNav from "../components/SiteNav";
import SiteFooter from "../components/SiteFooter";
import styles from "../components/content.module.css";
import formStyles from "./request-demo.module.css";
import DemoForm from "./DemoForm";

export const metadata: Metadata = {
  title: "Vraag een demo aan | Yippie",
  description:
    "Zie Yippie in actie. Krijg direct toegang tot je eigen demoruimte en zie hoe AI een rommelige support-inbox in seconden omzet in opgeloste tickets.",
  alternates: { canonical: "/request-demo" },
  openGraph: {
    title: "Vraag een demo aan | Yippie",
    description:
      "Zie Yippie in actie. Krijg direct toegang tot je eigen demoruimte en zie hoe AI een rommelige support-inbox in seconden omzet in opgeloste tickets.",
    url: "https://getyippie.com/request-demo",
    type: "website",
    images: ["/og.png"],
  },
};

export default function RequestDemoPage() {
  return (
    <div className={styles.page}>
      <SiteNav />

      <section className={styles.hero}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo-white-bg-mark.svg" alt="" aria-hidden="true" className={styles.pageLogoMark} />
        <div className={styles.heroTag}>
          <span className={styles.heroTagDot} />
          Vraag een demo aan
        </div>
        <h1 className={styles.heroTitle}>Zie Yippie in je eigen inbox</h1>
        <p className={styles.heroSub}>
          Vul het formulier in en krijg direct toegang tot je eigen demoruimte,
          vooraf geladen met realistische data. Geen verkoopdruk, alleen een
          eerlijke blik op hoe Yippie je team wekelijks uren bespaart.
        </p>
      </section>

      <div className={formStyles.wrap}>
        <DemoForm />
      </div>

      <SiteFooter />
    </div>
  );
}
