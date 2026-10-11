import { useTranslations } from "next-intl";

export function SiteFooter() {
  const t = useTranslations("footer");
  return (
    <footer className="border-t border-rule bg-paper">
      <div className="mx-auto grid max-w-[1440px] gap-1 px-4 py-4 text-small text-slate md:px-6 xl:px-8">
        <p className="font-medium text-carbon">{t("notice")}</p>
        <p>{t("positioning")}</p>
      </div>
    </footer>
  );
}
