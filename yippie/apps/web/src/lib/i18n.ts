// Locale helpers for the marketing site.
// Dutch (nl) is the default and lives at the root (/, /pricing, …).
// English (en) lives under the /en prefix (/en, /en/pricing, …).

export type Locale = "nl" | "en";

export const DEFAULT_LOCALE: Locale = "nl";

/** Derive the active locale from a Next.js pathname. */
export function getLocale(pathname: string | null | undefined): Locale {
  if (!pathname) return DEFAULT_LOCALE;
  return pathname === "/en" || pathname.startsWith("/en/") ? "en" : "nl";
}

/**
 * Prefix an internal path for the given locale.
 * Dutch stays at the root; English is prefixed with /en.
 * External URLs, anchors (#…), mailto: and tel: pass through unchanged.
 */
export function localizeHref(href: string, locale: Locale): string {
  if (!href.startsWith("/")) return href;
  if (locale === "en") return href === "/" ? "/en" : `/en${href}`;
  return href;
}

/** Strip the locale prefix to get the canonical (Dutch) path. */
export function stripLocale(pathname: string): string {
  if (pathname === "/en") return "/";
  if (pathname.startsWith("/en/")) return pathname.slice(3);
  return pathname;
}

/** Map any pathname to its counterpart in the target locale (for the language switcher). */
export function switchLocaleHref(pathname: string, to: Locale): string {
  const base = stripLocale(pathname) || "/";
  return localizeHref(base, to);
}
