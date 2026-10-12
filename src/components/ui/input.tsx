import type * as React from "react";
import { cn } from "@/lib/utils";

export const controlClassName = cn(
  "h-9 w-full min-w-0 rounded-sm border border-control-border bg-paper px-3 text-body text-carbon shadow-xs pointer-coarse:h-11",
  "transition-control placeholder:text-slate hover:border-slate focus-visible:border-harbor focus-visible:ring-4 focus-visible:ring-harbor/15 disabled:cursor-not-allowed disabled:bg-ledger",
  "aria-invalid:border-error-fg",
);

export function Input({ className, ...props }: React.ComponentProps<"input">) {
  return <input data-slot="input" className={cn(controlClassName, className)} {...props} />;
}

export function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(controlClassName, "h-auto min-h-24 py-2 text-reading", className)}
      {...props}
    />
  );
}
