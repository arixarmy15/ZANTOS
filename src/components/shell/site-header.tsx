import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { BrandMark } from "./brand-mark";
import { LanguageSwitcher, type LanguageOption } from "./language-switcher";
import { MobileMenu } from "./mobile-menu";
import { NavLinks } from "./nav-links";

export function SiteHeader({ languages }: { languages: LanguageOption[] }) {
  const t = useTranslations("nav");
  return (
    <header className="sticky top-0 z-30 border-b border-rule bg-paper print:hidden">
      <div className="mx-auto flex h-12 max-w-[1440px] items-center gap-4 px-page">
        <Link
          href="/"
          aria-label={t("home")}
          className="flex min-h-11 items-center gap-2 text-title-sm font-semibold text-carbon"
        >
          <BrandMark className="size-6" />
          <span className="font-sans" lang="en" dir="ltr">
            TradeCheck
          </span>
        </Link>
        <nav aria-label={t("main")} className="hidden flex-1 sm:block">
          <NavLinks />
        </nav>
        <LanguageSwitcher languages={languages} className="ms-auto hidden sm:flex" />
        <div className="ms-auto sm:hidden">
          <MobileMenu languages={languages} />
        </div>
      </div>
    </header>
  );
}
