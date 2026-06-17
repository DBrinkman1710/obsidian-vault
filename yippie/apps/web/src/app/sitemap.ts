import type { MetadataRoute } from "next";

const SITE = "https://getyippie.com";

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();

  const staticRoutes: { path: string; priority: number; changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"] }[] = [
    { path: "/", priority: 1.0, changeFrequency: "weekly" },
    { path: "/features", priority: 0.9, changeFrequency: "monthly" },
    { path: "/modules", priority: 0.9, changeFrequency: "monthly" },
    { path: "/for-smbs", priority: 0.8, changeFrequency: "monthly" },
    { path: "/for-agencies", priority: 0.8, changeFrequency: "monthly" },
    { path: "/vs-zendesk", priority: 0.8, changeFrequency: "monthly" },
    { path: "/about", priority: 0.7, changeFrequency: "monthly" },
    { path: "/blog", priority: 0.7, changeFrequency: "weekly" },
    { path: "/blog/5-ways-ai-saves-smb-customer-service-time", priority: 0.6, changeFrequency: "monthly" },
    { path: "/blog/how-to-reduce-customer-service-response-time", priority: 0.6, changeFrequency: "monthly" },
    { path: "/request-demo", priority: 0.8, changeFrequency: "monthly" },
  ];

  return staticRoutes.map((r) => ({
    url: `${SITE}${r.path}`,
    lastModified,
    changeFrequency: r.changeFrequency,
    priority: r.priority,
  }));
}
