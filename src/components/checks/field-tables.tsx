"use client";

import { ChevronDown, Gauge, PenLine, Pencil } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useId, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MarkerTag } from "@/components/ui/tag";
import { postJson } from "@/components/upload/upload-file";
import { useErrorMessage } from "@/components/upload/use-error-message";
import { useRouter } from "@/i18n/navigation";
import type { EffectiveField } from "@/lib/checks/effective";
import {
  HEADER_FIELD_KEYS,
  LINE_FIELD_KEYS,
  type FieldKind,
  type HeaderFieldKey,
  type LineFieldKey,
} from "@/lib/domain/fields";
import { dataLocale, formatNormalized } from "@/lib/format";
import { cn } from "@/lib/utils";

export type FieldDocument = {
  id: string;
  fileName: string;
  documentLanguage: string | null;
  header: Record<HeaderFieldKey, EffectiveField>;
  lines: Record<LineFieldKey, EffectiveField>[];
};

/** Codes and numbers keep left-to-right order inside right-to-left text. */
const LTR_KINDS = new Set<FieldKind>([
  "date",
  "amount",
  "quantity",
  "currency",
  "country",
  "incoterm",
  "weightUnit",
  "hsCode",
  "iban",
  "vatId",
  "eori",
]);

const CODE_KINDS = new Set<FieldKind>(["hsCode", "iban", "vatId", "eori"]);

function Value({ field }: { field: EffectiveField }) {
  const t = useTranslations("fields");
  const locale = useLocale();
  if (field.normalized === null) return <span className="text-slate">{t("notPrinted")}</span>;
  const text = formatNormalized(field.kind, field.normalized, locale);
  // A formatted date follows the interface language's own order (Arabic dates carry
  // right-to-left marks), so only codes and numbers are forced left to right.
  return LTR_KINDS.has(field.kind) && field.kind !== "date" ? (
    <bdi dir="ltr" className={cn(CODE_KINDS.has(field.kind) ? "code" : "")}>
      {text}
    </bdi>
  ) : (
    <span dir="auto">{text}</span>
  );
}

