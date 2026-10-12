"use client";

import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

const items = [
  { href: "/", key: "overview", match: (path: string) => path === "/" },
  {
    href: "/checks",
    key: "checks",
    match: (path: string) => path === "/checks" || /^\/checks\/(?!new)/.test(path),
  },
  { href: "/checks/new", key: "newCheck", match: (path: string) => path === "/checks/new" },
] as const;

export function NavLinks({
  orientation = "horizontal",
  onNavigate,
}: {
  orientation?: "horizontal" | "vertical";
  onNavigate?: () => void;
}) {
  const t = useTranslations("nav");
  const pathname = usePathname();
  return (
    <ul className={cn("flex", orientation === "horizontal" ? "gap-1" : "flex-col gap-1")}>
      {items.map((item) => {
        const current = item.match(pathname);
        return (
          <li key={item.key}>
            <Link
              href={item.href}
              onClick={onNavigate}
              aria-current={current ? "page" : undefined}
              className={cn(
                "flex items-center px-3 font-medium text-slate transition-control hover:text-carbon",
                orientation === "horizontal"
                  ? "h-9 rounded-sm hover:bg-ledger aria-[current=page]:bg-ledger aria-[current=page]:text-carbon"
                  : "min-h-11 border-s-[3px] border-transparent ps-3 aria-[current=page]:border-s-harbor aria-[current=page]:bg-harbor-tint",
              )}
            >
              {t(item.key)}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
