import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();

  return [
    {
      url: "https://www.getyippie.com/",
      lastModified,
      changeFrequency: "weekly",
      priority: 1.0,
    },
    {
      url: "https://www.getyippie.com/request-demo",
      lastModified,
      changeFrequency: "monthly",
      priority: 0.8,
    },
  ];
}
