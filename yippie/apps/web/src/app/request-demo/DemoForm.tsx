"use client";

import { useState } from "react";
import styles from "./request-demo.module.css";
import { CheckIcon } from "../components/icons";

type State = "idle" | "submitting" | "success" | "error";

export default function DemoForm() {
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [email, setEmail] = useState("");
  const [state, setState] = useState<State>("idle");
  const [errorMsg, setErrorMsg] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setState("submitting");
    setErrorMsg("");

    try {
      const res = await fetch("/api/request-demo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, company_name: company, email }),
      });

      if (res.ok) {
        setState("success");
        return;
      }

      const data = await res.json().catch(() => ({}));
      const msg =
        typeof data?.error === "string"
          ? data.error
          : "Something went wrong. Please try again.";
      setErrorMsg(msg);
      setState("error");
    } catch {
      setErrorMsg("Network error — please check your connection and try again.");
      setState("error");
    }
  }

  if (state === "success") {
    return (
      <div className={styles.card}>
        <div className={styles.success}>
          <div className={styles.successIcon}>
            <CheckIcon size={24} />
          </div>
          <h2 className={styles.successTitle}>Demo sent</h2>
          <p className={styles.successSub}>
            Check your inbox — we&apos;ve emailed you a one-click link to enter your
            Yippie demo workspace.
          </p>
        </div>
      </div>
    );
  }

  const busy = state === "submitting";

  return (
    <form className={styles.card} onSubmit={handleSubmit} noValidate>
      <div className={styles.fieldGroup}>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="demo-name">
            Your name
          </label>
          <input
            id="demo-name"
            className={styles.input}
            type="text"
            placeholder="Jane Smith"
            required
            autoComplete="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={busy}
          />
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="demo-company">
            Company name
          </label>
          <input
            id="demo-company"
            className={styles.input}
            type="text"
            placeholder="Acme BV"
            required
            autoComplete="organization"
            value={company}
            onChange={(e) => setCompany(e.target.value)}
            disabled={busy}
          />
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="demo-email">
            Work email
          </label>
          <input
            id="demo-email"
            className={styles.input}
            type="email"
            placeholder="jane@acme.com"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={busy}
          />
        </div>
      </div>

      <button className={styles.submit} type="submit" disabled={busy}>
        {busy ? "Sending…" : "Request demo"}
      </button>

      {state === "error" && errorMsg && (
        <p className={styles.error}>{errorMsg}</p>
      )}

      <p className={styles.finePrint}>No credit card required · Usually replies within 1 business day</p>
    </form>
  );
}
