export default function HomePage() {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "#";

  return (
    <main
      style={{
        fontFamily: "system-ui, sans-serif",
        padding: "4rem 2rem",
        maxWidth: "640px",
        margin: "0 auto",
      }}
    >
      <h1>Yippie</h1>
      <p>Marketing site coming soon.</p>
      <a href={appUrl}>Open App →</a>
    </main>
  );
}
