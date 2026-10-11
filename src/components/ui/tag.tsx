import {
  Bot,
  CircleCheck,
  CircleHelp,
  Gauge,
  Info,
  OctagonAlert,
  PenLine,
  TriangleAlert,
  type LucideIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";
import type * as React from "react";
import { cn } from "@/lib/utils";

export type Status = "error" | "warning" | "info" | "success" | "unverified";

// DESIGN.md §4.2: every status has a shape-distinct icon and a text label.
export const statusIcons: Record<Status, LucideIcon> = {
  error: OctagonAlert,
  warning: TriangleAlert,
  info: Info,
  success: CircleCheck,
  unverified: CircleHelp,
};

const statusClasses: Record<Status, string> = {
  error: "border-error-border bg-error-bg text-error-fg",
  warning: "border-warning-border bg-warning-bg text-warning-fg",
  info: "border-info-border bg-info-bg text-info-fg",
  success: "border-success-border bg-success-bg text-success-fg",
  unverified: "border-dashed border-unverified-border bg-unverified-bg text-unverified-fg",
};

export const statusTextClasses: Record<Status, string> = {
  error: "text-error-fg",
  warning: "text-warning-fg",
  info: "text-info-fg",
  success: "text-success-fg",
  unverified: "text-unverified-fg",
};

const tagBase =
  "inline-flex min-h-5 items-center gap-1 rounded-xs border px-1.5 text-caption font-medium whitespace-nowrap [&_svg]:size-3.5 [&_svg]:shrink-0";

export function Tag({ className, ...props }: React.ComponentProps<"span">) {
  return <span className={cn(tagBase, "border-rule bg-paper text-carbon", className)} {...props} />;
}

export function StatusTag({
  status,
  label,
  className,
}: {
  status: Status;
  label?: string;
  className?: string;
}) {
  const t = useTranslations("status");
  const Icon = statusIcons[status];
  return (
    <span className={cn(tagBase, statusClasses[status], className)}>
      <Icon aria-hidden="true" />
      {label ?? t(status)}
    </span>
  );
}

/** Finding reference tag such as `F3` (DESIGN.md §8). */
export function RefTag({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span className={cn(tagBase, "code border-rule bg-paper text-carbon", className)} {...props} />
  );
}

const markerIcons = { lowConfidence: Gauge, corrected: PenLine, ai: Bot } as const;

/** Field and content markers (DESIGN.md §4.3). */
export function MarkerTag({
  kind,
  children,
  className,
}: {
  kind: keyof typeof markerIcons;
  children: React.ReactNode;
  className?: string;
}) {
  const Icon = markerIcons[kind];
  return (
    <span
      className={cn(
        tagBase,
        kind === "lowConfidence"
          ? "border-warning-border bg-warning-bg text-warning-fg"
          : "border-rule bg-paper text-carbon",
        className,
      )}
    >
      <Icon aria-hidden="true" />
      {children}
    </span>
  );
}
