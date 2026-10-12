"use client";

import { ExternalLink, FileText, RotateCw, Trash2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import { StatusTag } from "@/components/ui/tag";
import { Dropzone } from "@/components/upload/dropzone";
import { postJson, uploadFile } from "@/components/upload/upload-file";
import { useErrorMessage, type Limits } from "@/components/upload/use-error-message";
import { useRouter } from "@/i18n/navigation";
import { DOCUMENT_TYPES, type DocumentType } from "@/lib/domain/fields";
import { formatFileSize, languageName } from "@/lib/format";
import type { DocumentStatus } from "@/lib/storage/types";

export type DocumentRow = {
  id: string;
  fileName: string;
  size: number;
  pageCount: number | null;
  status: DocumentStatus;
  errorCode: string | null;
  documentType: DocumentType | null;
  documentLanguage: string | null;
  inputTokens: number;
  outputTokens: number;
};

export function DocumentsPanel({
  checkId,
  documents,
  limits,
  retentionHours,
  readingEnabled,
}: {
  checkId: string;
  documents: DocumentRow[];
  limits: Limits;
  retentionHours: number;
  readingEnabled: boolean;
}) {
  const t = useTranslations();
  const locale = useLocale();
  const router = useRouter();
  const errorMessage = useErrorMessage(limits);
  const [reading, setReading] = useState<Set<string>>(new Set());
  const [uploading, setUploading] = useState(false);
  const [comparing, setComparing] = useState(false);
  const [uploadErrors, setUploadErrors] = useState<{ name: string; error: string }[]>([]);
  const [announcement, setAnnouncement] = useState("");
  const hintId = useId();

  const pending = documents.filter((doc) => doc.status === "uploaded" || doc.status === "failed");

  async function read(ids: string[]) {
    for (const id of ids) {
      setReading((current) => new Set(current).add(id));
      const name = documents.find((doc) => doc.id === id)?.fileName ?? "";
      setAnnouncement(`${t("document.status.extracting")} ${name}`);
      await postJson(`/api/checks/${checkId}/documents/${id}/extract`, undefined);
      setReading((current) => {
        const next = new Set(current);
        next.delete(id);
        return next;
      });
      router.refresh();
    }
    // Names and goods descriptions written differently are compared once all are read.
    setAnnouncement(t("results.compare.comparing"));
    setComparing(true);
    await postJson(`/api/checks/${checkId}/compare`, undefined);
    setComparing(false);
    router.refresh();
    setAnnouncement("");
  }

  async function addFiles(files: File[]) {
    setUploading(true);
    const errors: { name: string; error: string }[] = [];
    for (const file of files) {
      const result = await uploadFile(checkId, file, () => {});
      if (!result.ok) errors.push({ name: file.name, error: result.error });
    }
    setUploadErrors(errors);
    setUploading(false);
    router.refresh();
  }

  return (
    <section aria-labelledby="documents-heading" className="grid gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="documents-heading" className="text-title font-semibold">
          {t("check.documents")}
        </h2>
        {readingEnabled && pending.length > 0 ? (
          <Button
            variant="primary"
            disabled={reading.size > 0 || comparing}
            aria-describedby={hintId}
            onClick={() => void read(pending.map((doc) => doc.id))}
          >
            {t("check.readDocuments", { count: pending.length })}
          </Button>
        ) : null}
      </div>
      {readingEnabled ? (
        <p id={hintId} className="text-small text-slate">
          {t("check.readHint")}
        </p>
      ) : null}
      <p role="status" aria-live="polite" className="sr-only">
        {announcement}
      </p>

      {documents.length === 0 ? (
        <p className="text-slate">{t("upload.noDocuments")}</p>
      ) : (
        <ul className="divide-y divide-rule border border-rule bg-paper">
          {documents.map((doc) => {
            const isReading = reading.has(doc.id) || doc.status === "extracting";
            const status = isReading ? "extracting" : doc.status;
            return (
              <li key={doc.id} className="grid gap-3 px-4 py-3 md:grid-cols-[minmax(0,1fr)_auto]">
                <div className="grid min-w-0 gap-1">
                  <div className="flex min-w-0 items-center gap-2">
                    <FileText aria-hidden="true" className="size-4 shrink-0 text-slate" />
                    <span className="truncate font-medium" dir="auto">
                      {doc.fileName}
                    </span>
                  </div>
                  <p className="flex flex-wrap gap-x-3 gap-y-1 text-small text-slate">
                    <span>{formatFileSize(doc.size, locale)}</span>
                    {doc.pageCount ? (
                      <span>{t("document.pages", { count: doc.pageCount })}</span>
                    ) : null}
                    {doc.documentLanguage && doc.documentLanguage !== "und" ? (
                      <span>
                        {t("document.language", {
                          language: languageName(doc.documentLanguage, locale),
                        })}
                      </span>
                    ) : null}
                    {doc.inputTokens + doc.outputTokens > 0 ? (
                      <span>
                        {t("document.tokens", {
                          input: doc.inputTokens,
                          output: doc.outputTokens,
                        })}
                      </span>
                    ) : null}
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    <DocumentStatusTag status={status} />
                    {doc.errorCode && status === "failed" ? (
                      <span className="text-small text-error-fg">
                        {errorMessage(doc.errorCode)}
                      </span>
                    ) : null}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2 md:justify-end">
                  <DocumentTypeSelect checkId={checkId} doc={doc} />
                  <Button asChild variant="ghost" size="sm">
                    <a
                      href={`/api/checks/${checkId}/documents/${doc.id}/file`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <ExternalLink aria-hidden="true" />
                      {t("document.view")}
                    </a>
                  </Button>
                  {readingEnabled && doc.status === "extracted" ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={isReading || reading.size > 0}
                      onClick={() => void read([doc.id])}
                    >
                      <RotateCw aria-hidden="true" />
                      {t("check.readAgain")}
                    </Button>
                  ) : null}
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={isReading}
                    aria-label={t("document.removeLabel", { name: doc.fileName })}
                    onClick={async () => {
                      await postJson(
                        `/api/checks/${checkId}/documents/${doc.id}`,
                        undefined,
                        "DELETE",
                      );
                      router.refresh();
                    }}
                  >
                    <Trash2 aria-hidden="true" />
                    {t("document.remove")}
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {uploadErrors.length > 0 ? (
        <ul role="alert" className="grid gap-1 text-small text-error-fg">
          {uploadErrors.map((entry) => (
            <li key={entry.name}>
              <bdi>{entry.name}</bdi>: {errorMessage(entry.error)}
            </li>
          ))}
        </ul>
      ) : null}

      {documents.length < limits.maxFiles ? (
        <Dropzone
          limits={limits}
          retentionHours={retentionHours}
          disabled={uploading}
          onFiles={(files) => void addFiles(files.slice(0, limits.maxFiles - documents.length))}
        />
      ) : null}
    </section>
  );
}

function DocumentStatusTag({ status }: { status: DocumentStatus }) {
  const t = useTranslations("document.status");
  const map = {
    uploaded: "unverified",
    extracting: "info",
    extracted: "success",
    failed: "error",
  } as const;
  return <StatusTag status={map[status]} label={t(status)} />;
}

function DocumentTypeSelect({ checkId, doc }: { checkId: string; doc: DocumentRow }) {
  const t = useTranslations("document");
  const router = useRouter();
  const id = useId();
  return (
    <div className="flex items-center gap-2">
      <label htmlFor={id} className="sr-only">
        {t("type")}
      </label>
      <NativeSelect
        id={id}
        className="h-8 w-auto text-small"
        value={doc.documentType ?? ""}
        disabled={doc.status !== "extracted"}
        onChange={async (event) => {
          await postJson(
            `/api/checks/${checkId}/documents/${doc.id}`,
            { documentType: event.target.value },
            "PATCH",
          );
          router.refresh();
        }}
      >
        {doc.documentType === null ? <option value="">{t("types.unknown")}</option> : null}
        {DOCUMENT_TYPES.map((type) => (
          <option key={type} value={type}>
            {t(`types.${type}`)}
          </option>
        ))}
      </NativeSelect>
    </div>
  );
}
