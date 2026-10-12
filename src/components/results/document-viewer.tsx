"use client";

import { ChevronLeft, ChevronRight, LoaderCircle, ZoomIn, ZoomOut } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { RefTag, statusIcons, statusTextClasses } from "@/components/ui/tag";
import { useMediaQuery } from "@/components/ui/use-media-query";
import type { EvidenceView, FindingView } from "@/lib/checks/present";
import { locateEvidence, type Box, type TextRun } from "@/lib/evidence/locate";
import { dataLocale } from "@/lib/format";
import { cn } from "@/lib/utils";

export type ViewerDocument = {
  id: string;
  fileName: string;
  mimeType: string;
  pageCount: number | null;
};

// The legacy build carries polyfills for JavaScript features that office browsers a few
// versions old do not have yet (for example Map.prototype.getOrInsertComputed).
type PdfModule = typeof import("pdfjs-dist/legacy/build/pdf.mjs");
type PdfDocument = Awaited<ReturnType<PdfModule["getDocument"]>["promise"]>;

let pdfjsPromise: Promise<PdfModule> | null = null;
const documentCache = new Map<string, Promise<PdfDocument>>();

function loadPdfjs(): Promise<PdfModule> {
  pdfjsPromise ??= import("pdfjs-dist/legacy/build/pdf.mjs").then((pdfjs) => {
    pdfjs.GlobalWorkerOptions.workerSrc = new URL(
      "pdfjs-dist/legacy/build/pdf.worker.min.mjs",
      import.meta.url,
    ).toString();
    return pdfjs;
  });
  return pdfjsPromise;
}

function loadDocument(url: string): Promise<PdfDocument> {
  let cached = documentCache.get(url);
  if (!cached) {
    // The PDF is untrusted input: no XFA forms; PDF.js 5 runs no document scripts here.
    cached = loadPdfjs().then((pdfjs) => pdfjs.getDocument({ url, enableXfa: false }).promise);
    cached.catch(() => documentCache.delete(url));
    documentCache.set(url, cached);
  }
  return cached;
}

type Rendered = { runs: TextRun[]; width: number; height: number; pageCount: number };
type LoadState = { status: "loading" } | { status: "error" } | ({ status: "ready" } & Rendered);

/** Renders one PDF page into the returned canvas and reads its text positions. */
function usePageRender(isPdf: boolean, url: string, page: number, width: number) {
  const canvas = useRef<HTMLCanvasElement>(null);
  // Results are tagged with what they rendered, so a stale result reads as "loading".
  const [result, setResult] = useState<{ key: string; state: LoadState } | null>(null);
  const key = `${url}#${page}@${width}`;

  useEffect(() => {
    if (!isPdf || width <= 0) return;
    let cancelled = false;
    let task: { cancel: () => void; promise: Promise<void> } | null = null;
    (async () => {
      const pdfjs = await loadPdfjs();
      const pdf = await loadDocument(url);
      const pdfPage = await pdf.getPage(Math.min(page, pdf.numPages));
      const element = canvas.current;
      if (cancelled || !element) return;
      const base = pdfPage.getViewport({ scale: 1 });
      const viewport = pdfPage.getViewport({ scale: width / base.width });
      const ratio = window.devicePixelRatio || 1;
      element.width = Math.floor(viewport.width * ratio);
      element.height = Math.floor(viewport.height * ratio);
      element.style.inlineSize = `${viewport.width}px`;
      element.style.blockSize = `${viewport.height}px`;
      task = pdfPage.render({
        canvas: element,
        viewport,
        transform: ratio === 1 ? undefined : [ratio, 0, 0, ratio, 0, 0],
      });
      await task.promise;
      const content = await pdfPage.getTextContent();
      const runs: TextRun[] = [];
      for (const item of content.items) {
        if (!("str" in item) || !item.str.trim()) continue;
        const transform = pdfjs.Util.transform(viewport.transform, item.transform);
        const height = Math.hypot(transform[2]!, transform[3]!);
        runs.push({
          text: item.str,
          x: transform[4]!,
          y: transform[5]! - height,
          width: item.width * viewport.scale,
          height,
        });
      }
      if (!cancelled) {
        setResult({
          key,
          state: {
            status: "ready",
            runs,
            width: viewport.width,
            height: viewport.height,
            pageCount: pdf.numPages,
          },
        });
      }
    })().catch((error: unknown) => {
      if (cancelled || (error instanceof Error && error.name === "RenderingCancelledException"))
        return;
      setResult({ key, state: { status: "error" } });
    });
    return () => {
      cancelled = true;
      task?.cancel();
    };
  }, [isPdf, url, page, width, key]);

  const state: LoadState = result?.key === key ? result.state : { status: "loading" };
  return { canvas, state };
}

