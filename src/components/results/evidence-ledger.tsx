"use client";

import { FilterX, SearchX } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useId, useMemo, useState, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogTitle, SheetContent } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { RefTag, StatusTag, statusIcons } from "@/components/ui/tag";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { postJson } from "@/components/upload/upload-file";
import { useRouter } from "@/i18n/navigation";
import type { DisplayStatus, FindingView } from "@/lib/checks/present";
import { CATEGORY_ORDER } from "@/lib/validation/order";
import type { RuleCategory } from "@/lib/validation/types";
import { cn } from "@/lib/utils";
import { DocumentViewer, type ViewerDocument } from "./document-viewer";
import { FindingEntry, type Explanation } from "./finding-entry";

type Layout = "wide" | "medium" | "narrow";

const WIDE = "(min-width: 1024px)";
const MEDIUM = "(min-width: 768px)";

function subscribe(callback: () => void) {
  const queries = [window.matchMedia(WIDE), window.matchMedia(MEDIUM)];
  queries.forEach((query) => query.addEventListener("change", callback));
  return () => queries.forEach((query) => query.removeEventListener("change", callback));
}

/** DESIGN.md §7: two panes from 1024 px, tabs from 768 px, a sheet below. */
function useLayout(): Layout {
  return useSyncExternalStore(
    subscribe,
    () =>
      window.matchMedia(WIDE).matches
        ? "wide"
        : window.matchMedia(MEDIUM).matches
          ? "medium"
          : "narrow",
    () => "wide",
  );
}

const STATUS_FILTERS: DisplayStatus[] = ["error", "warning", "unverified", "info"];

