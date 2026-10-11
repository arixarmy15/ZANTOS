import { notFound } from "next/navigation";
import { hasLocale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { routing } from "./routing";

/**
 * Pages render in parallel with the layout, so each page validates its own locale too;
 * an unknown value (for example from a stray asset request) becomes a 404.
 */
export function requireLocale(locale: string): string {
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  return locale;
}
