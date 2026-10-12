"use client";

import { useTranslations } from "next-intl";
import { useId, useState } from "react";
import type { CheckSummary } from "@/lib/checks/present";
import { CATEGORY_ORDER } from "@/lib/validation/order";
import type { RuleCategory } from "@/lib/validation/types";

/**
 * Issues per check category: one series, horizontal bars in `viz-series1`, the value at
 * each bar's tip in text colour, a per-bar tooltip and a table view (DESIGN.md §4.4).
 */
export function CategoryChart({ summary }: { summary: CheckSummary }) {
  const t = useTranslations("results");
  const tc = useTranslations("findings.categories");
  const titleId = useId();
  const [hovered, setHovered] = useState<RuleCategory | null>(null);
  const counts = summary.issuesByCategory;
  const total = CATEGORY_ORDER.reduce((sum, category) => sum + counts[category], 0);
  const max = Math.max(1, ...CATEGORY_ORDER.map((category) => counts[category]));

  return (
    <figure aria-labelledby={titleId} className="grid content-start gap-3 surface p-4">
      <figcaption className="grid gap-0.5">
        <span id={titleId} className="text-title-sm font-semibold">
          {t("chartTitle")}
        </span>
        <span className="text-small text-slate">{t("chartDescription")}</span>
      </figcaption>

      {/* The table below carries the same values for assistive technology. */}
      <div aria-hidden="true" className="grid gap-2">
        {CATEGORY_ORDER.map((category) => {
          const count = counts[category];
          return (
            <div
              key={category}
              className="relative grid grid-cols-[minmax(7rem,9rem)_minmax(0,1fr)] items-center gap-3"
              onPointerEnter={() => setHovered(category)}
              onPointerLeave={() =>
                setHovered((current) => (current === category ? null : current))
              }
            >
              <span className="truncate text-small text-carbon">{tc(category)}</span>
              {/* Track: no fill; the bar grows from the inline-start baseline. */}
              <span className="flex min-h-7 items-center gap-2">
                <span
                  className="block h-5 rounded-e-sm bg-viz-series1"
                  style={{
                    inlineSize: count === 0 ? 0 : `max(3px, calc((100% - 3rem) * ${count / max}))`,
                  }}
                />
                <span className="text-small font-medium tabular-nums text-carbon">{count}</span>
              </span>
              {hovered === category ? (
                <span
                  role="presentation"
                  className="pointer-events-none absolute start-[min(10rem,40%)] -top-8 z-10 animate-popover-in rounded-sm bg-carbon px-2 py-1 text-caption whitespace-nowrap text-paper shadow-overlay"
                >
                  <strong className="font-semibold tabular-nums">{count}</strong>{" "}
                  {t("chartTooltip", { category: tc(category), total })}
                </span>
              ) : null}
            </div>
          );
        })}
      </div>

      <details className="text-small">
        <summary className="cursor-pointer text-harbor underline-offset-2 hover:underline pointer-coarse:flex pointer-coarse:min-h-11 pointer-coarse:items-center">
          {t("showTable")}
        </summary>
        <table className="mt-2 w-full border-collapse">
          <caption className="sr-only">{t("chartTitle")}</caption>
          <thead>
            <tr className="border-b border-rule text-start">
              <th scope="col" className="py-1 text-start font-medium">
                {t("tableCategory")}
              </th>
              <th scope="col" className="py-1 text-end font-medium">
                {t("tableIssues")}
              </th>
            </tr>
          </thead>
          <tbody>
            {CATEGORY_ORDER.map((category) => (
              <tr key={category} className="border-b border-rule last:border-0">
                <th scope="row" className="py-1 text-start font-normal">
                  {tc(category)}
                </th>
                <td className="py-1 text-end tabular-nums">{counts[category]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}
