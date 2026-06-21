"use client";

import { useState } from "react";
import styles from "./InboxDemo.module.css";

const EXAMPLES = [
  {
    label: "Invoice issue",
    text: "Hi, I received invoice #INV-2241 last week but the amount doesn't match what we agreed. The invoice says €1,850 but we discussed €1,650. Can you please look into this and send a corrected invoice? Thank you, Maaike from Lumen Studio",
  },
  {
    label: "Login problem",
    text: "Good morning, since yesterday our whole team can't log in to the platform. The page just keeps loading indefinitely. We've tried different browsers and restarting our computers but nothing works. This is urgent — we have customer calls this afternoon. Jan - TechCorp",
  },
  {
    label: "Plan upgrade",
    text: "Hello, I'm interested in upgrading our current subscription to the Growth plan. Could you tell me what the process is and if we can keep our existing data? Also, do you offer a discount for annual billing? Thanks!",
  },
];

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
        setError(data.error ?? "Something went wrong. Please try again.");
      } else {
        setResult(data);
      }
    } catch {
      setError("Could not reach the AI service. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className={styles.section}>
      <div className={styles.head}>
        <p className={styles.eyebrow}>// Live demo</p>
        <h2 className={styles.title}>See the AI in action</h2>
        <p className={styles.sub}>
          Paste any customer email below and watch Yippie draft the ticket
          subject, priority, and description in seconds.
        </p>
      </div>

      <div className={styles.demo}>
        <div className={styles.inputCol}>
          <div className={styles.examples}>
            {EXAMPLES.map((ex) => (
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
            <div className={styles.inputLabel}>Customer email</div>
            <textarea
              className={styles.textarea}
              value={message}
              onChange={(e) => { setMessage(e.target.value); setResult(null); setError(""); }}
              placeholder="Paste or type a customer email…"
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
            {loading ? "Analyzing…" : "Analyze with AI →"}
          </button>
          {error && <p className={styles.error}>{error}</p>}
        </div>

        <div className={styles.outputCol}>
          {result ? (
            <div className={styles.ticket}>
              <div className={styles.ticketHeader}>
                <span className={styles.ticketLabel}>Draft ticket</span>
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
                <button type="button" className={styles.approveBtn}>✓ Approve</button>
                <button type="button" className={styles.editBtn}>Edit</button>
              </div>
              <p className={styles.ticketNote}>
                This is a live preview — sign up to connect your inbox.
              </p>
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
                {loading ? "Yippie AI is reading the message…" : "Your AI-drafted ticket will appear here"}
              </p>
            </div>
          )}
        </div>
      </div>

      <div className={styles.cta}>
        <a href={demoUrl} className={styles.ctaBtn}>
          Connect your inbox — free demo →
        </a>
      </div>
    </section>
  );
}
