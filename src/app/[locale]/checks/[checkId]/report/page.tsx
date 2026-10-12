import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { PageContainer } from "@/components/page-header";
import { PrintButton } from "@/components/results/print-button";
import { RulesOverview } from "@/components/results/rules-overview";
import { SummaryStrip } from "@/components/results/summary-strip";
import { buttonVariants } from "@/components/ui/button";
import { RefTag, StatusTag } from "@/components/ui/tag";
import { Link } from "@/i18n/navigation";
import { requireLocale } from "@/i18n/require-locale";
import { presentCheck } from "@/lib/checks/view";
import { formatDecimal, formatTimestamp, languageName } from "@/lib/format";
import { getStorage } from "@/lib/storage";
import { CATEGORY_ORDER } from "@/lib/validation/order";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ locale: string; checkId: string }> };

async function load(checkId: string) {
  if (!/^[0-9a-f-]{36}$/.test(checkId)) return null;
  const storage = await getStorage();
  const check = await storage.getCheck(checkId);
  return check ? { storage, check } : null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "report" });
  return { title: t("title") };
}

/**
 * The check report, laid out for printing. "Save as PDF" in the print dialog produces the
 * PDF; the browser shapes every script (Arabic included) correctly, which a server-side PDF
 * library would not.
 */
