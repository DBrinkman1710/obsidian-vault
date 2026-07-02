import type { Metadata } from "next";
import { marked } from "marked";
import SiteNav from "../components/SiteNav";
import SiteFooter from "../components/SiteFooter";
import styles from "./docs.module.css";

const MANUAL_RAW_URL =
  "https://raw.githubusercontent.com/DBrinkman1710/obsidian-vault/sandbox/Yippie%20Platform%20Manual.md";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Documentation — Yippie",
  description:
    "Complete product manual for the Yippie customer service platform.",
  alternates: { canonical: "/docs" },
  openGraph: {
    title: "Documentation — Yippie",
    description:
      "Complete product manual for the Yippie customer service platform.",
    url: "https://getyippie.com/docs",
    type: "website",
  },
};

async function fetchManual(): Promise<string> {
  const res = await fetch(MANUAL_RAW_URL, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to fetch manual: ${res.status}`);
  return res.text();
}

export default async function DocsPage() {
  let html = "";
  let fetchError = false;

  try {
    const markdown = await fetchManual();
    html = await marked(markdown);
  } catch {
    fetchError = true;
  }

  return (
    <div className={styles.page}>
      <SiteNav />

      <main className={styles.main}>
        <div className={styles.header}>
          <p className={styles.eyebrow}>// documentation</p>
          <h1 className={styles.title}>Yippie Platform Manual</h1>
          <p className={styles.sub}>
            Complete reference for everything in the Yippie platform. Always
            reflects the latest shipped version.
          </p>
          <a
            href={MANUAL_RAW_URL}
            download="Yippie Platform Manual.md"
            className={styles.downloadBtn}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            Download manual
          </a>
        </div>

        <div className={styles.content}>
          {fetchError ? (
            <p className={styles.error}>
              Could not load the manual. Please try again in a moment or{" "}
              <a href={MANUAL_RAW_URL} target="_blank" rel="noopener noreferrer">
                view it directly on GitHub
              </a>
              .
            </p>
          ) : (
            <div
              className={styles.md}
              dangerouslySetInnerHTML={{ __html: html }}
            />
          )}
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
