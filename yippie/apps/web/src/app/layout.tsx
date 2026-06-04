import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Yippie — Customer support, made easy",
  description: "Give SMB owners time back for what matters. Yippie automates your support inbox, tickets, and live chat.",
  metadataBase: new URL(process.env.NEXT_PUBLIC_WEB_URL ?? "https://getyippie.com"),
  openGraph: {
    title: "Yippie — Customer support, made easy",
    description: "Give SMB owners time back for what matters.",
    url: "https://getyippie.com",
    siteName: "Yippie",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
