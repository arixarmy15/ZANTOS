"use client";

import { useLocale, useTranslations } from "next-intl";
import { useId, useLayoutEffect, useTransition } from "react";
import { NativeSelect } from "@/components/ui/native-select";
import { usePathname, useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import {
  carryAll,
  currentScrollAnchor,
  restoreScrollAnchor,
  takeCarried,
  type ScrollAnchor,
} from "./locale-switch";

export type LanguageOption = { code: string; name: string };

export function LanguageSwitcher({
  languages,
  className,
}: {
  languages: LanguageOption[];
  className?: string;
}) {
  const t = useTranslations("nav");
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const id = useId();

  // The reader stays where they were: the same section, not the top of the page.
  useLayoutEffect(() => {
    const anchor = takeCarried<ScrollAnchor | null>("scroll-anchor");
    if (anchor) restoreScrollAnchor(anchor);
  }, [locale]);

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <label htmlFor={id} className="text-small text-slate">
        {t("language")}
      </label>
      <NativeSelect
        id={id}
        value={locale}
        disabled={pending}
        className="h-8 w-auto text-small pointer-coarse:h-11"
        onChange={(event) => {
          const next = event.target.value;
          carryAll({ "scroll-anchor": currentScrollAnchor() });
          // Same page, query and #section in the other language; no jump to the top.
          const href = `${pathname}${window.location.search}${window.location.hash}`;
          startTransition(() => router.replace(href, { locale: next, scroll: false }));
        }}
      >
        {languages.map((language) => (
          // Language names are shown in their own language and script.
          <option key={language.code} value={language.code} lang={language.code}>
            {language.name}
          </option>
        ))}
      </NativeSelect>
    </div>
  );
}
