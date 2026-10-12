import { useTranslations } from "next-intl";
import { BrandMark } from "./brand-mark";

export function SiteFooter() {
  const t = useTranslations("footer");
  return (
    <footer className="border-t border-rule bg-paper">
      <div className="mx-auto grid max-w-[1440px] gap-4 px-page pt-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] text-small text-slate md:grid-cols-[auto_minmax(0,1fr)] md:items-start md:gap-10">
        <p className="flex items-center gap-2 font-semibold tracking-tight text-carbon">
          <BrandMark className="size-5" />
          <span lang="en" dir="ltr">
            Tickline
          </span>
        </p>
        <div className="grid gap-1">
          <p className="font-medium text-carbon">{t("notice")}</p>
          <p>{t("positioning")}</p>
        </div>
      </div>
    </footer>
  );
}
