import { readdirSync } from "node:fs";
import { join } from "node:path";
import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
import { localeSettings } from "./src/i18n/edition";

// Interface languages are discovered from `messages/*.json`, so adding a language only
// requires adding its message file. TICKLINE_EDITION picks the starting language: Hebrew by
// default, or "multilingual" for the earlier English-first edition (see src/i18n/edition.ts).
const languages = localeSettings(
  process.env.TICKLINE_EDITION,
  readdirSync(join(process.cwd(), "messages"))
    .filter((file) => file.endsWith(".json"))
    .map((file) => file.slice(0, -".json".length)),
);

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "same-origin" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // PDF.js loads its worker from its own package folder; bundling it into the server build
  // breaks that path, so the server uses the published package as is.
  serverExternalPackages: ["pdfjs-dist"],
  env: {
    TICKLINE_LOCALES: languages.locales.join(","),
    TICKLINE_DEFAULT_LOCALE: languages.defaultLocale,
    TICKLINE_LOCALE_DETECTION: languages.localeDetection ? "1" : "0",
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

export default withNextIntl(nextConfig);
