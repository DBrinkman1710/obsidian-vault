/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",

  env: {
    // Note: "" would defeat the ?? fallbacks in page/layout code (empty string
    // is not nullish), so fall back to the canonical production URLs here.
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL ?? "https://app.getyippie.com",
    NEXT_PUBLIC_WEB_URL: process.env.NEXT_PUBLIC_WEB_URL ?? "https://getyippie.com",
    // The "Request demo" CTA now lands on the on-site /demo page (was: app login).
    NEXT_PUBLIC_DEMO_URL: process.env.NEXT_PUBLIC_DEMO_URL ?? "/demo",
  },

  reactStrictMode: true,

  async headers() {
    return [
      {
        // Tell browsers to always use HTTPS for this domain so they never
        // attempt an insecure http:// request that has to be 301-redirected
        // (which is what triggers NordVPN's "insecure" shield badge).
        source: "/:path*",
        headers: [
          {
            key: "Strict-Transport-Security",
            value: "max-age=15552000; includeSubDomains",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
