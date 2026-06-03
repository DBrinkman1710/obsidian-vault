"use client";

import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const form = new FormData(e.currentTarget);
    const result = await signIn("credentials", {
      email: form.get("email"),
      password: form.get("password"),
      redirect: false,
    });

    setLoading(false);
    if (result?.error) {
      setError("Invalid email or password.");
    } else {
      router.push("/dashboard");
    }
  }

  return (
    <main style={styles.main}>
      <div style={styles.card}>
        <h1 style={styles.title}>Yippie</h1>
        <form onSubmit={handleSubmit} style={styles.form}>
          <label style={styles.label}>
            Email
            <input name="email" type="email" required style={styles.input} />
          </label>
          <label style={styles.label}>
            Password
            <input
              name="password"
              type="password"
              required
              style={styles.input}
            />
          </label>
          {error && <p style={styles.error}>{error}</p>}
          <button type="submit" disabled={loading} style={styles.button}>
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </div>
    </main>
  );
}

const styles = {
  main: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontFamily: "system-ui, sans-serif",
    background: "#f5f5f5",
  } as React.CSSProperties,
  card: {
    background: "#fff",
    borderRadius: "8px",
    padding: "2.5rem",
    width: "100%",
    maxWidth: "360px",
    boxShadow: "0 2px 8px rgba(0,0,0,.08)",
  } as React.CSSProperties,
  title: { margin: "0 0 1.5rem", fontSize: "1.5rem" } as React.CSSProperties,
  form: { display: "flex", flexDirection: "column", gap: "1rem" } as React.CSSProperties,
  label: { display: "flex", flexDirection: "column", gap: "4px", fontSize: "0.875rem" } as React.CSSProperties,
  input: { padding: "0.5rem", border: "1px solid #ddd", borderRadius: "4px", fontSize: "1rem" } as React.CSSProperties,
  button: { padding: "0.625rem", background: "#111", color: "#fff", border: "none", borderRadius: "4px", cursor: "pointer", fontSize: "1rem" } as React.CSSProperties,
  error: { color: "#dc2626", fontSize: "0.875rem", margin: 0 } as React.CSSProperties,
};
