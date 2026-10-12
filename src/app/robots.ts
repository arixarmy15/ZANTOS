import type { MetadataRoute } from "next";
import { getServerEnv } from "@/lib/config/env";

export const dynamic = "force-dynamic";

// The overview pages are public; checks hold uploaded business documents and the API serves
// them, so neither is crawled.
export default function robots(): MetadataRoute.Robots {
  const site = getServerEnv().SITE_URL;
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/api/", "/*/checks"] },
    ...(site ? { sitemap: `${site}/sitemap.xml` } : {}),
  };
}
