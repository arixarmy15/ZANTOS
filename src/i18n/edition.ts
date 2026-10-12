/**
 * Which edition the build serves. Read once at build time by next.config.ts.
 *
 * - "hebrew" (default): Hebrew is listed first and every visitor starts in Hebrew; the other
 *   languages stay one click away in the language menu.
 * - "multilingual": the edition before Hebrew became the default. English first, and the
 *   starting language follows the browser (Accept-Language, then a remembered choice).
 */
export const EDITIONS = ["hebrew", "multilingual"] as const;

/** Variables read by next.config.ts at build time rather than by the server at run time. */
export const BUILD_ENV = ["TICKLINE_EDITION"] as const;
export type Edition = (typeof EDITIONS)[number];

export type LocaleSettings = {
  edition: Edition;
  locales: string[];
  defaultLocale: string;
  localeDetection: boolean;
};

export function localeSettings(edition: string | undefined, available: string[]): LocaleSettings {
  const chosen = (edition?.trim() || "hebrew") as Edition;
  if (!EDITIONS.includes(chosen)) {
    throw new Error(`TICKLINE_EDITION must be one of ${EDITIONS.join(", ")}; got "${edition}".`);
  }
  const defaultLocale = chosen === "hebrew" ? "he" : "en";
  if (!available.includes(defaultLocale)) {
    throw new Error(`The ${chosen} edition needs messages/${defaultLocale}.json.`);
  }
  const locales = [...available].sort((a, b) =>
    a === defaultLocale ? -1 : b === defaultLocale ? 1 : a.localeCompare(b),
  );
  return { edition: chosen, locales, defaultLocale, localeDetection: chosen === "multilingual" };
}
