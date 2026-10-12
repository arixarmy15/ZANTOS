import { FileText } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { DeleteCheckButton } from "@/components/checks/delete-check-button";
import { DocumentsPanel, type DocumentRow } from "@/components/checks/documents-panel";
import { FieldTables } from "@/components/checks/field-tables";
import { PageContainer, PageHeader } from "@/components/page-header";
import { CategoryChart } from "@/components/results/category-chart";
import { CompareNotice } from "@/components/results/compare-notice";
import { EmailDraft } from "@/components/results/email-draft";
import { EvidenceLedger } from "@/components/results/evidence-ledger";
import { RulesOverview } from "@/components/results/rules-overview";
import { SummaryStrip } from "@/components/results/summary-strip";
import { ToleranceForm } from "@/components/results/tolerance-form";
import { buttonVariants } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";
import { Link } from "@/i18n/navigation";
import { requireLocale } from "@/i18n/require-locale";
import { routing } from "@/i18n/routing";
import { emailIssues } from "@/lib/assist/prompts";
import { presentCheck } from "@/lib/checks/view";
import { getServerEnv, isTaskConfigured, resolveRoute } from "@/lib/config/env";
import { formatTimestamp } from "@/lib/format";
import { getStorage } from "@/lib/storage";
import type { DocumentRecord } from "@/lib/storage/types";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ locale: string; checkId: string }> };

async function load(checkId: string) {
  if (!/^[0-9a-f-]{36}$/.test(checkId)) return null;
  const storage = await getStorage();
  const check = await storage.getCheck(checkId);
  if (!check) return null;
  return { storage, check, usage: await storage.listUsage(checkId) };
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

/** Languages offered for the e-mail draft: the documents' own languages first. */
function emailLanguages(documents: DocumentRecord[], issueDocumentIds: string[], locale: string) {
  const known = (tag: string | null): tag is string => tag !== null && tag !== "und";
  const involved = documents
    .filter((doc) => issueDocumentIds.includes(doc.id))
    .map((doc) => doc.documentLanguage);
  const all = documents.map((doc) => doc.documentLanguage);
  const languages = [
    ...new Set([...involved.filter(known), ...all.filter(known), ...routing.locales]),
  ];
  return { languages, defaultLanguage: involved.find(known) ?? all.find(known) ?? locale };
}

export default async function CheckPage({ params }: Props) {
  const { locale, checkId } = await params;
  requireLocale(locale);
  const data = await load(checkId);
  if (!data) notFound();
  const { storage, check, usage } = data;
  const t = await getTranslations();
  const env = getServerEnv();
  // Each AI feature can run on its own provider and model (README: AI providers).
  const ai = {
    extract: isTaskConfigured(env, "extract"),
    compare: isTaskConfigured(env, "compare"),
    explain: isTaskConfigured(env, "explain"),
    email: isTaskConfigured(env, "email"),
  };
  const readingModel = resolveRoute(env, "extract").model ?? "";
  const { evaluation, findings, rules, summary } = await presentCheck(storage, check, locale);
  const { documents, effective, pending } = evaluation;

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
  const title = check.name ?? t("check.untitled", { date: new Date(check.createdAt) });
  const issues = emailIssues(findings);
  const email = emailLanguages(
    documents,
    [...new Set(issues.flatMap((issue) => issue.documentIds))],
    locale,
  );
  const hasResults = effective.length > 0;

  return (
    <PageContainer>
      <PageHeader
        title={title}
        actions={
          <>
            {hasResults ? (
              <Link
                href={`/checks/${check.id}/report`}
                className={buttonVariants({ variant: "secondary" })}
              >
                <FileText aria-hidden="true" />
                {t("report.open")}
              </Link>
            ) : null}
            <DeleteCheckButton checkId={check.id} />
          </>
        }
      >
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

      {hasResults ? (
        // Phones and tablets: the page is long, so its sections are one tap away.
        <nav
          aria-label={t("results.jump.label")}
          className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 lg:hidden"
        >
          {(
            [
              ["results-heading", "findings"],
              ["documents-heading", "documents"],
              ["rules-heading", "rules"],
              ["extracted-heading", "data"],
            ] as const
          ).map(([target, label]) => (
            <a
              key={target}
              href={`#${target}`}
              className={buttonVariants({
                variant: "secondary",
                size: "sm",
                className: "shrink-0",
              })}
            >
              {t(`results.jump.${label}`)}
            </a>
          ))}
        </nav>
      ) : null}

      {ai.extract ? null : (
        <Notice status="info" title={t("permission.apiKeyMissingTitle")}>
          {t("permission.apiKeyMissingBody")}
        </Notice>
      )}

      {hasResults ? (
        <section aria-labelledby="results-heading" className="grid gap-4">
          <div className="grid gap-1">
            <h2 id="results-heading" className="text-title font-semibold">
              {t("results.heading")}
            </h2>
            <p className="text-small text-slate">{t("footer.notice")}</p>
          </div>
          <div className="grid items-start gap-4 lg:grid-cols-2">
            <div className="grid gap-3">
              <SummaryStrip summary={summary} />
              {summary.counts.error + summary.counts.warning + summary.counts.unverified === 0 ? (
                <Notice status="success" title={t("results.noIssues")} />
              ) : null}
            </div>
            <CategoryChart summary={summary} />
          </div>
          {pending.length > 0 ? (
            <CompareNotice checkId={check.id} pending={pending.length} enabled={ai.compare} />
          ) : null}
          <EvidenceLedger
            checkId={check.id}
            documents={effective.map((doc) => ({
              id: doc.record.id,
              fileName: doc.record.fileName,
              mimeType: doc.record.mimeType,
              pageCount: doc.record.pageCount,
            }))}
            findings={findings}
            canUseAi={ai.explain}
            toolbar={
              <EmailDraft
                checkId={check.id}
                languages={email.languages}
                defaultLanguage={email.defaultLanguage}
                issueCount={issues.length}
                enabled={ai.email}
              />
            }
          />
        </section>
      ) : null}

      <DocumentsPanel
        checkId={check.id}
        documents={rows}
        readingEnabled={ai.extract}
        readingModel={readingModel}
        retentionHours={env.RETENTION_HOURS}
        limits={{
          maxMb: env.UPLOAD_MAX_FILE_MB,
          maxPages: env.UPLOAD_MAX_PAGES,
          maxFiles: env.UPLOAD_MAX_FILES_PER_CHECK,
        }}
      />

      {hasResults ? (
        <RulesOverview rules={rules}>
          <ToleranceForm checkId={check.id} tolerance={check.tolerance} />
        </RulesOverview>
      ) : null}

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
