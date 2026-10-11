import { FileText, Plus } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { PageContainer, PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Link } from "@/i18n/navigation";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "home" });
  return { title: t("title") };
}

export default async function HomePage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("home");

  return (
    <PageContainer>
      <PageHeader title={t("title")} />
      <EmptyState
        icon={FileText}
        title={t("emptyTitle")}
        action={
          <Button asChild variant="primary">
            <Link href="/checks/new">
              <Plus aria-hidden="true" />
              {t("newCheck")}
            </Link>
          </Button>
        }
      >
        {t("emptyBody")}
      </EmptyState>
    </PageContainer>
  );
}
