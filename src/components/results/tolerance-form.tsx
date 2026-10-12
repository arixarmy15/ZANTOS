"use client";

import { useLocale, useTranslations } from "next-intl";
import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { postJson } from "@/components/upload/upload-file";
import { useErrorMessage } from "@/components/upload/use-error-message";
import { useRouter } from "@/i18n/navigation";
import { formatDecimal } from "@/lib/format";

const TOLERANCE = /^\d{1,6}(?:\.\d{1,6})?$/;

/** Rounding tolerance for amount checks; changing it re-runs the checks. */
export function ToleranceForm({ checkId, tolerance }: { checkId: string; tolerance: string }) {
  const t = useTranslations("results.tolerance");
  const locale = useLocale();
  const router = useRouter();
  const errorMessage = useErrorMessage();
  const [value, setValue] = useState(tolerance);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const ids = { input: useId(), hint: useId(), error: useId() };

  async function save(event: React.FormEvent) {
    event.preventDefault();
    const normalized = value.trim().replace(",", ".");
    if (!TOLERANCE.test(normalized)) {
      setError(t("invalid"));
      return;
    }
    setBusy(true);
    const result = await postJson(`/api/checks/${checkId}`, { tolerance: normalized }, "PATCH");
    setBusy(false);
    if (!result.ok) {
      setError(errorMessage(result.error));
      return;
    }
    setError(null);
    router.refresh();
  }

  return (
    <form onSubmit={(event) => void save(event)} className="grid gap-1" noValidate>
      <Label htmlFor={ids.input}>{t("label")}</Label>
      <div className="flex flex-wrap items-start gap-2">
        <Input
          id={ids.input}
          inputMode="decimal"
          dir="ltr"
          className="w-32 text-end tabular-nums"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          aria-invalid={error ? true : undefined}
          aria-describedby={`${ids.hint}${error ? ` ${ids.error}` : ""}`}
        />
        <Button type="submit" variant="secondary" disabled={busy || value === tolerance}>
          {t("apply")}
        </Button>
      </div>
      <p id={ids.hint} className="text-small text-slate">
        {t("hint", { value: formatDecimal(tolerance, locale) })}
      </p>
      {error ? (
        <p id={ids.error} className="text-small text-error-fg">
          {error}
        </p>
      ) : null}
    </form>
  );
}
