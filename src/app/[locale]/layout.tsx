import "@fontsource-variable/bodoni-moda/opsz.css";
import "@fontsource-variable/dm-sans/opsz.css";
import "@fontsource/ibm-plex-sans-arabic/400.css";
import "@fontsource/ibm-plex-sans-arabic/500.css";
import "@fontsource/ibm-plex-sans-arabic/600.css";
// Hebrew faces load only for Hebrew text (their unicode-range is Hebrew).
import "@fontsource/ibm-plex-sans-hebrew/hebrew-400.css";
import "@fontsource/ibm-plex-sans-hebrew/hebrew-500.css";
import "@fontsource/ibm-plex-sans-hebrew/hebrew-600.css";
import "@fontsource-variable/frank-ruhl-libre/wght.css";
import "@fontsource/dm-mono/400.css";
import "@fontsource/dm-mono/500.css";
import "../globals.css";

import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import type * as React from "react";
import { Providers } from "@/components/shell/providers";
import { SiteFooter } from "@/components/shell/site-footer";
import { SiteHeader } from "@/components/shell/site-header";
import { getLanguages } from "@/i18n/languages";
import { routing } from "@/i18n/routing";
import { getServerEnv } from "@/lib/config/env";

type Props = { children: React.ReactNode; params: Promise<{ locale: string }> };

// Only the configured locales are valid. Anything else (for example a browser asking for
// /favicon.ico, which the proxy does not handle) is a 404 before any page code runs.
export const dynamicParams = false;

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "metadata" });
  const site = getServerEnv().SITE_URL;
  return {
    // Absolute URLs for canonical, language and social-preview links, when the public
    // address is known.
    ...(site ? { metadataBase: new URL(site) } : {}),
    title: { default: t("title"), template: `%s · ${t("title")}` },
    description: t("description"),
    applicationName: "Tickline",
    appleWebApp: { capable: true, title: "Tickline", statusBarStyle: "default" },
    // Invoice numbers, IBANs, amounts and dates must not turn into phone, map or calendar links.
    formatDetection: { telephone: false, date: false, address: false, email: false },
  };
}

/** Phones: full width, room for the notch (safe areas are padded), browser bars in Paper. */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#FFFFFF",
  colorScheme: "light",
};

export default async function LocaleLayout({ children, params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const languages = await getLanguages();
  const direction = languages.find((language) => language.code === locale)?.direction ?? "ltr";
  const t = await getTranslations("nav");

  return (
    <html lang={locale} dir={direction}>
      <body className="flex min-h-dvh flex-col">
        <NextIntlClientProvider>
          <Providers dir={direction}>
            <a
              href="#main"
              className="sr-only z-50 bg-paper px-3 py-2 font-medium text-harbor focus:not-sr-only focus:fixed focus:start-2 focus:top-2"
            >
              {t("skipToContent")}
            </a>
            <SiteHeader languages={languages.map(({ code, name }) => ({ code, name }))} />
            <main id="main" tabIndex={-1} className="flex-1 focus:outline-none">
              {children}
            </main>
            <SiteFooter />
          </Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
