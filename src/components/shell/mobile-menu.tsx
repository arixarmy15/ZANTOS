"use client";

import { Menu } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogTitle, DialogTrigger, SheetContent } from "@/components/ui/dialog";
import { LanguageSwitcher, type LanguageOption } from "./language-switcher";
import { NavLinks } from "./nav-links";

export function MobileMenu({ languages }: { languages: LanguageOption[] }) {
  const t = useTranslations("nav");
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" className="min-h-11 sm:hidden">
          <Menu aria-hidden="true" />
          {t("menu")}
        </Button>
      </DialogTrigger>
      <SheetContent closeLabel={t("closeMenu")} aria-describedby={undefined}>
        <DialogTitle>{t("menu")}</DialogTitle>
        <nav aria-label={t("main")}>
          <NavLinks orientation="vertical" onNavigate={() => setOpen(false)} />
        </nav>
        <LanguageSwitcher languages={languages} className="flex-col items-start" />
      </SheetContent>
    </Dialog>
  );
}
