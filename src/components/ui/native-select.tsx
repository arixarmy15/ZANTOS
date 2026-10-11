import { ChevronDown } from "lucide-react";
import type * as React from "react";
import { cn } from "@/lib/utils";
import { controlClassName } from "./input";

// A styled native <select>: fully keyboard and screen-reader accessible, and it uses the
// platform picker on phones.
export function NativeSelect({ className, ...props }: React.ComponentProps<"select">) {
  return (
    <span className="relative inline-flex w-full">
      <select
        data-slot="native-select"
        className={cn(controlClassName, "cursor-pointer appearance-none pe-8", className)}
        {...props}
      />
      <ChevronDown
        aria-hidden="true"
        className="pointer-events-none absolute end-2.5 top-1/2 size-4 -translate-y-1/2 text-slate"
      />
    </span>
  );
}
