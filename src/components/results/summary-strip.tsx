import { useTranslations } from "next-intl";
import { statusIcons, statusTextClasses } from "@/components/ui/tag";
import type { CheckSummary, DisplayStatus } from "@/lib/checks/present";
import { cn } from "@/lib/utils";

const ORDER: DisplayStatus[] = ["error", "warning", "unverified", "info"];

/** Findings by severity: a strip of counts, not a chart (DESIGN.md §4.4). */
export function SummaryStrip({ summary }: { summary: CheckSummary }) {
  const t = useTranslations("results");
  return (
    <dl className="grid grid-cols-2 gap-px border border-rule bg-rule sm:grid-cols-4">
      {ORDER.map((status) => {
        const Icon = statusIcons[status];
        const count = summary.counts[status];
        return (
          <div key={status} className="grid gap-1 bg-paper px-4 py-3">
            <dt
              className={cn(
                "flex items-center gap-1.5 text-small font-medium",
                statusTextClasses[status],
              )}
            >
              <Icon aria-hidden="true" className="size-4 shrink-0" />
              {t(`counts.${status}`)}
            </dt>
            <dd className="text-heading font-semibold tabular-nums text-carbon">{count}</dd>
          </div>
        );
      })}
    </dl>
  );
}
