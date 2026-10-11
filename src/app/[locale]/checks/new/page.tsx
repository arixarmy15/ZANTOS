import { Upload } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
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
  setRequestLocale(locale);
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
      <div className="grid justify-items-start gap-1.5 rounded-sm border border-dashed border-control-border bg-paper p-5">
        <Upload aria-hidden="true" className="size-5 text-slate" />
        <p className="font-medium">{t("upload.dropTitle")}</p>
        <p className="text-small text-slate">
          {t("upload.limits", {
            maxMb: env.UPLOAD_MAX_FILE_MB,
            maxPages: env.UPLOAD_MAX_PAGES,
            maxFiles: env.UPLOAD_MAX_FILES_PER_CHECK,
          })}
        </p>
        <p className="text-small text-slate">
          {t("upload.privacy", { hours: env.RETENTION_HOURS })}
        </p>
      </div>
      <p className="text-slate">{t("upload.noDocuments")}</p>
    </PageContainer>
  );
}
