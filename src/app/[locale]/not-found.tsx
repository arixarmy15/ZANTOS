import { FileQuestion } from "lucide-react";
import { useTranslations } from "next-intl";
import { PageContainer, PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Link } from "@/i18n/navigation";

export default function NotFound() {
  const t = useTranslations("notFound");
  return (
    <PageContainer>
      <PageHeader title={t("title")} />
      <EmptyState
        icon={FileQuestion}
        title={t("body")}
        action={
          <Button asChild variant="secondary">
            <Link href="/">{t("back")}</Link>
          </Button>
        }
      />
    </PageContainer>
  );
}
