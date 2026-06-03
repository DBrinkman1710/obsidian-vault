import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Yippie",
  description: "getyippie.com",
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_WEB_URL ?? "https://getyippie.com"
  ),
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
