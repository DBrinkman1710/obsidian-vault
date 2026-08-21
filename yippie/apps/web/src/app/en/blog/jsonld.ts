/* Shared JSON-LD builders for blog posts. */

const SITE = "https://getyippie.com";

export function breadcrumbJsonLd(title: string, url: string) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: SITE },
      { "@type": "ListItem", position: 2, name: "Blog", item: `${SITE}/blog` },
      { "@type": "ListItem", position: 3, name: title, item: url },
    ],
  };
}
