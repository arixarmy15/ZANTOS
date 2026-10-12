"use client";

import { CircleCheck, FileText, OctagonAlert, X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { forgetCarried, peekCarried, registerCarry } from "@/components/shell/locale-switch";
import { Dropzone } from "@/components/upload/dropzone";
import { postJson, uploadFile } from "@/components/upload/upload-file";
import { useErrorMessage, type Limits } from "@/components/upload/use-error-message";
import { Link, useRouter } from "@/i18n/navigation";
import { formatFileSize } from "@/lib/format";

type Draft = { name: string; items: Item[]; checkId: string | null };

type Item = {
  key: string;
  file: File;
  state: "selected" | "uploading" | "done" | "failed";
  progress: number;
  error?: string;
};

export function NewCheckForm({
  limits,
  retentionHours,
}: {
  limits: Limits;
  retentionHours: number;
}) {
  const t = useTranslations();
  const locale = useLocale();
  const router = useRouter();
  const errorMessage = useErrorMessage(limits);
  // A language switch remounts the page; the reference and chosen files come along.
  const [carried] = useState(() => peekCarried<Draft>("new-check"));
  useEffect(() => forgetCarried("new-check"), []);
  const [name, setName] = useState(carried?.name ?? "");
  const [items, setItems] = useState<Item[]>(carried?.items ?? []);
  const [busy, setBusy] = useState(false);
  const [checkId, setCheckId] = useState<string | null>(carried?.checkId ?? null);
  useEffect(
    () =>
      registerCarry("new-check", () => ({
        name,
        checkId,
        // An upload cut off by the switch is offered again rather than shown as running.
        items: items.map((item) =>
          item.state === "uploading" ? { ...item, state: "selected" as const, progress: 0 } : item,
        ),
      })),
    [name, items, checkId],
  );
  const [formError, setFormError] = useState<string | null>(null);
  const nameId = useId();
  const hintId = useId();

  const update = (key: string, patch: Partial<Item>) =>
    setItems((current) => current.map((item) => (item.key === key ? { ...item, ...patch } : item)));

  const addFiles = (files: File[]) =>
    setItems((current) =>
      [
        ...current,
        ...files.map((file) => ({
          key: `${file.name}-${file.size}-${crypto.randomUUID()}`,
          file,
          state: "selected" as const,
          progress: 0,
        })),
      ].slice(0, limits.maxFiles),
    );

  async function submit() {
    setBusy(true);
    setFormError(null);
    let id = checkId;
    if (!id) {
      const created = await postJson("/api/checks", { name: name.trim() || null });
      if (!created.ok) {
        setFormError(errorMessage(created.error));
        setBusy(false);
        return;
      }
      id = (created.data as { id: string }).id;
      setCheckId(id);
    }
    let failed = false;
    for (const item of items.filter(
      (entry) => entry.state === "selected" || entry.state === "failed",
    )) {
      update(item.key, { state: "uploading", progress: 0, error: undefined });
      const result = await uploadFile(id, item.file, (progress) => update(item.key, { progress }));
      if (result.ok) update(item.key, { state: "done", progress: 1 });
      else {
        failed = true;
        update(item.key, { state: "failed", error: result.error });
      }
    }
    setBusy(false);
    if (!failed) router.push(`/checks/${id}`);
  }

  const failedCount = items.filter((item) => item.state === "failed").length;

  return (
    <form
      className="grid gap-6"
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      <div className="grid max-w-md gap-1.5">
        <Label htmlFor={nameId}>{t("newCheck.nameLabel")}</Label>
        <Input
          id={nameId}
          value={name}
          maxLength={120}
          disabled={busy || checkId !== null}
          aria-describedby={hintId}
          onChange={(event) => setName(event.target.value)}
        />
        <p id={hintId} className="text-small text-slate">
          {t("newCheck.nameHint")}
        </p>
      </div>

      <Dropzone
        limits={limits}
        retentionHours={retentionHours}
        disabled={busy}
        onFiles={addFiles}
      />

      {items.length > 0 ? (
        <section aria-labelledby="selected-files" className="grid gap-2">
          <h2 id="selected-files" className="text-title-sm font-semibold">
            {t("newCheck.selected")}
          </h2>
          <ul className="divide-y divide-rule overflow-hidden surface">
            {items.map((item) => (
              <li key={item.key} className="grid gap-1.5 px-4 py-3">
                <div className="flex items-center gap-3">
                  <FileText aria-hidden="true" className="size-4 shrink-0 text-slate" />
                  <span className="min-w-0 flex-1 truncate" dir="auto">
                    {item.file.name}
                  </span>
                  <span className="text-small text-slate">
                    {formatFileSize(item.file.size, locale)}
                  </span>
                  {item.state === "done" ? (
                    <span className="inline-flex items-center gap-1 text-small text-success-fg">
                      <CircleCheck aria-hidden="true" className="size-4" />
                      {t("upload.added")}
                    </span>
                  ) : null}
                  {item.state === "selected" || item.state === "failed" ? (
                    <Button
                      variant="ghost"
                      size="icon"
                      disabled={busy}
                      aria-label={t("upload.removeFile", { name: item.file.name })}
                      onClick={() =>
                        setItems((current) => current.filter((entry) => entry.key !== item.key))
                      }
                    >
                      <X aria-hidden="true" />
                    </Button>
                  ) : null}
                </div>
                {item.state === "uploading" ? (
                  <div
                    role="progressbar"
                    aria-label={`${t("upload.uploading")}: ${item.file.name}`}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={Math.round(item.progress * 100)}
                    className="h-1 overflow-hidden bg-rule"
                  >
                    <div
                      className="h-full origin-[0] bg-harbor transition-transform duration-(--duration-normal) rtl:origin-[100%]"
                      style={{ transform: `scaleX(${item.progress})` }}
                    />
                  </div>
                ) : null}
                {item.error ? (
                  <p className="flex items-center gap-1.5 text-small text-error-fg" role="alert">
                    <OctagonAlert aria-hidden="true" className="size-4 shrink-0" />
                    {errorMessage(item.error)}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {formError ? (
        <p className="text-error-fg" role="alert">
          {formError}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="submit"
          variant="primary"
          size="lg"
          disabled={busy || items.every((item) => item.state === "done")}
        >
          {busy ? t("newCheck.creating") : t("newCheck.create")}
        </Button>
        {checkId && failedCount > 0 && !busy ? (
          <>
            <p className="text-slate">{t("newCheck.someFailed")}</p>
            <Button asChild variant="secondary">
              <Link href={`/checks/${checkId}`}>{t("newCheck.continue")}</Link>
            </Button>
          </>
        ) : null}
      </div>
    </form>
  );
}
