import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { notFound } from "next/navigation";
import { hasLocale } from "next-intl";
import { routing } from "@/i18n/routing";

/**
 * The overview's social preview (Open Graph and Twitter card), one per language. The PNGs are
 * rendered ahead of time by `npm run og:image` (scripts/generate-og-image.mjs) from each
 * message file, so the card shows the same words as the page.
 */
export const socialImageSize = { width: 1200, height: 630 };

// Next.js also calls this while collecting the image ids at build time, with no params and
// outside a request; then only the id matters. With a language, the alt text is read from its
// message file directly (next-intl's request configuration is not available here).
export async function socialImageMetadata(locale: string | undefined) {
  const card = { id: "card", size: socialImageSize, contentType: "image/png" };
  if (!locale || !hasLocale(routing.locales, locale)) return [card];
  const messages = (await import(`../../../messages/${locale}.json`)).default as {
    metadata: { ogAlt: string };
  };
  return [{ ...card, alt: messages.metadata.ogAlt }];
}

export async function socialImage(params: Promise<{ locale: string }>) {
  const { locale } = await params;
  // The locale names a file, so only the configured languages are accepted.
  if (!hasLocale(routing.locales, locale)) notFound();
  const png = await readFile(join(process.cwd(), "public", "social", `${locale}.png`));
  return new Response(png, { headers: { "Content-Type": "image/png" } });
}
