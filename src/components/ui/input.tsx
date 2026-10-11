import type * as React from "react";
import { cn } from "@/lib/utils";

export const controlClassName = cn(
  "h-9 w-full min-w-0 rounded-sm border border-control-border bg-paper px-2.5 text-body text-carbon",
  "transition-control placeholder:text-slate disabled:cursor-not-allowed disabled:bg-ledger",
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
