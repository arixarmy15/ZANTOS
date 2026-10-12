import { CircleMinus } from "lucide-react";
import { useTranslations } from "next-intl";
import { statusIcons, statusTextClasses, type Status } from "@/components/ui/tag";
import type { RuleView } from "@/lib/checks/present";
import { CATEGORY_ORDER } from "@/lib/validation/order";
import type { RuleStatus } from "@/lib/validation/types";
import { cn } from "@/lib/utils";

const STATUS_DISPLAY: Record<Exclude<RuleStatus, "not_applicable">, Status> = {
  passed: "success",
  failed: "error",
  unverified: "unverified",
};

/** The list of checks that ran, so "no findings" always says what was checked. */
export function RulesOverview({
  rules,
  children,
}: {
  rules: RuleView[];
  children?: React.ReactNode;
}) {
  const t = useTranslations("results");
  const tf = useTranslations("findings");
  const counts = {
    passed: rules.filter((rule) => rule.status === "passed").length,
    failed: rules.filter((rule) => rule.status === "failed").length,
    unverified: rules.filter((rule) => rule.status === "unverified").length,
    notApplicable: rules.filter((rule) => rule.status === "not_applicable").length,
  };
  return (
    <section aria-labelledby="rules-heading" className="grid gap-3">
      <div className="grid gap-1">
        <h2 id="rules-heading" className="text-title font-semibold">
          {t("rulesHeading")}
        </h2>
        <p className="text-small text-slate">{t("rulesSummary", counts)}</p>
      </div>
      {children}
      <div className="grid gap-4 md:grid-cols-2">
        {CATEGORY_ORDER.map((category) => {
          const inCategory = rules.filter((rule) => rule.category === category);
          if (inCategory.length === 0) return null;
          return (
            <div key={category} className="grid content-start gap-1">
              <h3 className="text-small font-semibold text-slate">
                {tf(`categories.${category}`)}
              </h3>
              <ul className="divide-y divide-rule overflow-hidden surface">
                {inCategory.map((rule) => {
                  const display =
                    rule.status === "not_applicable" ? null : STATUS_DISPLAY[rule.status];
                  const Icon = display ? statusIcons[display] : CircleMinus;
                  return (
                    <li
                      key={`${rule.rulePack ?? "core"}:${rule.ruleId}`}
                      className="flex items-start justify-between gap-3 px-3 py-2 text-small"
                    >
                      <span className="min-w-0">
                        {rule.title}
                        {rule.rulePack ? (
                          <span className="ms-2 text-slate">
                            {tf("rulePack", { id: rule.rulePack })}
                          </span>
                        ) : null}
                      </span>
                      <span
                        className={cn(
                          "flex shrink-0 items-center gap-1 font-medium",
                          display ? statusTextClasses[display] : "text-slate",
                        )}
                      >
                        <Icon aria-hidden="true" className="size-4" />
                        {tf(`ruleStatus.${rule.status}`)}
                        {rule.findingCount > 0 && rule.status !== "passed" ? (
                          <span className="font-normal text-slate">
                            {" "}
                            · {t("ruleFindings", { count: rule.findingCount })}
                          </span>
                        ) : null}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </div>
    </section>
  );
}
