"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import styles from "./InboxDemo.module.css";
import { getLocale } from "@/lib/i18n";

const copy = {
  nl: {
    eyebrow: "// Live demo",
    title: "Zie de AI in actie",
    sub: "Plak hieronder een klant-e-mail en kijk hoe Yippie in seconden het ticketonderwerp, de prioriteit en de omschrijving opstelt.",
    examples: [
      {
        label: "Factuurprobleem",
        text: "Hoi, ik heb afgelopen week factuur #INV-2241 ontvangen, maar het bedrag klopt niet met wat we hadden afgesproken. De factuur zegt €1.850, maar we hadden €1.650 besproken. Kun je dit nagaan en een gecorrigeerde factuur sturen? Bedankt, Maaike van Lumen Studio",
      },
      {
        label: "Inlogprobleem",
        text: "Goedemorgen, sinds gisteren kan ons hele team niet meer inloggen op het platform. De pagina blijft eindeloos laden. We hebben verschillende browsers geprobeerd en onze computers opnieuw opgestart, maar niets helpt. Dit is urgent, we hebben vanmiddag klantgesprekken. Jan bij TechCorp",
      },
      {
        label: "Abonnement upgraden",
        text: "Hallo, ik wil ons huidige abonnement upgraden naar het Growth-plan. Kun je me vertellen hoe dat gaat en of we onze bestaande data kunnen behouden? Bieden jullie ook korting voor jaarlijkse facturatie? Dank!",
      },
    ],
    inputLabel: "E-mail van klant",
    placeholder: "Plak of typ een klant-e-mail…",
    analyzing: "Analyseren…",
    analyze: "Analyseren met AI →",
    errorFallback: "Er is iets misgegaan. Probeer het opnieuw.",
    errorNetwork: "Kan de AI-dienst niet bereiken. Probeer het opnieuw.",
    draftTicket: "Conceptticket",
    approve: "✓ Goedkeuren",
    edit: "Bewerken",
    ticketNote: "Dit is een live voorbeeld. Meld je aan om je inbox te verbinden.",
    placeholderText: "Je AI-conceptticket verschijnt hier",
    loadingText: "Yippie AI leest het bericht…",
    cta: "Verbind je inbox. Gratis demo →",
  },
  en: {
    eyebrow: "// Live demo",
    title: "See the AI in action",
    sub: "Paste any customer email below and watch Yippie draft the ticket subject, priority, and description in seconds.",
    examples: [
      {
        label: "Invoice issue",
        text: "Hi, I received invoice #INV-2241 last week but the amount doesn't match what we agreed. The invoice says €1,850 but we discussed €1,650. Can you please look into this and send a corrected invoice? Thank you, Maaike from Lumen Studio",
      },
      {
        label: "Login problem",
        text: "Good morning, since yesterday our whole team can't log in to the platform. The page just keeps loading indefinitely. We've tried different browsers and restarting our computers but nothing works. This is urgent, we have customer calls this afternoon. Jan at TechCorp",
      },
      {
        label: "Plan upgrade",
        text: "Hello, I'm interested in upgrading our current subscription to the Growth plan. Could you tell me what the process is and if we can keep our existing data? Also, do you offer a discount for annual billing? Thanks!",
      },
    ],
    inputLabel: "Customer email",
    placeholder: "Paste or type a customer email…",
    analyzing: "Analyzing…",
    analyze: "Analyze with AI →",
    errorFallback: "Something went wrong. Please try again.",
    errorNetwork: "Could not reach the AI service. Please try again.",
    draftTicket: "Draft ticket",
    approve: "✓ Approve",
    edit: "Edit",
    ticketNote: "This is a live preview. Sign up to connect your inbox.",
    placeholderText: "Your AI-drafted ticket will appear here",
    loadingText: "Yippie AI is reading the message…",
    cta: "Connect your inbox. Free demo →",
  },
} as const;

const PRIORITY_COLOR: Record<string, string> = {
  urgent: styles.urgent ?? "",
  high: styles.high ?? "",
  medium: styles.medium ?? "",
  low: styles.low ?? "",
};

interface DemoResult {
  subject: string;
  description: string;
  priority: string;
  category: string | null;
}

export default function InboxDemo({ demoUrl }: { demoUrl: string }) {
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<DemoResult | null>(null);
  const [error, setError] = useState("");
  const pathname = usePathname();
  const locale = getLocale(pathname);
  const t = copy[locale];

  async function runDemo() {
    if (!message.trim()) return;
    setLoading(true);
    setResult(null);
    setError("");
    try {
      const res = await fetch("/api/ai-demo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ raw_message: message }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? t.errorFallback);
      } else {
        setResult(data);
      }
    } catch {
      setError(t.errorNetwork);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className={styles.section}>
      <div className={styles.head}>
        <p className={styles.eyebrow}>{t.eyebrow}</p>
        <h2 className={styles.title}>{t.title}</h2>
        <p className={styles.sub}>{t.sub}</p>
      </div>

      <div className={styles.demo}>
        <div className={styles.inputCol}>
          <div className={styles.examples}>
            {t.examples.map((ex) => (
              <button
                key={ex.label}
                type="button"
                className={`${styles.exBtn} ${message === ex.text ? styles.exBtnActive : ""}`}
                onClick={() => { setMessage(ex.text); setResult(null); setError(""); }}
              >
                {ex.label}
              </button>
            ))}
          </div>
          <div className={styles.inputWrap}>
            <div className={styles.inputLabel}>{t.inputLabel}</div>
            <textarea
              className={styles.textarea}
              value={message}
              onChange={(e) => { setMessage(e.target.value); setResult(null); setError(""); }}
              placeholder={t.placeholder}
              rows={7}
            />
          </div>
          <button
            type="button"
            className={styles.runBtn}
            disabled={!message.trim() || loading}
            onClick={runDemo}
          >
            {loading ? (
              <span className={styles.spinner} aria-hidden />
            ) : null}
            {loading ? t.analyzing : t.analyze}
          </button>
          {error && <p className={styles.error}>{error}</p>}
        </div>

        <div className={styles.outputCol}>
          {result ? (
            <div className={styles.ticket}>
              <div className={styles.ticketHeader}>
                <span className={styles.ticketLabel}>{t.draftTicket}</span>
                <span className={`${styles.priorityBadge} ${PRIORITY_COLOR[result.priority] ?? styles.medium}`}>
                  {result.priority}
                </span>
                {result.category && (
                  <span className={styles.categoryBadge}>{result.category}</span>
                )}
              </div>
              <p className={styles.ticketSubject}>{result.subject}</p>
              <p className={styles.ticketDesc}>{result.description}</p>
              <div className={styles.ticketActions}>
                <button type="button" className={styles.approveBtn}>{t.approve}</button>
                <button type="button" className={styles.editBtn}>{t.edit}</button>
              </div>
              <p className={styles.ticketNote}>{t.ticketNote}</p>
            </div>
          ) : (
            <div className={styles.placeholder}>
              <div className={styles.placeholderLines}>
                <span className={styles.line} />
                <span className={`${styles.line} ${styles.lineShort}`} />
                <span className={styles.line} />
                <span className={`${styles.line} ${styles.lineMid}`} />
                <span className={styles.line} />
              </div>
              <p className={styles.placeholderText}>
                {loading ? t.loadingText : t.placeholderText}
              </p>
            </div>
          )}
        </div>
      </div>

      <div className={styles.cta}>
        <a href={demoUrl} className={styles.ctaBtn}>
          {t.cta}
        </a>
      </div>
    </section>
  );
}
