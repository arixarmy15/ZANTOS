"use client";

import { Bot, FileSearch, Sparkles } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { MarkerTag, RefTag, StatusTag } from "@/components/ui/tag";
import { useErrorMessage } from "@/components/upload/use-error-message";
import type { FindingView } from "@/lib/checks/present";
import { cn } from "@/lib/utils";

export type Explanation =
  { status: "loading" } | { status: "done"; text: string } | { status: "error"; error: string };

/** One finding as a ledger row, not a card (DESIGN.md §8). */
export function FindingEntry({
  finding,
  selected,
  explanation,
  canExplain,
  onShow,
  onExplain,
}: {
  finding: FindingView;
  selected: boolean;
  explanation: Explanation | undefined;
  canExplain: boolean;
  onShow: (() => void) | null;
  onExplain: () => void;
}) {
  const t = useTranslations("results.finding");
  const tf = useTranslations("findings");
  const errorMessage = useErrorMessage();
  const headingId = `finding-${finding.ref}`;

  return (
    <article
      aria-labelledby={headingId}
      data-finding={finding.id}
      className={cn(
        "grid gap-2 border-s-3 px-4 py-3 transition-colors duration-(--duration-fast)",
        selected ? "border-harbor bg-harbor-tint" : "border-transparent bg-paper",
      )}
    >
      <header className="flex flex-wrap items-center gap-2">
        <RefTag>{finding.ref}</RefTag>
        <StatusTag status={finding.status} />
        {finding.aiAssisted ? <MarkerTag kind="ai">{tf("aiAssisted")}</MarkerTag> : null}
        <h3 id={headingId} className="text-small text-slate">
          {finding.ruleTitle}
          {finding.rulePack ? ` · ${tf("rulePack", { id: finding.rulePack })}` : null}
        </h3>
      </header>

      <p className="text-reading">{finding.message}</p>

      {finding.quotes.length > 0 ? (
        <ul aria-label={t("evidence")} className="grid gap-1">
          {finding.quotes.map((quote, index) => (
            <li key={index} className="grid gap-0.5 border-s-2 border-rule ps-3 text-small">
              <q className="break-words text-carbon" dir="auto">
                {quote.text}
              </q>
              <span className="text-slate">
                <span dir="auto">{quote.documentName}</span> · {quote.fields.join(", ")}
                {quote.page ? ` · ${t("page", { page: quote.page })}` : null}
              </span>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {onShow ? (
          <Button variant="secondary" size="sm" onClick={onShow} aria-pressed={selected}>
            <FileSearch aria-hidden="true" />
            {t("show")}
          </Button>
        ) : null}
        {canExplain && explanation?.status !== "done" ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={onExplain}
            disabled={explanation?.status === "loading"}
          >
            <Sparkles aria-hidden="true" />
            {explanation?.status === "loading" ? t("explaining") : t("explain")}
          </Button>
        ) : null}
      </div>

      <div aria-live="polite">
        {explanation?.status === "done" ? (
          <div className="grid gap-1 rounded-sm border border-rule bg-paper p-3">
            <p className="flex items-center gap-1.5 text-caption font-medium text-slate">
              <Bot aria-hidden="true" className="size-3.5" />
              {t("aiExplanation")}
            </p>
            <p className="text-body whitespace-pre-line">{explanation.text}</p>
          </div>
        ) : null}
        {explanation?.status === "error" ? (
          <p className="text-small text-error-fg">{errorMessage(explanation.error)}</p>
        ) : null}
      </div>
    </article>
  );
}
