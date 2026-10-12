import { ChevronRight, FileText, Plus } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { requireLocale } from "@/i18n/require-locale";
import { PageContainer, PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Link } from "@/i18n/navigation";
import { dataLocale, formatTimestamp } from "@/lib/format";
import { getStorage } from "@/lib/storage";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "home" });
  return { title: t("title") };
}

export default async function ChecksPage({ params }: Props) {
  const { locale } = await params;
  requireLocale(locale);
  const t = await getTranslations();
  const checks = await (await getStorage()).listChecks();
  const number = new Intl.NumberFormat(dataLocale(locale));

  const newCheck = (
    <Button asChild variant="primary">
      <Link href="/checks/new">
        <Plus aria-hidden="true" />
        {t("home.newCheck")}
      </Link>
    </Button>
  );

  return (
    <PageContainer>
      <PageHeader title={t("home.title")} actions={checks.length > 0 ? newCheck : undefined} />
      {checks.length === 0 ? (
        <EmptyState icon={FileText} title={t("home.emptyTitle")} action={newCheck}>
          {t("home.emptyBody")}
        </EmptyState>
      ) : (
        <>
          {/* Phones: one tappable row per check instead of a wide table. */}
          <ul
            aria-label={t("home.listCaption")}
            className="divide-y divide-rule border border-rule bg-paper md:hidden"
          >
            {checks.map((check) => (
              <li
                key={check.id}
                className="relative grid gap-1 px-4 py-3 transition-control hover:bg-ledger active:bg-ledger"
              >
                <span className="flex items-center justify-between gap-3">
                  <Link
                    href={`/checks/${check.id}`}
                    className="font-medium text-harbor after:absolute after:inset-0 after:content-['']"
                  >
                    {check.name ?? t("check.untitled", { date: new Date(check.createdAt) })}
                  </Link>
                  <ChevronRight
                    aria-hidden="true"
                    className="size-4 shrink-0 text-slate rtl:-scale-x-100"
                  />
                </span>
                <span className="text-small text-slate">
                  {t("check.created", { date: formatTimestamp(check.createdAt, locale) })}
                </span>
                <span className="flex flex-wrap gap-x-3 text-small text-slate">
                  <span>{t("home.documentCount", { count: check.documentCount })}</span>
                  <span>
                    {t("home.tokenCount", { count: check.inputTokens + check.outputTokens })}
                  </span>
                </span>
                <span className="text-small text-slate">
                  {t("check.autoDelete", { date: formatTimestamp(check.expiresAt, locale) })}
                </span>
              </li>
            ))}
          </ul>
          <div
            role="region"
            aria-label={t("home.listCaption")}
            tabIndex={0}
            className="hidden overflow-x-auto border border-rule bg-paper md:block"
          >
            <table className="w-full min-w-[640px] border-collapse">
              <caption className="sr-only">{t("home.listCaption")}</caption>
              <thead className="bg-ledger text-small text-slate">
                <tr>
                  <th scope="col" className="px-4 py-2 text-start font-medium">
                    {t("home.columns.check")}
                  </th>
                  <th scope="col" className="px-4 py-2 text-start font-medium">
                    {t("home.columns.created")}
                  </th>
                  <th scope="col" className="px-4 py-2 text-end font-medium">
                    {t("home.columns.documents")}
                  </th>
                  <th scope="col" className="px-4 py-2 text-end font-medium">
                    {t("home.columns.tokens")}
                  </th>
                  <th scope="col" className="px-4 py-2 text-start font-medium">
                    {t("home.columns.deletes")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {checks.map((check) => (
                  <tr
                    key={check.id}
                    className="border-t border-rule transition-control hover:bg-ledger"
                  >
                    <th scope="row" className="px-4 py-2.5 text-start font-medium">
                      <Link
                        href={`/checks/${check.id}`}
                        className="text-harbor underline-offset-2 hover:underline"
                      >
                        {check.name ?? t("check.untitled", { date: new Date(check.createdAt) })}
                      </Link>
                    </th>
                    <td className="px-4 py-2.5">{formatTimestamp(check.createdAt, locale)}</td>
                    <td className="px-4 py-2.5 text-end">{number.format(check.documentCount)}</td>
                    <td className="px-4 py-2.5 text-end">
                      {number.format(check.inputTokens + check.outputTokens)}
                    </td>
                    <td className="px-4 py-2.5 text-slate">
                      {formatTimestamp(check.expiresAt, locale)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </PageContainer>
  );
}
