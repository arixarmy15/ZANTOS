import { defineRouting } from "next-intl/routing";

// Populated at build time from the files in `messages/` and TICKLINE_EDITION (see
// next.config.ts and edition.ts). Outside a build (unit tests) only English is known.
const locales = (process.env.TICKLINE_LOCALES ?? "en").split(",").filter(Boolean);
const defaultLocale = process.env.TICKLINE_DEFAULT_LOCALE ?? locales[0] ?? "en";

export const routing = defineRouting({
  locales,
  defaultLocale,
  localePrefix: "always",
  // The Hebrew edition always starts in Hebrew; the multilingual edition follows the browser.
  localeDetection: process.env.TICKLINE_LOCALE_DETECTION === "1",
});
