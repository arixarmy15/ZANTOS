import { useTranslations } from "next-intl";
import { statusIcons, statusTextClasses } from "@/components/ui/tag";
import type { CheckSummary, DisplayStatus } from "@/lib/checks/present";
import { cn } from "@/lib/utils";

const ORDER: DisplayStatus[] = ["error", "warning", "unverified", "info"];

/** Findings by severity: a strip of counts, not a chart (DESIGN.md §4.4). */
export function SummaryStrip({ summary }: { summary: CheckSummary }) {
  const t = useTranslations("results");
  return (
    <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-rule bg-rule shadow-card sm:grid-cols-4">
      {ORDER.map((status) => {
        const Icon = statusIcons[status];
        const count = summary.counts[status];
        return (
          <div key={status} className="grid content-start gap-2 bg-paper px-5 py-4">
            <dt
              className={cn(
                "flex items-center gap-1.5 text-small font-medium",
                statusTextClasses[status],
              )}
            >
              <Icon aria-hidden="true" className="size-4 shrink-0" />
              {t(`counts.${status}`)}
            </dt>
            <dd className="text-page font-semibold tabular-nums text-carbon">{count}</dd>
          </div>
        );
      })}
    </dl>
  );
}
