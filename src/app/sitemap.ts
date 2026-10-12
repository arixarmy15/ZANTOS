import type { MetadataRoute } from "next";
import { routing } from "@/i18n/routing";
import { getServerEnv } from "@/lib/config/env";

export const dynamic = "force-dynamic";

// Only the overview page in each language is public. Without SITE_URL there is no public
// address to list, so the sitemap stays empty rather than pointing at the wrong host.
export default function sitemap(): MetadataRoute.Sitemap {
  const site = getServerEnv().SITE_URL;
  if (!site) return [];
  const languages = Object.fromEntries(
    routing.locales.map((locale) => [locale, `${site}/${locale}`]),
  );
  return routing.locales.map((locale) => ({
    url: `${site}/${locale}`,
    changeFrequency: "monthly",
    priority: 1,
    alternates: { languages },
  }));
}