function EditableValue({
  checkId,
  documentId,
  field,
  label,
}: {
  checkId: string;
  documentId: string;
  field: EffectiveField;
  label: string;
}) {
  const t = useTranslations("fields");
  const locale = useLocale();
  const router = useRouter();
  const errorMessage = useErrorMessage();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(field.normalized ?? "");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const editButton = useRef<HTMLButtonElement>(null);
  const hintId = useId();
  const errorId = useId();

  const close = () => {
    setEditing(false);
    setError(null);
    requestAnimationFrame(() => editButton.current?.focus());
  };

  async function save(body: { normalized: string | null; revert?: boolean }) {
    setBusy(true);
    const result = await postJson(
      `/api/checks/${checkId}/documents/${documentId}/corrections`,
      { path: field.path, ...body },
      "PUT",
    );
    setBusy(false);
    if (result.ok) {
      close();
      router.refresh();
    } else setError(errorMessage(result.error));
  }

  if (editing) {
    return (
      <form
        className="grid gap-1.5"
        onSubmit={(event) => {
          event.preventDefault();
          void save({ normalized: draft.trim() === "" ? null : draft.trim() });
        }}
        onKeyDown={(event) => {
          if (event.key === "Escape") close();
        }}
      >
        <Input
          autoFocus
          value={draft}
          dir={LTR_KINDS.has(field.kind) ? "ltr" : "auto"}
          aria-label={t("inputLabel", { field: label })}
          aria-describedby={error ? `${hintId} ${errorId}` : hintId}
          aria-invalid={error ? true : undefined}
          onChange={(event) => setDraft(event.target.value)}
        />
        <p id={hintId} className="text-caption text-slate">
          {t(`formats.${field.kind}`)} · {t("emptyMeans")}
        </p>
        {error ? (
          <p id={errorId} role="alert" className="text-small text-error-fg">
            {error}
          </p>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <Button type="submit" variant="primary" size="sm" disabled={busy}>
            {t("save")}
          </Button>
          <Button size="sm" onClick={close}>
            {t("cancel")}
          </Button>
          {field.corrected ? (
            <Button
              variant="ghost"
              size="sm"
              disabled={busy}
              onClick={() => void save({ normalized: null, revert: true })}
            >
              {t("revert")}
            </Button>
          ) : null}
        </div>
      </form>
    );
  }

  return (
    <div className="grid justify-items-start gap-1">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <Value field={field} />
        <Button
          ref={editButton}
          variant="ghost"
          size="sm"
          className="h-7 px-1.5 text-slate"
          aria-label={t("editLabel", { field: label })}
          onClick={() => {
            setDraft(field.normalized ?? "");
            setEditing(true);
          }}
        >
          <Pencil aria-hidden="true" />
          <span aria-hidden="true">{t("edit")}</span>
        </Button>
      </div>
      {field.lowConfidence ? (
        <MarkerTag kind="lowConfidence">{t("lowConfidence")}</MarkerTag>
      ) : null}
      {field.corrected ? (
        <div className="flex flex-wrap items-center gap-2">
          <MarkerTag kind="corrected">{t("corrected")}</MarkerTag>
          <span className="text-caption text-slate">
            {field.extractedNormalized === null
              ? t("extractedEmpty")
              : t("extractedWas", {
                  value: formatNormalized(field.kind, field.extractedNormalized, locale),
                })}
          </span>
        </div>
      ) : null}
    </div>
  );
}

function FieldRows({
  checkId,
  document,
  rows,
}: {
  checkId: string;
  document: FieldDocument;
  rows: { label: string; field: EffectiveField }[];
}) {
  const t = useTranslations("fields");
  const locale = useLocale();
  const percent = new Intl.NumberFormat(dataLocale(locale), { style: "percent" });
  const lang =
    document.documentLanguage && document.documentLanguage !== "und"
      ? document.documentLanguage
      : undefined;
  const columns = {
    printed: t("column.printed"),
    normalized: t("column.normalized"),
    confidence: t("column.confidence"),
    source: t("column.source"),
  };
  // Phones get stacked rows (each cell shows its column name); wider screens a table.
  // Explicit roles keep the table semantics when the display type changes.
  const cellLabel = (text: string) => (
    <span aria-hidden="true" className="block text-caption text-slate md:hidden">
      {text}
    </span>
  );
  return (
    <div className="surface md:overflow-x-auto">
      <table
        role="table"
        className="block w-full border-collapse text-start md:table md:min-w-[720px]"
      >
        <thead
          role="rowgroup"
          className="sr-only bg-ledger text-small text-slate md:not-sr-only md:table-header-group"
        >
          <tr role="row">
            <th
              role="columnheader"
              scope="col"
              className="w-[18%] px-3 py-2 text-start font-medium"
            >
              {t("column.field")}
            </th>
            <th
              role="columnheader"
              scope="col"
              className="w-[22%] px-3 py-2 text-start font-medium"
            >
              {columns.printed}
            </th>
            <th
              role="columnheader"
              scope="col"
              className="w-[26%] px-3 py-2 text-start font-medium"
            >
              {columns.normalized}
            </th>
            <th role="columnheader" scope="col" className="w-[10%] px-3 py-2 text-end font-medium">
              {columns.confidence}
            </th>
            <th role="columnheader" scope="col" className="px-3 py-2 text-start font-medium">
              {columns.source}
            </th>
          </tr>
        </thead>
        <tbody role="rowgroup" className="block md:table-row-group">
          {rows.map(({ label, field }) => (
            <tr
              key={field.path}
              role="row"
              className={cn(
                "grid gap-2 border-t border-rule px-3 py-3 align-top first:border-t-0 md:table-row md:px-0 md:py-0 md:first:border-t",
                field.lowConfidence && "bg-warning-bg/40",
              )}
            >
              <th
                role="rowheader"
                scope="row"
                className="block text-start font-medium md:table-cell md:px-3 md:py-2.5"
              >
                {label}
              </th>
              <td role="cell" className="block md:table-cell md:px-3 md:py-2.5">
                {cellLabel(columns.printed)}
                {field.value === null ? (
                  <span className="text-slate">—</span>
                ) : (
                  <span dir="auto" lang={lang}>
                    {field.value}
                  </span>
                )}
              </td>
              <td role="cell" className="block md:table-cell md:px-3 md:py-2.5">
                {cellLabel(columns.normalized)}
                <EditableValue
                  checkId={checkId}
                  documentId={document.id}
                  field={field}
                  label={label}
                />
              </td>
              <td role="cell" className="block md:table-cell md:px-3 md:py-2.5 md:text-end">
                {cellLabel(columns.confidence)}
                {field.corrected || field.normalized === null ? (
                  <span className="text-slate">—</span>
                ) : (
                  <span className={cn(field.lowConfidence && "font-medium text-warning-fg")}>
                    {field.lowConfidence ? (
                      <Gauge aria-hidden="true" className="me-1 inline size-3.5" />
                    ) : null}
                    {percent.format(field.confidence)}
                  </span>
                )}
              </td>
              <td role="cell" className="block text-small md:table-cell md:px-3 md:py-2.5">
                {cellLabel(columns.source)}
                {field.source ? (
                  <span className="grid gap-0.5">
                    <span className="text-slate">{t("page", { page: field.source.page })}</span>
                    <q dir="auto" lang={lang} className="line-clamp-2">
                      {field.source.text}
                    </q>
                  </span>
                ) : (
                  <span className="text-slate">—</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Fields that were found (or corrected) first; the rest behind one disclosure. */
function SplitFieldRows({
  checkId,
  document,
  rows,
}: {
  checkId: string;
  document: FieldDocument;
  rows: { label: string; field: EffectiveField }[];
}) {
  const t = useTranslations("fields");
  const present = rows.filter(({ field }) => field.normalized !== null || field.corrected);
  const missing = rows.filter(({ field }) => field.normalized === null && !field.corrected);
  return (
    <div className="grid gap-2">
      {present.length > 0 ? (
        <FieldRows checkId={checkId} document={document} rows={present} />
      ) : null}
      {missing.length > 0 ? (
        <details className="group surface">
          <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 px-3 py-2.5 text-slate transition-control hover:bg-ledger hover:text-carbon">
            <ChevronDown
              aria-hidden="true"
              className="size-4 transition-transform group-open:rotate-180"
            />
            {t("missingCount", { count: missing.length })}
          </summary>
          <div className="border-t border-rule">
            <FieldRows checkId={checkId} document={document} rows={missing} />
          </div>
        </details>
      ) : null}
    </div>
  );
}

export function FieldTables({ checkId, document }: { checkId: string; document: FieldDocument }) {
  const t = useTranslations("fields");
  const locale = useLocale();
  const label = (key: HeaderFieldKey | LineFieldKey) => t(`labels.${key}`);

  return (
    <div className="grid gap-4">
      <h4 className="text-title-sm font-semibold">{t("header")}</h4>
      <SplitFieldRows
        checkId={checkId}
        document={document}
        rows={HEADER_FIELD_KEYS.map((key) => ({ label: label(key), field: document.header[key] }))}
      />
      <h4 className="text-title-sm font-semibold">{t("lines")}</h4>
      {document.lines.length === 0 ? (
        <p className="text-slate">{t("noLines")}</p>
      ) : (
        <div className="grid gap-2">
          {document.lines.map((line, index) => {
            const flagged = LINE_FIELD_KEYS.some((key) => line[key].lowConfidence);
            const corrected = LINE_FIELD_KEYS.some((key) => line[key].corrected);
            return (
              <details key={index} className="group surface">
                <summary className="flex min-h-11 cursor-pointer list-none flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2.5 transition-control hover:bg-ledger">
                  <ChevronDown
                    aria-hidden="true"
                    className="size-4 text-slate transition-transform group-open:rotate-180"
                  />
                  <span className="font-medium">{t("line", { number: index + 1 })}</span>
                  <span className="min-w-0 flex-1 truncate" dir="auto">
                    {line.description.normalized ?? "—"}
                  </span>
                  {line.quantity.normalized ? (
                    <bdi dir="ltr" className="text-slate">
                      {formatNormalized("quantity", line.quantity.normalized, locale)}
                    </bdi>
                  ) : null}
                  {line.lineTotal.normalized ? (
                    <bdi dir="ltr">
                      {formatNormalized("amount", line.lineTotal.normalized, locale)}
                    </bdi>
                  ) : null}
                  {flagged ? (
                    <MarkerTag kind="lowConfidence">{t("lowConfidence")}</MarkerTag>
                  ) : null}
                  {corrected ? (
                    <span className="inline-flex items-center gap-1 text-caption text-slate">
                      <PenLine aria-hidden="true" className="size-3.5" />
                      {t("corrected")}
                    </span>
                  ) : null}
                </summary>
                <div className="border-t border-rule p-3">
                  <SplitFieldRows
                    checkId={checkId}
                    document={document}
                    rows={LINE_FIELD_KEYS.map((key) => ({ label: label(key), field: line[key] }))}
                  />
                </div>
              </details>
            );
          })}
        </div>
      )}
    </div>
  );
}
