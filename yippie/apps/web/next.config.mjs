/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",

  env: {
    // Note: "" would defeat the ?? fallbacks in page/layout code (empty string
    // is not nullish), so fall back to the canonical production URLs here.
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL ?? "https://app.getyippie.com",
    NEXT_PUBLIC_WEB_URL: process.env.NEXT_PUBLIC_WEB_URL ?? "https://getyippie.com",
  },

  reactStrictMode: true,
};

export default nextConfig;
