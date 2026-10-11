import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { requireLocale } from "@/i18n/require-locale";
import { DeleteCheckButton } from "@/components/checks/delete-check-button";
import { DocumentsPanel, type DocumentRow } from "@/components/checks/documents-panel";
import { FieldTables } from "@/components/checks/field-tables";
import { PageContainer, PageHeader } from "@/components/page-header";
import { Notice } from "@/components/ui/notice";
import { toEffectiveDocuments } from "@/lib/checks/effective";
import { getServerEnv, isAnthropicConfigured } from "@/lib/config/env";
import { formatTimestamp } from "@/lib/format";
import { getStorage } from "@/lib/storage";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ locale: string; checkId: string }> };

async function load(checkId: string) {
  if (!/^[0-9a-f-]{36}$/.test(checkId)) return null;
  const storage = await getStorage();
  const check = await storage.getCheck(checkId);
  if (!check) return null;
  const [documents, corrections, usage] = await Promise.all([
    storage.listDocuments(checkId),
    storage.listCorrections(checkId),
    storage.listUsage(checkId),
  ]);
  return { check, documents, corrections, usage };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, checkId } = await params;
  const data = await load(checkId);
  const t = await getTranslations({ locale, namespace: "check" });
  return {
    title:
      data?.check.name ?? t("untitled", { date: new Date(data?.check.createdAt ?? Date.now()) }),
  };
}

export default async function CheckPage({ params }: Props) {
  const { locale, checkId } = await params;
  requireLocale(locale);
  const data = await load(checkId);
  if (!data) notFound();
  const { check, documents, corrections, usage } = data;
  const t = await getTranslations();
  const env = getServerEnv();
  const readingEnabled = isAnthropicConfigured(env);

  const tokens = usage.reduce(
    (sum, entry) => ({
      input: sum.input + entry.inputTokens,
      output: sum.output + entry.outputTokens,
    }),
    { input: 0, output: 0 },
  );
  const models = [...new Set(usage.map((entry) => entry.model))].join(", ");
  const rows: DocumentRow[] = documents.map((doc) => {
    const docUsage = usage.filter((entry) => entry.documentId === doc.id);
    return {
      id: doc.id,
      fileName: doc.fileName,
      size: doc.size,
      pageCount: doc.pageCount,
      status: doc.status,
      errorCode: doc.errorCode,
      documentType: doc.documentType,
      documentLanguage: doc.documentLanguage,
      inputTokens: docUsage.reduce((sum, entry) => sum + entry.inputTokens, 0),
      outputTokens: docUsage.reduce((sum, entry) => sum + entry.outputTokens, 0),
    };
  });
  const effective = toEffectiveDocuments(documents, corrections);
  const title = check.name ?? t("check.untitled", { date: new Date(check.createdAt) });

  return (
    <PageContainer>
      <PageHeader title={title} actions={<DeleteCheckButton checkId={check.id} />}>
        <p className="flex flex-wrap gap-x-4 gap-y-1 text-small">
          <span>{t("check.created", { date: formatTimestamp(check.createdAt, locale) })}</span>
          <span>{t("check.autoDelete", { date: formatTimestamp(check.expiresAt, locale) })}</span>
          <span>
            <span className="sr-only">{t("check.usageLabel")}: </span>
            {usage.length > 0
              ? t("check.usage", { model: models, input: tokens.input, output: tokens.output })
              : t("check.usageNone")}
          </span>
        </p>
      </PageHeader>

      {readingEnabled ? null : (
        <Notice status="info" title={t("permission.apiKeyMissingTitle")}>
          {t("permission.apiKeyMissingBody")}
        </Notice>
      )}

      <DocumentsPanel
        checkId={check.id}
        documents={rows}
        readingEnabled={readingEnabled}
        retentionHours={env.RETENTION_HOURS}
        limits={{
          maxMb: env.UPLOAD_MAX_FILE_MB,
          maxPages: env.UPLOAD_MAX_PAGES,
          maxFiles: env.UPLOAD_MAX_FILES_PER_CHECK,
        }}
      />

      <section aria-labelledby="extracted-heading" className="grid gap-4">
        <h2 id="extracted-heading" className="text-title font-semibold">
          {t("check.extracted")}
        </h2>
        {effective.length === 0 ? (
          <p className="text-slate">{t("check.noExtraction")}</p>
        ) : (
          effective.map((doc) => (
            <article
              key={doc.record.id}
              aria-labelledby={`doc-${doc.record.id}`}
              className="grid gap-3"
            >
              <h3
                id={`doc-${doc.record.id}`}
                className="flex flex-wrap items-baseline gap-x-3 text-title-sm font-semibold"
              >
                <span dir="auto">{doc.record.fileName}</span>
                {doc.record.documentType ? (
                  <span className="text-small font-normal text-slate">
                    {t(`document.types.${doc.record.documentType}`)}
                  </span>
                ) : null}
              </h3>
              <FieldTables
                checkId={check.id}
                document={{
                  id: doc.record.id,
                  fileName: doc.record.fileName,
                  documentLanguage: doc.record.documentLanguage,
                  header: doc.header,
                  lines: doc.lines,
                }}
              />
            </article>
          ))
        )}
      </section>
    </PageContainer>
  );
}
