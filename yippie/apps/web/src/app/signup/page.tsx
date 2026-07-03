import type { Metadata } from "next";
import { Suspense } from "react";
import SiteNav from "../components/SiteNav";
import SiteFooter from "../components/SiteFooter";
import styles from "../components/content.module.css";
import formStyles from "../request-demo/request-demo.module.css";
import SignupForm from "./SignupForm";

export const metadata: Metadata = {
  title: "Start your account | Yippie",
  description:
    "Set up your Yippie workspace in minutes. AI-powered customer service for your team.",
  alternates: { canonical: "/signup" },
  openGraph: {
    title: "Start your account | Yippie",
    description: "Set up your Yippie workspace in minutes.",
    url: "https://getyippie.com/signup",
    type: "website",
  },
};

export default function SignupPage() {
  return (
    <div className={styles.page}>
      <SiteNav />

      <section className={styles.hero}>
        <div className={styles.heroTag}>
          <span className={styles.heroTagDot} />
          Get started
        </div>
        <h1 className={styles.heroTitle}>Start your Yippie account</h1>
        <p className={styles.heroSub}>
          Your workspace is ready in minutes. Answer a few questions and
          we&apos;ll recommend the right setup for your team.
        </p>
      </section>

      <div className={formStyles.wrap}>
        <Suspense>
          <SignupForm />
        </Suspense>
      </div>

      <SiteFooter />
    </div>
  );
}
