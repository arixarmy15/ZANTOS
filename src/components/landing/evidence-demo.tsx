"use client";

import { useLocale, useTranslations } from "next-intl";
import { useId, useState } from "react";
import { RefTag, StatusTag, type Status } from "@/components/ui/tag";
import { dataLocale, formatDecimal } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * The overview page's hero: a miniature evidence ledger with two synthetic documents.
 * Selecting a finding marks its evidence in both documents, the way the check page does.
 * Every value here is labelled as an example; nothing is presented as a real check.
 */

type Ref = "F1" | "F2" | "F3";
type FieldKey = "order" | "incoterm" | "packages" | "gross" | "net" | "total";
type Field = { key: FieldKey; value: string; evidence?: Ref };

const INVOICE_FILE = "commercial-invoice.pdf";
const PACKING_FILE = "packing-list.pdf";
const ORDER = "PO-88213";

// Unicode isolates keep file names and values in their own direction inside RTL sentences.
const isolate = (value: string) => `⁨${value}⁩`;

export function EvidenceDemo() {
  const t = useTranslations("landing.demo");
  const tf = useTranslations("findings.messages");
  const locale = useLocale();
  const captionId = useId();
  const [selected, setSelected] = useState<Ref>("F1");

  const kg = (value: string) => `${formatDecimal(value, locale)} kg`;
  const amount = new Intl.NumberFormat(dataLocale(locale), {
    style: "currency",
    currency: "EUR",
  }).format(18450);

  const invoice: Field[] = [
    // Same order as the packing list, so the compared rows line up side by side.
    { key: "order", value: ORDER, evidence: "F3" },
    { key: "packages", value: formatDecimal("12", locale), evidence: "F1" },
    { key: "gross", value: kg("1240"), evidence: "F2" },
    { key: "net", value: kg("1180") },
    { key: "incoterm", value: "FOB Mersin" },
    { key: "total", value: amount },
  ];
  const packingList: Field[] = [
    { key: "order", value: ORDER, evidence: "F3" },
    { key: "packages", value: formatDecimal("14", locale), evidence: "F1" },
    { key: "gross", value: kg("1265"), evidence: "F2" },
    { key: "net", value: kg("1180") },
  ];

  const docs = { docA: isolate(INVOICE_FILE), docB: isolate(PACKING_FILE) };
  const findings: { ref: Ref; status: Status; text: string }[] = [
    {
      ref: "F1",
      status: "error",
      text: tf("xdoc-packages", {
        ...docs,
        valueA: isolate(formatDecimal("12", locale)),
        valueB: isolate(formatDecimal("14", locale)),
      }),
    },
    {
      ref: "F2",
      status: "error",
      text: tf("xdoc-gross-weight", {
        ...docs,
        valueA: isolate(kg("1240")),
        valueB: isolate(kg("1265")),
      }),
    },
    { ref: "F3", status: "success", text: t("orderMatches", { value: isolate(ORDER) }) },
  ];

  return (
    <figure aria-labelledby={captionId} className="grid min-w-0 gap-6">
      <div className="relative motion-safe:animate-sheet-rise [animation-delay:320ms]">
        {/*
         * A binder sheet: punched holes in the margin and one coloured tab per document type,
         * the same tab colours the check page uses for the documents.
         */}
        <div className="relative overflow-hidden rounded-lg bg-paper text-carbon shadow-raised ring-1 ring-carbon/10">
          <p className="flex items-center justify-between gap-3 border-b border-rule px-4 py-2.5 ps-10 text-small font-semibold">
            {t("label")}
          </p>
          <div
            aria-hidden="true"
            className="absolute inset-y-0 start-0 grid w-7 content-evenly justify-items-center border-e border-dashed border-rule"
          >
            {[0, 1, 2].map((hole) => (
              <span
                key={hole}
                className="size-3 rounded-full bg-ledger shadow-[inset_0_1px_2px_rgba(35,37,43,0.35)]"
              />
            ))}
          </div>
          <div className="ms-7 grid grid-cols-2 divide-x divide-rule rtl:divide-x-reverse">
            <DocumentSheet
              tab="bg-tab-invoice"
              title={t("invoice")}
              number="INV-2026-0147"
              file={INVOICE_FILE}
              fields={invoice}
              selected={selected}
            />
            <DocumentSheet
              tab="bg-tab-packing"
              title={t("packingList")}
              number="PL-2026-0147"
              file={PACKING_FILE}
              fields={packingList}
              selected={selected}
            />
          </div>
          <ul
            aria-label={t("findingsLabel")}
            className="ms-7 divide-y divide-rule border-t border-rule"
          >
            {findings.map((finding) => (
              <li key={finding.ref}>
                <button
                  type="button"
                  aria-pressed={finding.ref === selected}
                  onClick={() => setSelected(finding.ref)}
                  className="grid min-h-11 w-full grid-cols-[auto_minmax(0,1fr)] items-start gap-x-2 gap-y-1 border-s-[3px] border-transparent px-3 py-2.5 text-start transition-control hover:bg-ledger focus-visible:relative aria-pressed:border-s-harbor aria-pressed:bg-harbor-tint"
                >
                  <RefTag className={cn(finding.ref === selected && "border-harbor")}>
                    {finding.ref}
                  </RefTag>
                  <span className="grid justify-items-start gap-1">
                    <StatusTag status={finding.status} />
                    <span className="text-small text-pretty">{finding.text}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <figcaption id={captionId} className="text-small text-slate">
        {t("caption")}
      </figcaption>
    </figure>
  );
}

function DocumentSheet({
  tab,
  title,
  number,
  file,
  fields,
  selected,
}: {
  title: string;
  number: string;
  file: string;
  fields: Field[];
  selected: Ref;
  /** Background class of the document type's binder tab. */
  tab: string;
}) {
  const t = useTranslations("landing.demo");
  return (
    <div className="flex min-w-0 flex-col">
      {/* The header is the document's binder tab, in its type colour. */}
      <div className={cn("grid gap-0.5 border-b border-carbon/10 px-3 py-2", tab)}>
        <p className="truncate text-small font-semibold">{title}</p>
        <p className="code truncate text-caption text-carbon/80">{number}</p>
      </div>
      <dl>
        {fields.map((field) => {
          const active = field.evidence === selected;
          return (
            <div
              key={field.key}
              className={cn(
                "relative grid gap-0.5 border-b border-rule py-1.5 ps-3 pe-11 transition-control sm:pe-12",
                active && "bg-evidence-wash",
              )}
            >
              <dt className="truncate text-caption text-slate">
                <bdi>{t(`fields.${field.key}`)}</bdi>
              </dt>
              <dd className="code truncate text-small tabular-nums">
                <bdi>{field.value}</bdi>
                {/* Positioned against the row: a bracket and the finding tag in the margin. */}
                {active ? (
                  <>
                    <span
                      aria-hidden="true"
                      className="absolute inset-y-1 end-9 w-0.5 origin-top bg-harbor motion-safe:animate-bracket-draw sm:end-10"
                    />
                    <span className="absolute end-1.5 top-1/2 -translate-y-1/2">
                      <span className="sr-only">{t("evidenceFor", { tag: field.evidence! })}</span>
                      <RefTag aria-hidden="true" className="border-harbor bg-harbor-tint px-1">
                        {field.evidence}
                      </RefTag>
                    </span>
                  </>
                ) : null}
              </dd>
            </div>
          );
        })}
      </dl>
      <p className="mt-auto flex flex-wrap items-baseline justify-between gap-x-2 px-3 py-2 text-caption text-slate">
        <span>{t("page", { page: 1 })}</span>
        <span className="code truncate" dir="ltr">
          {file}
        </span>
      </p>
    </div>
  );
}
