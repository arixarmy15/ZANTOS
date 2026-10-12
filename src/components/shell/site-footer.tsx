import { useTranslations } from "next-intl";

export function SiteFooter() {
  const t = useTranslations("footer");
  return (
    <footer className="border-t border-rule bg-paper">
      <div className="mx-auto grid max-w-[1440px] gap-1 px-page pt-4 pb-[max(1rem,env(safe-area-inset-bottom))] text-small text-slate">
        <p className="font-medium text-carbon">{t("notice")}</p>
        <p>{t("positioning")}</p>
      </div>
    </footer>
  );
}
