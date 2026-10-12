"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";
import { postJson } from "@/components/upload/upload-file";
import { useErrorMessage } from "@/components/upload/use-error-message";
import { useRouter } from "@/i18n/navigation";

/** Offers the AI comparison of names and descriptions the rules are still waiting for. */
export function CompareNotice({
  checkId,
  pending,
  enabled,
}: {
  checkId: string;
  pending: number;
  enabled: boolean;
}) {
  const t = useTranslations("results.compare");
  const router = useRouter();
  const errorMessage = useErrorMessage();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function compare() {
    setBusy(true);
    setError(null);
    const result = await postJson(`/api/checks/${checkId}/compare`, undefined);
    setBusy(false);
    if (!result.ok) setError(result.error);
    router.refresh();
  }

  return (
    <Notice status="unverified" title={t("title", { count: pending })}>
      <p>{t("body")}</p>
      {enabled ? (
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <Button variant="secondary" size="sm" onClick={() => void compare()} disabled={busy}>
            {busy ? t("comparing") : t("button")}
          </Button>
          <span aria-live="polite" className="text-small text-error-fg">
            {error ? errorMessage(error) : null}
          </span>
        </div>
      ) : null}
    </Notice>
  );
}
