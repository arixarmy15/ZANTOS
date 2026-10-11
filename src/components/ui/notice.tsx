import type * as React from "react";
import { cn } from "@/lib/utils";
import { statusIcons, statusTextClasses, type Status } from "./tag";

const borderClasses: Record<Status, string> = {
  error: "border-s-error-fg",
  warning: "border-s-warning-fg",
  info: "border-s-info-fg",
  success: "border-s-success-fg",
  unverified: "border-s-unverified-fg",
};

/** Inline callout tied to its cause; not dismissible. */
export function Notice({
  status,
  title,
  children,
  className,
  role,
}: {
  status: Status;
  title: string;
  children?: React.ReactNode;
  className?: string;
  role?: "status" | "alert";
}) {
  const Icon = statusIcons[status];
  return (
    <div
      role={role}
      className={cn(
        "flex gap-3 border border-s-[3px] border-rule bg-paper px-4 py-3",
        borderClasses[status],
        className,
      )}
    >
      <Icon
        aria-hidden="true"
        className={cn("mt-0.5 size-4 shrink-0", statusTextClasses[status])}
      />
      <div className="grid gap-1">
        <p className="font-medium">{title}</p>
        {children ? <div className="text-slate">{children}</div> : null}
      </div>
    </div>
  );
}
