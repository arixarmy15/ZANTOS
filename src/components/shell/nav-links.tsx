"use client";

import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

const items = [
  {
    href: "/",
    key: "checks",
    match: (path: string) => path === "/" || /^\/checks\/(?!new)/.test(path),
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
                "flex items-center px-2 text-carbon transition-control hover:text-harbor",
                orientation === "horizontal"
                  ? "h-12 border-y-2 border-transparent aria-[current=page]:border-b-harbor"
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
