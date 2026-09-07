import type { MetadataRoute } from "next";

const SITE = "https://getyippie.com";

/* Blog posts carry their real publish dates; product pages use build time. */
const BLOG_DATES: Record<string, string> = {
  "/blog/how-to-reduce-customer-service-response-time": "2026-06-05",
  "/blog/5-ways-ai-saves-smb-customer-service-time": "2026-06-12",
  "/blog/shared_inbox_vs_regular_email": "2026-06-19",
  "/blog/cost_of_slow_customer_service_response": "2026-06-26",
  "/blog/whatsapp_customer_service_for_small_business": "2026-07-03",
  "/blog/two_extremes_customer_support_smb": "2026-07-10",
  "/blog/klantenservice_software_voor_mkb": "2026-07-10",
};

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();

  const staticRoutes: { path: string; priority: number; changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"] }[] = [
    { path: "/", priority: 1.0, changeFrequency: "weekly" },
    { path: "/modules", priority: 0.9, changeFrequency: "monthly" },
    { path: "/pricing", priority: 0.9, changeFrequency: "monthly" },
    { path: "/signup", priority: 0.9, changeFrequency: "monthly" },
    { path: "/for-smbs", priority: 0.8, changeFrequency: "monthly" },
    { path: "/for-agencies", priority: 0.8, changeFrequency: "monthly" },
    { path: "/vs-zendesk", priority: 0.8, changeFrequency: "monthly" },
    { path: "/vs-freshdesk", priority: 0.8, changeFrequency: "monthly" },
    { path: "/vs-front", priority: 0.8, changeFrequency: "monthly" },
    { path: "/request-demo", priority: 0.8, changeFrequency: "monthly" },
    { path: "/docs", priority: 0.7, changeFrequency: "monthly" },
    { path: "/about", priority: 0.7, changeFrequency: "monthly" },
    { path: "/blog", priority: 0.7, changeFrequency: "weekly" },
    { path: "/blog/5-ways-ai-saves-smb-customer-service-time", priority: 0.6, changeFrequency: "monthly" },
    { path: "/blog/how-to-reduce-customer-service-response-time", priority: 0.6, changeFrequency: "monthly" },
    { path: "/blog/cost_of_slow_customer_service_response", priority: 0.6, changeFrequency: "monthly" },
    { path: "/blog/shared_inbox_vs_regular_email", priority: 0.6, changeFrequency: "monthly" },
    { path: "/blog/whatsapp_customer_service_for_small_business", priority: 0.6, changeFrequency: "monthly" },
    { path: "/blog/two_extremes_customer_support_smb", priority: 0.6, changeFrequency: "monthly" },
    { path: "/blog/klantenservice_software_voor_mkb", priority: 0.6, changeFrequency: "monthly" },
    { path: "/privacy", priority: 0.3, changeFrequency: "yearly" },
    { path: "/terms", priority: 0.3, changeFrequency: "yearly" },
  ];

  // Dutch lives at the root; English mirrors every route under /en at a
  // slightly lower priority. The homepage maps to "/en" (no trailing path).
  const withEnglish = staticRoutes.flatMap((r) => {
    const enPath = r.path === "/" ? "/en" : `/en${r.path}`;
    return [
      r,
      { path: enPath, priority: Math.max(0.1, r.priority - 0.1), changeFrequency: r.changeFrequency },
    ];
  });

  return withEnglish.map((r) => {
    const canonicalPath = r.path.startsWith("/en/") ? r.path.slice(3) : r.path === "/en" ? "/" : r.path;
    return {
      url: `${SITE}${r.path}`,
      lastModified: BLOG_DATES[canonicalPath] ? new Date(BLOG_DATES[canonicalPath] as string) : lastModified,
      changeFrequency: r.changeFrequency,
      priority: r.priority,
    };
  });
}
