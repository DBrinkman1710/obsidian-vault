"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { getLocale } from "@/lib/i18n";

// The root <html lang> defaults to "nl". On /en routes we flip the document
// language to "en" so assistive tech and search engines see the right value.
export default function LangSync() {
  const pathname = usePathname();
  useEffect(() => {
    document.documentElement.lang = getLocale(pathname);
  }, [pathname]);
  return null;
}
