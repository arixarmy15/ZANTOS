import type * as React from "react";
import { cn } from "@/lib/utils";

/** A full-width band of the overview page with its content column and an <h2>. */
export function Section({
  id,
  title,
  lead,
  tone = "ledger",
  className,
  children,
}: {
  id: string;
  title: string;
  lead?: React.ReactNode;
  tone?: "ledger" | "paper";
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      aria-labelledby={`${id}-heading`}
      className={cn(
        "scroll-mt-14 border-b border-rule",
        tone === "paper" ? "bg-paper" : "bg-ledger",
      )}
      id={id}
    >
      <div className={cn("mx-auto grid max-w-[1200px] gap-10 px-page py-16 md:py-24", className)}>
        <div className="grid max-w-[64ch] gap-4">
          <h2 id={`${id}-heading`} className="font-display text-page md:text-display-sm">
            {title}
          </h2>
          {lead ? <p className="text-lead text-slate">{lead}</p> : null}
        </div>
        {children}
      </div>
    </section>
  );
}
