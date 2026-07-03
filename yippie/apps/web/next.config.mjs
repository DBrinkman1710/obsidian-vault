/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",

  env: {
    // Note: "" would defeat the ?? fallbacks in page/layout code (empty string
    // is not nullish), so fall back to the canonical production URLs here.
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL ?? "https://app.getyippie.com",
    NEXT_PUBLIC_WEB_URL: process.env.NEXT_PUBLIC_WEB_URL ?? "https://getyippie.com",
    // The "Request demo" CTA lands on the on-site /request-demo page (was: app login).
    NEXT_PUBLIC_DEMO_URL: process.env.NEXT_PUBLIC_DEMO_URL ?? "/request-demo",
  },

  reactStrictMode: true,

  async redirects() {
    return [
      { source: "/signup", destination: "/custom", permanent: true },
    ];
  },

  async headers() {
    // Content-Security-Policy for the marketing site.
    // - script-src: Next.js injects inline bootstrap scripts, so 'unsafe-inline'
    //   is required. No 'unsafe-eval' — the site doesn't need it.
    // - script-src-elem: external script hosts (GTM/GA4, Cloudflare beacon +
    //   Cloudflare challenge scripts served from /cdn-cgi/).
    // - connect-src: GTM's own fetches, the sandbox stats API, and GA endpoints.
    const csp = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline'",
      "script-src-elem 'self' 'unsafe-inline' https://www.googletagmanager.com https://www.google-analytics.com https://static.cloudflareinsights.com https://getyippie.com/cdn-cgi/",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: https:",
      "font-src 'self' data:",
      [
        "connect-src 'self'",
        "https://www.googletagmanager.com",
        "https://sandbox.getyippie.com",
        "https://www.google-analytics.com",
        "https://analytics.google.com",
        "https://stats.g.doubleclick.net",
        "https://region1.google-analytics.com",
        "https://region1.analytics.google.com",
        "https://cloudflareinsights.com",
      ].join(" "),
      "frame-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "object-src 'none'",
    ].join("; ");

    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "Content-Security-Policy",
            value: csp,
          },
        ],
      },
    ];
  },
};

export default nextConfig;