export function EvidenceLedger({
  checkId,
  documents,
  findings,
  canUseAi,
  toolbar,
}: {
  checkId: string;
  documents: ViewerDocument[];
  findings: FindingView[];
  canUseAi: boolean;
  /** Check-level actions shown above the list (e-mail draft). */
  toolbar?: React.ReactNode;
}) {
  const t = useTranslations("results");
  const tc = useTranslations("findings.categories");
  const ts = useTranslations("status");
  const locale = useLocale();
  const router = useRouter();
  const layout = useLayout();
  const ids = { category: useId(), document: useId(), count: useId() };

  const [statuses, setStatuses] = useState<Set<DisplayStatus>>(new Set());
  const [category, setCategory] = useState<RuleCategory | "">("");
  const [documentFilter, setDocumentFilter] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [view, setView] = useState<{ documentId: string; page: number }>({
    documentId: documents[0]?.id ?? "",
    page: 1,
  });
  const [tab, setTab] = useState<"findings" | "documents">("findings");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [explanations, setExplanations] = useState<Record<string, Explanation>>({});

  const visible = useMemo(
    () =>
      findings.filter(
        (finding) =>
          (statuses.size === 0 || statuses.has(finding.status)) &&
          (category === "" || finding.category === category) &&
          (documentFilter === "" || finding.documentIds.includes(documentFilter)),
      ),
    [findings, statuses, category, documentFilter],
  );
  const filtered = statuses.size > 0 || category !== "" || documentFilter !== "";
  const selected = findings.find((finding) => finding.id === selectedId) ?? null;
  const counts = Object.fromEntries(
    STATUS_FILTERS.map((status) => [
      status,
      findings.filter((finding) => finding.status === status).length,
    ]),
  ) as Record<DisplayStatus, number>;

  const showInDocument = useCallback(
    (finding: FindingView) => {
      const target = finding.evidence[0];
      const documentId = target?.documentId ?? finding.documentIds[0];
      setSelectedId(finding.id);
      if (documentId && documents.some((doc) => doc.id === documentId)) {
        setView({ documentId, page: target?.page ?? 1 });
      }
      if (layout === "medium") setTab("documents");
      if (layout === "narrow") setSheetOpen(true);
    },
    [documents, layout],
  );

  // Selecting a tag in the document reveals its entry in the list.
  const selectFromDocument = useCallback(
    (findingId: string) => {
      setSelectedId(findingId);
      if (layout === "medium") setTab("findings");
      if (layout === "narrow") setSheetOpen(false);
      requestAnimationFrame(() => {
        const entry = document.querySelector<HTMLElement>(
          `[data-finding="${CSS.escape(findingId)}"]`,
        );
        if (!entry) return;
        const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        entry.scrollIntoView({ block: "nearest", behavior: reduce ? "auto" : "smooth" });
      });
    },
    [layout],
  );

  async function explain(finding: FindingView) {
    setExplanations((current) => ({ ...current, [finding.id]: { status: "loading" } }));
    const result = await postJson(`/api/checks/${checkId}/explain`, {
      findingId: finding.id,
      language: locale,
    });
    setExplanations((current) => ({
      ...current,
      [finding.id]: result.ok
        ? { status: "done", text: (result.data as { explanation: string }).explanation }
        : { status: "error", error: result.error },
    }));
    if (result.ok) router.refresh(); // token usage changed
  }

  function toggleStatus(status: DisplayStatus) {
    setStatuses((current) => {
      const next = new Set(current);
      if (next.has(status)) next.delete(status);
      else next.add(status);
      return next;
    });
  }

  const viewer =
    documents.length > 0 ? (
      <DocumentViewer
        checkId={checkId}
        documents={documents}
        documentId={view.documentId}
        page={view.page}
        findings={visible}
        selectedId={selectedId}
        onNavigate={(documentId, page) => setView({ documentId, page })}
        onSelectFinding={selectFromDocument}
      />
    ) : null;

  const list = (
    <div className="grid content-start gap-3">
      <div className="grid gap-3 border border-rule bg-paper p-3">
        <div role="group" aria-label={t("filters.status")} className="flex flex-wrap gap-2">
          {STATUS_FILTERS.map((status) => {
            const Icon = statusIcons[status];
            const pressed = statuses.has(status);
            return (
              <Button
                key={status}
                variant="secondary"
                size="sm"
                aria-pressed={pressed}
                onClick={() => toggleStatus(status)}
                className={cn(pressed && "border-harbor bg-harbor-tint")}
              >
                <Icon aria-hidden="true" />
                {ts(status)}
                <span className="tabular-nums text-slate">{counts[status]}</span>
              </Button>
            );
          })}
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="grid gap-1">
            <Label htmlFor={ids.category}>{t("filters.category")}</Label>
            <NativeSelect
              id={ids.category}
              value={category}
              onChange={(event) => setCategory(event.target.value as RuleCategory | "")}
            >
              <option value="">{t("filters.allCategories")}</option>
              {CATEGORY_ORDER.map((value) => (
                <option key={value} value={value}>
                  {tc(value)}
                </option>
              ))}
            </NativeSelect>
          </div>
          <div className="grid gap-1">
            <Label htmlFor={ids.document}>{t("filters.document")}</Label>
            <NativeSelect
              id={ids.document}
              value={documentFilter}
              onChange={(event) => setDocumentFilter(event.target.value)}
            >
              <option value="">{t("filters.allDocuments")}</option>
              {documents.map((doc) => (
                <option key={doc.id} value={doc.id}>
                  {doc.fileName}
                </option>
              ))}
            </NativeSelect>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p id={ids.count} role="status" className="text-small text-slate">
            {t("filters.showing", { shown: visible.length, total: findings.length })}
          </p>
          <div className="flex flex-wrap gap-2">
            {filtered ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setStatuses(new Set());
                  setCategory("");
                  setDocumentFilter("");
                }}
              >
                <FilterX aria-hidden="true" />
                {t("filters.reset")}
              </Button>
            ) : null}
            {toolbar}
          </div>
        </div>
      </div>

      {visible.length === 0 ? (
        <EmptyState
          icon={SearchX}
          title={t("filters.noMatch")}
          className="border border-rule bg-paper p-4"
        />
      ) : (
        <ol aria-describedby={ids.count} className="divide-y divide-rule border border-rule">
          {visible.map((finding) => (
            <li key={finding.id}>
              <FindingEntry
                finding={finding}
                selected={finding.id === selectedId}
                explanation={explanations[finding.id]}
                canExplain={canUseAi}
                onShow={
                  documents.length > 0 && finding.documentIds.length > 0
                    ? () => showInDocument(finding)
                    : null
                }
                onExplain={() => void explain(finding)}
              />
            </li>
          ))}
        </ol>
      )}
    </div>
  );

  if (layout === "medium") {
    return (
      <Tabs
        value={tab}
        onValueChange={(value) => setTab(value as typeof tab)}
        className="grid gap-4"
      >
        <TabsList>
          <TabsTrigger value="findings">{t("tabs.findings")}</TabsTrigger>
          <TabsTrigger value="documents">{t("tabs.documents")}</TabsTrigger>
        </TabsList>
        <TabsContent value="findings">{list}</TabsContent>
        {/* Kept mounted so the rendered page and the selection survive the switch. */}
        <TabsContent value="documents" forceMount className="data-[state=inactive]:hidden">
          {viewer}
        </TabsContent>
      </Tabs>
    );
  }

  if (layout === "narrow") {
    return (
      <>
        {list}
        <Dialog open={sheetOpen} onOpenChange={setSheetOpen}>
          <SheetContent
            closeLabel={t("viewer.close")}
            aria-describedby={undefined}
            className="w-full max-w-none gap-4 p-4 pt-14"
          >
            {selected ? (
              <div className="grid gap-1 border-b border-rule pb-3">
                <DialogTitle className="flex flex-wrap items-center gap-2 text-title-sm">
                  <RefTag>{selected.ref}</RefTag>
                  <StatusTag status={selected.status} />
                  <span className="sr-only">{selected.ruleTitle}</span>
                </DialogTitle>
                <p className="text-body">{selected.message}</p>
              </div>
            ) : (
              <DialogTitle className="text-title-sm">{t("tabs.documents")}</DialogTitle>
            )}
            {viewer}
          </SheetContent>
        </Dialog>
      </>
    );
  }

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
      <section
        aria-label={t("tabs.documents")}
        className="hidden lg:sticky lg:top-16 lg:block lg:max-h-[calc(100dvh-5rem)] lg:overflow-auto"
      >
        {viewer}
      </section>
      <section
        aria-label={t("tabs.findings")}
        className="lg:sticky lg:top-16 lg:max-h-[calc(100dvh-5rem)] lg:overflow-auto"
      >
        {list}
      </section>
    </div>
  );
}
