import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { requireLocale } from "@/i18n/require-locale";
import { NewCheckForm } from "@/components/checks/new-check-form";
import { PageContainer, PageHeader } from "@/components/page-header";
import { Notice } from "@/components/ui/notice";
import { getServerEnv, isAnthropicConfigured } from "@/lib/config/env";

// Reads server configuration (API key, limits) at request time, not at build time.
export const dynamic = "force-dynamic";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "newCheck" });
  return { title: t("title") };
}

export default async function NewCheckPage({ params }: Props) {
  const { locale } = await params;
  requireLocale(locale);
  const t = await getTranslations();
  const env = getServerEnv();

  return (
    <PageContainer>
      <PageHeader title={t("newCheck.title")}>{t("newCheck.intro")}</PageHeader>
      {isAnthropicConfigured(env) ? null : (
        <Notice status="info" title={t("permission.apiKeyMissingTitle")}>
          {t("permission.apiKeyMissingBody")}
        </Notice>
      )}
      <NewCheckForm
        retentionHours={env.RETENTION_HOURS}
        limits={{
          maxMb: env.UPLOAD_MAX_FILE_MB,
          maxPages: env.UPLOAD_MAX_PAGES,
          maxFiles: env.UPLOAD_MAX_FILES_PER_CHECK,
        }}
      />
    </PageContainer>
  );
}
