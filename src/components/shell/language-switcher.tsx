"use client";

import { useLocale, useTranslations } from "next-intl";
import { useId, useTransition } from "react";
import { NativeSelect } from "@/components/ui/native-select";
import { usePathname, useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

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
          startTransition(() => router.replace(pathname, { locale: next }));
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