export default async function ReportPage({ params }: Props) {
  const { locale, checkId } = await params;
  requireLocale(locale);
  const data = await load(checkId);
  if (!data) notFound();
  const { storage, check } = data;
  const t = await getTranslations();
  const { evaluation, findings, rules, summary } = await presentCheck(storage, check, locale);
  const usage = await storage.listUsage(checkId);
  const title = check.name ?? t("check.untitled", { date: new Date(check.createdAt) });
  const byKind = (["extract", "compare", "explain", "email"] as const)
    .map((kind) => {
      const entries = usage.filter((entry) => entry.kind === kind);
      return {
        kind,
        count: entries.length,
        input: entries.reduce((sum, entry) => sum + entry.inputTokens, 0),
        output: entries.reduce((sum, entry) => sum + entry.outputTokens, 0),
      };
    })
    .filter((row) => row.count > 0);
  const models = [...new Set(usage.map((entry) => entry.model))].join(", ");

  return (
    <PageContainer className="max-w-[960px]">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link href={`/checks/${check.id}`} className={buttonVariants({ variant: "ghost" })}>
          <ArrowLeft aria-hidden="true" className="rtl:-scale-x-100" />
          {t("report.back")}
        </Link>
        <PrintButton label={t("report.print")} />
      </div>

      <header className="grid gap-2 border-b border-rule pb-4">
        <p className="text-small font-medium text-slate">{t("report.title")}</p>
        <h1 className="text-page font-semibold" dir="auto">
          {title}
        </h1>
        <p className="flex flex-wrap gap-x-4 gap-y-1 text-small text-slate">
          <span>{t("check.created", { date: formatTimestamp(check.createdAt, locale) })}</span>
          <span>
            {t("report.generated", { date: formatTimestamp(new Date().toISOString(), locale) })}
          </span>
          <span>{t("report.tolerance", { value: formatDecimal(check.tolerance, locale) })}</span>
        </p>
      </header>

      <section aria-labelledby="disclaimer-heading" className="grid gap-1 border border-carbon p-4">
        <h2 id="disclaimer-heading" className="font-semibold">
          {t("report.disclaimerHeading")}
        </h2>
        <p>{t("footer.notice")}</p>
        <p className="text-small text-slate">{t("footer.positioning")}</p>
        <p className="text-small text-slate">{t("report.aiNote")}</p>
      </section>

      <section aria-labelledby="documents-heading" className="grid gap-2">
        <h2 id="documents-heading" className="text-title font-semibold">
          {t("report.documents")}
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse border border-rule bg-paper text-small">
            <thead>
              <tr className="border-b border-rule">
                <th scope="col" className="px-3 py-2 text-start font-medium">
                  {t("report.columns.file")}
                </th>
                <th scope="col" className="px-3 py-2 text-start font-medium">
                  {t("report.columns.type")}
                </th>
                <th scope="col" className="px-3 py-2 text-start font-medium">
                  {t("report.columns.language")}
                </th>
                <th scope="col" className="px-3 py-2 text-end font-medium">
                  {t("report.columns.pages")}
                </th>
                <th scope="col" className="px-3 py-2 text-start font-medium">
                  {t("report.columns.status")}
                </th>
              </tr>
            </thead>
            <tbody>
              {evaluation.documents.map((doc) => (
                <tr key={doc.id} className="border-b border-rule last:border-0">
                  <th scope="row" className="px-3 py-2 text-start font-normal break-all" dir="auto">
                    {doc.fileName}
                  </th>
                  <td className="px-3 py-2">
                    {t(`document.types.${doc.documentType ?? "unknown"}`)}
                  </td>
                  <td className="px-3 py-2">
                    {doc.documentLanguage && doc.documentLanguage !== "und"
                      ? languageName(doc.documentLanguage, locale)
                      : "—"}
                  </td>
                  <td className="px-3 py-2 text-end tabular-nums">{doc.pageCount ?? "—"}</td>
                  <td className="px-3 py-2">{t(`document.status.${doc.status}`)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section aria-labelledby="summary-heading" className="grid gap-3">
        <h2 id="summary-heading" className="text-title font-semibold">
          {t("report.summary")}
        </h2>
        <SummaryStrip summary={summary} />
        <table className="w-full max-w-md border-collapse border border-rule bg-paper text-small">
          <caption className="py-1 text-start text-slate">{t("results.chartTitle")}</caption>
          <tbody>
            {CATEGORY_ORDER.map((category) => (
              <tr key={category} className="border-b border-rule last:border-0">
                <th scope="row" className="px-3 py-1.5 text-start font-normal">
                  {t(`findings.categories.${category}`)}
                </th>
                <td className="px-3 py-1.5 text-end tabular-nums">
                  {summary.issuesByCategory[category]}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section aria-labelledby="findings-heading" className="grid gap-3">
        <h2 id="findings-heading" className="text-title font-semibold">
          {t("results.heading")}
        </h2>
        {summary.counts.error + summary.counts.warning + summary.counts.unverified === 0 ? (
          <p>{t("results.noIssues")}</p>
        ) : null}
        <ol className="divide-y divide-rule border border-rule bg-paper">
          {findings.map((finding) => (
            <li key={finding.id} className="grid gap-2 px-4 py-3 break-inside-avoid">
              <div className="flex flex-wrap items-center gap-2">
                <RefTag>{finding.ref}</RefTag>
                <StatusTag status={finding.status} />
                {finding.aiAssisted ? (
                  <span className="text-caption text-slate">{t("findings.aiAssisted")}</span>
                ) : null}
                <span className="text-small text-slate">{finding.ruleTitle}</span>
              </div>
              <p>{finding.message}</p>
              {finding.quotes.map((quote, index) => (
                <p key={index} className="border-s-2 border-rule ps-3 text-small">
                  <q dir="auto">{quote.text}</q>
                  <span className="text-slate">
                    {" "}
                    — <span dir="auto">{quote.documentName}</span> · {quote.fields.join(", ")}
                    {quote.page ? ` · ${t("results.finding.page", { page: quote.page })}` : null}
                  </span>
                </p>
              ))}
            </li>
          ))}
        </ol>
      </section>

      <RulesOverview rules={rules} />

      <section aria-labelledby="usage-heading" className="grid gap-2 break-inside-avoid">
        <h2 id="usage-heading" className="text-title font-semibold">
          {t("report.usage")}
        </h2>
        {byKind.length === 0 ? (
          <p className="text-slate">{t("check.usageNone")}</p>
        ) : (
          <table className="w-full max-w-xl border-collapse border border-rule bg-paper text-small">
            <caption className="py-1 text-start text-slate">{models}</caption>
            <thead>
              <tr className="border-b border-rule">
                <th scope="col" className="px-3 py-2 text-start font-medium">
                  {t("report.columns.purpose")}
                </th>
                <th scope="col" className="px-3 py-2 text-end font-medium">
                  {t("report.columns.requests")}
                </th>
                <th scope="col" className="px-3 py-2 text-end font-medium">
                  {t("report.columns.input")}
                </th>
                <th scope="col" className="px-3 py-2 text-end font-medium">
                  {t("report.columns.output")}
                </th>
              </tr>
            </thead>
            <tbody>
              {byKind.map((row) => (
                <tr key={row.kind} className="border-b border-rule last:border-0">
                  <th scope="row" className="px-3 py-2 text-start font-normal">
                    {t(`report.usageKinds.${row.kind}`)}
                  </th>
                  <td className="px-3 py-2 text-end tabular-nums">{row.count}</td>
                  <td className="px-3 py-2 text-end tabular-nums">
                    {new Intl.NumberFormat(locale).format(row.input)}
                  </td>
                  <td className="px-3 py-2 text-end tabular-nums">
                    {new Intl.NumberFormat(locale).format(row.output)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </PageContainer>
  );
}
