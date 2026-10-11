import { defineRouting } from "next-intl/routing";

// Populated at build time from the files in `messages/` (see next.config.ts).
const locales = (process.env.TRADECHECK_LOCALES ?? "en").split(",").filter(Boolean);

export const routing = defineRouting({
  locales,
  defaultLocale: "en",
  localePrefix: "always",
});
