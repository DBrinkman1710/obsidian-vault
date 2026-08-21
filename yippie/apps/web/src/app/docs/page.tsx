import type { Metadata } from "next";
import { Marked } from "marked";
import SiteNav from "../components/SiteNav";

// Strip raw HTML blocks so injected <script> tags in the Markdown source
// can never reach the browser, even if the GitHub repo were compromised.
const safeMarked = new Marked();
safeMarked.use({ renderer: { html: () => "" } });
import SiteFooter from "../components/SiteFooter";
import DownloadPdfButton from "./DownloadPdfButton";
import styles from "./docs.module.css";

const MANUAL_RAW_URL =
  "https://raw.githubusercontent.com/DBrinkman1710/obsidian-vault/sandbox/Yippie%20Platform%20Manual.md";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Documentatie | Yippie",
  description:
    "Compleet producthandboek voor het Yippie klantenserviceplatform.",
  alternates: { canonical: "/docs" },
  openGraph: {
    title: "Documentatie | Yippie",
    description:
      "Compleet producthandboek voor het Yippie klantenserviceplatform.",
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
    html = await safeMarked.parse(markdown);
  } catch {
    fetchError = true;
  }

  return (
    <div className={styles.page}>
      <SiteNav />

      <main className={styles.main}>
        <div className={styles.header}>
          <p className={styles.eyebrow}>// documentatie</p>
          <h1 className={styles.title}>Yippie Platformhandboek</h1>
          <p className={styles.sub}>
            Volledige referentie voor alles in het Yippie platform. Altijd
            bijgewerkt naar de laatste beschikbare versie.
          </p>
          <DownloadPdfButton />
        </div>

        <div className={styles.content}>
          {fetchError ? (
            <p className={styles.error}>
              Het handboek kon niet worden geladen. Probeer het over een moment opnieuw of{" "}
              <a href={MANUAL_RAW_URL} target="_blank" rel="noopener noreferrer">
                bekijk het direct op GitHub
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
