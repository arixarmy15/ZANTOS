import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { BrandMark } from "./brand-mark";
import { LanguageSwitcher, type LanguageOption } from "./language-switcher";
import { MobileMenu } from "./mobile-menu";
import { NavLinks } from "./nav-links";

export function SiteHeader({ languages }: { languages: LanguageOption[] }) {
  const t = useTranslations("nav");
  return (
    <header className="sticky top-0 z-30 border-b border-rule/80 bg-paper/80 backdrop-blur-xl backdrop-saturate-150 print:hidden">
      <div className="mx-auto flex h-14 max-w-[1440px] items-center gap-6 px-page">
        <Link
          href="/"
          aria-label={t("home")}
          className="flex min-h-11 items-center gap-2.5 text-title font-semibold tracking-tight text-carbon"
        >
          <span className="grid size-8 place-items-center rounded-sm border border-rule bg-paper shadow-xs">
            <BrandMark className="size-5" />
          </span>
          <span className="font-sans" lang="en" dir="ltr">
            Tickline
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
