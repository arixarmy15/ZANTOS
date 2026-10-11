import type * as React from "react";
import { cn } from "@/lib/utils";

/** Content column with the page's single <h1>. */
export function PageContainer({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "mx-auto grid max-w-[1440px] gap-6 px-4 py-6 md:px-6 md:py-8 xl:px-8",
        className,
      )}
      {...props}
    />
  );
}

export function PageHeader({
  title,
  children,
  actions,
}: {
  title: string;
  children?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="grid max-w-[72ch] gap-2">
        <h1 className="text-heading font-semibold md:text-page">{title}</h1>
        {children ? <div className="text-reading text-slate">{children}</div> : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}
