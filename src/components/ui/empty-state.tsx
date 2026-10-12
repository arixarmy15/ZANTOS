import type { LucideIcon } from "lucide-react";
import type * as React from "react";
import { cn } from "@/lib/utils";

// DESIGN.md §8: start-aligned, one icon, one sentence, one action. No illustrations.
export function EmptyState({
  icon: Icon,
  title,
  children,
  action,
  className,
}: {
  icon: LucideIcon;
  title: string;
  children?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("grid justify-items-start gap-2 surface px-4 py-6 sm:px-6", className)}>
      <Icon aria-hidden="true" className="size-5 text-slate" />
      <p className="font-medium">{title}</p>
      {children ? <div className="text-slate">{children}</div> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}
