"use client";

import { useTranslations } from "next-intl";

export type Limits = { maxMb: number; maxPages: number; maxFiles: number };

/** Turns an API error code into a translated sentence. Unknown codes fall back safely. */
export function useErrorMessage(limits?: Limits) {
  const t = useTranslations("errors");
  return (code: string) => {
    const key = t.has(code) ? code : "api_error";
    return t(key, {
      maxMb: limits?.maxMb ?? 0,
      maxPages: limits?.maxPages ?? 0,
      maxFiles: limits?.maxFiles ?? 0,
    });
  };
}