/** Zoom steps; a phone renders a whole page about 280 px wide, too small to read evidence. */
const ZOOMS = [1, 1.5, 2, 3] as const;

type Placed = { finding: FindingView; evidence: EvidenceView; boxes: Box[] | null };

/**
 * One page of one document with the evidence ledger's marks: a wash over located evidence,
 * a bracket in the margin and the finding tag beside it (DESIGN.md §8). Evidence that cannot
 * be located is listed above the page as "Exact position not available".
 */
export function DocumentViewer({
  checkId,
  documents,
  documentId,
  page,
  findings,
  selectedId,
  onNavigate,
  onSelectFinding,
}: {
  checkId: string;
  documents: ViewerDocument[];
  documentId: string;
  page: number;
  findings: FindingView[];
  selectedId: string | null;
  onNavigate: (documentId: string, page: number) => void;
  onSelectFinding: (findingId: string) => void;
}) {
  const t = useTranslations("results.viewer");
  const ts = useTranslations("status");
  const document = documents.find((doc) => doc.id === documentId) ?? documents[0]!;
  const url = `/api/checks/${checkId}/documents/${document.id}/file`;
  const isPdf = document.mimeType === "application/pdf";
  const locale = useLocale();
  const coarse = useMediaQuery("(pointer: coarse)");
  const pageArea = useRef<HTMLDivElement>(null);
  const [areaWidth, setAreaWidth] = useState(0);
  const [zoom, setZoom] = useState<(typeof ZOOMS)[number]>(1);
  const [image, setImage] = useState<{ width: number; height: number } | null>(null);
  const selectId = `viewer-doc-${checkId}`;

  // The page area itself is measured (not the row with the tag margin), and the page is drawn
  // at exactly that width times the zoom, so evidence boxes and the drawn text always line up.
  useEffect(() => {
    const element = pageArea.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      const next = Math.floor(entry!.contentRect.width);
      setAreaWidth((current) => (Math.abs(current - next) > 8 ? next : current));
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  // 2 px for the page border.
  const renderWidth = areaWidth > 0 ? Math.floor((areaWidth - 2) * zoom) : 0;

  const { canvas, state: pdf } = usePageRender(isPdf, url, page, renderWidth);
  const pageCount = (pdf.status === "ready" ? pdf.pageCount : document.pageCount) ?? 1;
  const ready = isPdf ? pdf.status === "ready" : image !== null;

  const placed = useMemo<Placed[]>(() => {
    if (!ready) return [];
    const runs = pdf.status === "ready" ? pdf.runs : [];
    return findings.flatMap((finding) =>
      finding.evidence
        .filter(
          (item) =>
            item.documentId === document.id &&
            (item.page === page || (item.page === null && page === 1)),
        )
        .map((item) => ({
          finding,
          evidence: item,
          boxes: isPdf ? locateEvidence(runs, item) : null,
        })),
    );
  }, [ready, pdf, findings, document.id, page, isPdf]);

  const located = placed.filter((item) => item.boxes !== null);
  const unlocated = placed.filter((item) => item.boxes === null);

  // Scroll the selected finding's mark into view; jump instead of animating under reduced motion.
  const markRefs = useRef(new Map<string, HTMLElement>());
  // The first mark of a finding on this page is its scroll target; detached marks drop out.
  const registerMark = (findingId: string) => (element: HTMLElement | null) => {
    if (!element || markRefs.current.has(findingId)) return;
    markRefs.current.set(findingId, element);
    return () => {
      if (markRefs.current.get(findingId) === element) markRefs.current.delete(findingId);
    };
  };

  // One tag per finding: evidence fields that point at the same text share their boxes.
  const groups: { finding: FindingView; labels: string[]; boxes: Box[] }[] = [];
  for (const item of located) {
    let group = groups.find((entry) => entry.finding.id === item.finding.id);
    if (!group) {
      group = { finding: item.finding, labels: [], boxes: [] };
      groups.push(group);
    }
    if (!group.labels.includes(item.evidence.fieldLabel))
      group.labels.push(item.evidence.fieldLabel);
    for (const box of item.boxes!) {
      const known = group.boxes.some(
        (other) => other.x === box.x && other.y === box.y && other.width === box.width,
      );
      if (!known) group.boxes.push(box);
    }
  }
  groups.sort((a, b) => a.boxes[0]!.y - b.boxes[0]!.y);

  // Tags are 24 px targets (WCAG 2.5.8), 36 px on touch screens; tags on the same line stack.
  const TAG_STEP = (coarse ? 36 : 24) + 2;
  const tagTops = new Map<string, number>();
  const usedRows: number[] = [];
  for (const group of groups) {
    let top = group.boxes[0]!.y - 4;
    while (usedRows.some((row) => Math.abs(row - top) < TAG_STEP)) top += TAG_STEP;
    usedRows.push(top);
    tagTops.set(group.finding.id, top);
  }

  const pageHeight = isPdf ? (pdf.status === "ready" ? pdf.height : 0) : (image?.height ?? 0);

  // Bring the selected finding's evidence into view, also sideways when the page is zoomed;
  // jump instead of animating under reduced motion.
  const selectedX = groups.find((group) => group.finding.id === selectedId)?.boxes[0]?.x ?? null;
  useEffect(() => {
    if (!selectedId) return;
    const behavior = window.matchMedia("(prefers-reduced-motion: reduce)").matches
      ? "auto"
      : "smooth";
    markRefs.current.get(selectedId)?.scrollIntoView({ block: "center", behavior });
    const area = pageArea.current;
    if (area && selectedX !== null) {
      area.scrollTo({ left: Math.max(0, selectedX - area.clientWidth / 4), behavior });
    }
  }, [selectedId, selectedX, located.length, document.id, page, renderWidth]);

  const percent = new Intl.NumberFormat(dataLocale(locale), { style: "percent" });
  const zoomIndex = ZOOMS.indexOf(zoom);

  return (
    <div className="grid min-w-0 gap-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        {documents.length > 1 ? (
          <div className="grid min-w-0 gap-1">
            <Label htmlFor={selectId}>{t("document")}</Label>
            <NativeSelect
              id={selectId}
              value={document.id}
              onChange={(event) => onNavigate(event.target.value, 1)}
              className="max-w-full"
            >
              {documents.map((doc) => (
                <option key={doc.id} value={doc.id}>
                  {doc.fileName}
                </option>
              ))}
            </NativeSelect>
          </div>
        ) : (
          <p className="truncate font-medium" dir="auto">
            {document.fileName}
          </p>
        )}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <div role="group" aria-label={t("zoom")} className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              aria-label={t("zoomOut")}
              disabled={zoomIndex === 0}
              onClick={() => setZoom(ZOOMS[zoomIndex - 1]!)}
            >
              <ZoomOut aria-hidden="true" />
            </Button>
            <span className="min-w-12 text-center text-small tabular-nums" aria-live="polite">
              {percent.format(zoom)}
            </span>
            <Button
              variant="ghost"
              size="icon"
              aria-label={t("zoomIn")}
              disabled={zoomIndex === ZOOMS.length - 1}
              onClick={() => setZoom(ZOOMS[zoomIndex + 1]!)}
            >
              <ZoomIn aria-hidden="true" />
            </Button>
          </div>
          <nav aria-label={t("pages")} className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              aria-label={t("previous")}
              disabled={page <= 1}
              onClick={() => onNavigate(document.id, page - 1)}
            >
              <ChevronLeft aria-hidden="true" className="rtl:-scale-x-100" />
            </Button>
            <span className="min-w-24 text-center text-small tabular-nums" aria-live="polite">
              {t("page", { page, count: pageCount })}
            </span>
            <Button
              variant="ghost"
              size="icon"
              aria-label={t("next")}
              disabled={page >= pageCount}
              onClick={() => onNavigate(document.id, page + 1)}
            >
              <ChevronRight aria-hidden="true" className="rtl:-scale-x-100" />
            </Button>
          </nav>
        </div>
      </div>

      {unlocated.length > 0 ? (
        <ul className="grid gap-1 surface p-3 text-small">
          {unlocated.map(({ finding, evidence }) => {
            const Icon = statusIcons[finding.status];
            return (
              <li
                key={`${finding.id}:${evidence.fieldLabel}`}
                className="flex flex-wrap items-baseline gap-x-2 gap-y-1"
              >
                <button
                  type="button"
                  onClick={() => onSelectFinding(finding.id)}
                  aria-pressed={finding.id === selectedId}
                  className="inline-flex min-h-6 items-center gap-1 rounded-xs pointer-coarse:min-h-11"
                  ref={registerMark(finding.id)}
                >
                  <RefTag
                    className={cn(finding.id === selectedId && "border-harbor bg-harbor-tint")}
                  >
                    {finding.ref}
                  </RefTag>
                  <Icon
                    aria-hidden="true"
                    className={cn("size-4", statusTextClasses[finding.status])}
                  />
                  <span className="sr-only">{ts(finding.status)}</span>
                </button>
                <span className="text-slate">{t("positionUnavailable")}</span>
                {evidence.text ? (
                  <q className="min-w-0 break-words" dir="auto">
                    {evidence.text}
                  </q>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : null}

      <div className="flex min-w-0 gap-2">
        {/* Scrolls sideways when the page is zoomed wider than the screen. */}
        <div ref={pageArea} className="min-w-0 flex-1 overflow-x-auto overscroll-x-contain">
          {/* The page is paper: its coordinates are physical, so it is laid out left to right. */}
          <div
            dir="ltr"
            className={cn(
              "relative border border-rule bg-paper",
              // Reserve a page-shaped area until the page is drawn, so nothing jumps.
              ready && isPdf ? "w-max" : "w-full",
              !ready && "aspect-[1/1.414]",
            )}
            style={!isPdf && renderWidth > 0 ? { inlineSize: renderWidth + 2 } : undefined}
          >
            {isPdf ? (
              <canvas
                ref={canvas}
                role="img"
                aria-label={t("pageImage", { page, name: document.fileName })}
                className={cn("block", pdf.status !== "ready" && "invisible")}
              />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element -- authenticated API file, not a static asset
              <img
                src={url}
                alt={t("pageImage", { page, name: document.fileName })}
                className="block h-auto w-full"
                onLoad={(event) =>
                  setImage({ width: event.currentTarget.width, height: event.currentTarget.height })
                }
                onError={() => setImage(null)}
              />
            )}
            {groups.map(({ finding, boxes }) =>
              boxes.map((box, index) => (
                <span
                  key={`${finding.id}:${index}`}
                  aria-hidden="true"
                  className={cn(
                    "pointer-events-none absolute mix-blend-multiply transition-colors duration-(--duration-fast)",
                    finding.id === selectedId
                      ? "bg-evidence-wash outline-2 outline-harbor"
                      : "bg-evidence-wash/70",
                  )}
                  style={{
                    insetInlineStart: box.x - 2,
                    top: box.y - 2,
                    inlineSize: box.width + 4,
                    blockSize: box.height + 4,
                  }}
                />
              )),
            )}
            {isPdf && pdf.status === "loading" ? (
              <p className="absolute inset-0 flex items-center justify-center gap-2 text-small text-slate">
                <LoaderCircle aria-hidden="true" className="size-4 motion-safe:animate-spin" />
                {t("loading")}
              </p>
            ) : null}
            {isPdf && pdf.status === "error" ? (
              <p role="alert" className="p-4 text-small text-error-fg">
                {t("error")}
              </p>
            ) : null}
          </div>
        </div>

        {/* Margin: bracket and finding tag beside each located piece of evidence. */}
        <div
          data-evidence-margin
          className="relative w-12 shrink-0"
          style={{ blockSize: pageHeight || undefined }}
        >
          {groups.map(({ finding, labels, boxes }) => {
            const selected = finding.id === selectedId;
            const Icon = statusIcons[finding.status];
            return (
              <div key={finding.id}>
                {boxes.map((box, index) => (
                  <span
                    key={index}
                    aria-hidden="true"
                    className={cn(
                      "absolute start-0 w-0.5 origin-top bg-harbor",
                      selected ? "motion-safe:animate-bracket-draw" : "opacity-60",
                    )}
                    style={{ top: box.y - 2, blockSize: box.height + 4 }}
                  />
                ))}
                <button
                  type="button"
                  onClick={() => onSelectFinding(finding.id)}
                  aria-pressed={selected}
                  aria-label={`${finding.ref} · ${ts(finding.status)} · ${labels.join(", ")}`}
                  ref={registerMark(finding.id)}
                  className={cn(
                    "absolute start-1.5 flex items-center gap-0.5 rounded-xs",
                    coarse ? "min-h-9 min-w-9" : "min-h-6 min-w-6",
                  )}
                  style={{ top: tagTops.get(finding.id) }}
                >
                  <RefTag className={cn("px-1", selected && "border-harbor bg-harbor-tint")}>
                    {finding.ref}
                  </RefTag>
                  <Icon
                    aria-hidden="true"
                    className={cn("size-3.5", statusTextClasses[finding.status])}
                  />
                </button>
              </div>
            );
          })}
        </div>
      </div>
      {!isPdf ? <p className="text-small text-slate">{t("imageNote")}</p> : null}
    </div>
  );
}
