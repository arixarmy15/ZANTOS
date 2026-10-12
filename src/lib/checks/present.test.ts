import { describe, expect, it } from "vitest";
import en from "../../../messages/en.json";
import ar from "../../../messages/ar.json";
import { effective, record } from "../../../test/helpers/documents";
import { field } from "../../../test/helpers/extraction";
import { runChecks } from "@/lib/validation/engine";
import { IntlMessageFormat } from "intl-messageformat";
import {
  fieldLabel,
  joinFieldLabels,
  presentFindings,
  presentRules,
  quotes,
  summarize,
  withCents,
  type Translate,
} from "./present";

/** Minimal next-intl-like translator over a messages file, for tests. */
function translator(messages: unknown, locale: string): Translate {
  return (key, values) => {
    const message = key
      .split(".")
      .reduce<unknown>((node, part) => (node as Record<string, unknown>)[part], messages);
    if (typeof message !== "string") throw new Error(`missing ${key}`);
    return String(new IntlMessageFormat(message, locale).format(values));
  };
}

const strip = (value: string) => value.replace(/[⁨⁩]/g, "");

const records = [
  record("inv", {
    documentType: "commercial_invoice",
    header: { packageCount: field("12"), countryOfDestination: field("DE") },
    lines: [
      {
        quantity: field("10"),
        unitPrice: field("9.00", { source: { page: 1, text: "10 x 9.00 = 95.00" } }),
        lineTotal: field("95.00", { source: { page: 1, text: "10 x 9.00 = 95.00" } }),
      },
    ],
  }),
  record("pl", { documentType: "packing_list", header: { packageCount: field("14") } }),
];
const run = runChecks({ documents: effective(records), tolerance: "0.01", rulePacks: [] });
const documents = new Map([
  ["inv", { fileName: "invoice.pdf", documentType: "commercial_invoice" as const }],
  ["pl", { fileName: "packing.pdf", documentType: "packing_list" as const }],
]);

describe("presentFindings", () => {
  const views = presentFindings(run.findings, { locale: "en", t: translator(en, "en"), documents });

  it("numbers findings F1, F2… in report order", () => {
    expect(views.map((view) => view.ref)).toEqual(views.map((_, index) => `F${index + 1}`));
  });

  it("formats parameters for the reader: file names, amounts with cents, field labels", () => {
    const line = views.find((view) => view.ruleId === "arith-line-total")!;
    expect(strip(line.message)).toBe(
      "Line 1 of invoice.pdf: 10 × 9.00 = 90.00, but the line total is 95.00. Difference: 5.00.",
    );
    const packages = views.find((view) => view.ruleId === "xdoc-packages")!;
    expect(strip(packages.message)).toBe(
      "Number of packages differs: 12 in invoice.pdf, 14 in packing.pdf.",
    );
    expect(packages.status).toBe("error");
  });

  it("isolates inserted values so right-to-left text keeps its order", () => {
    const packages = views.find((view) => view.ruleId === "xdoc-packages")!;
    expect(packages.message).toContain("⁨invoice.pdf⁩");
  });

  it("groups evidence fields that quote the same excerpt", () => {
    const line = views.find((view) => view.ruleId === "arith-line-total")!;
    expect(line.quotes).toEqual([
      expect.objectContaining({ text: "10", fields: ["Line 1 · Quantity"] }),
      expect.objectContaining({
        text: "10 x 9.00 = 95.00",
        fields: ["Line 1 · Unit price", "Line 1 · Line total"],
      }),
    ]);
  });

  it("renders the same findings in Arabic with Latin digits", () => {
    const arabic = presentFindings(run.findings, {
      locale: "ar",
      t: translator(ar, "ar"),
      documents,
    });
    const packages = arabic.find((view) => view.ruleId === "xdoc-packages")!;
    expect(strip(packages.message)).toBe(
      "عدد الطرود مختلف: 12 في invoice.pdf، و14 في packing.pdf.",
    );
  });
});

describe("helpers", () => {
  it("pads amounts to two decimals without rounding", () => {
    expect(withCents("9")).toBe("9.00");
    expect(withCents("0.5")).toBe("0.50");
    expect(withCents("12.345")).toBe("12.345");
    expect(withCents("-3")).toBe("-3.00");
  });

  it("labels header, line and bare field keys", () => {
    const t = translator(en, "en");
    expect(fieldLabel("header.grossWeight", t)).toBe("Gross weight");
    expect(fieldLabel("lines.2.hsCode", t)).toBe("Line 3 · HS code");
    expect(fieldLabel("quantity", t)).toBe("Quantity");
  });

  it("names a shared line once when joining field labels", () => {
    expect(joinFieldLabels(["Line 1 · Quantity", "Line 1 · Unit price"])).toBe(
      "Line 1 · Quantity, Unit price",
    );
    expect(joinFieldLabels(["Net weight", "Gross weight"])).toBe("Net weight, Gross weight");
    expect(joinFieldLabels(["Line 1 · Quantity", "Line 2 · Quantity"])).toBe(
      "Line 1 · Quantity, Line 2 · Quantity",
    );
  });

  it("skips evidence without an excerpt when quoting", () => {
    expect(
      quotes([
        {
          documentId: "a",
          documentName: "a.pdf",
          fieldLabel: "X",
          page: 1,
          text: null,
          printed: "1",
        },
      ]),
    ).toEqual([]);
  });
});

describe("summaries", () => {
  it("counts by display status and issues by category", () => {
    const summary = summarize(run);
    const total = Object.values(summary.counts).reduce((sum, count) => sum + count, 0);
    expect(total).toBe(run.findings.length);
    expect(summary.counts.error).toBeGreaterThanOrEqual(2);
    expect(summary.issuesByCategory.crossDocument).toBeGreaterThanOrEqual(1);
    expect(Object.values(summary.rules).reduce((sum, count) => sum + count, 0)).toBe(
      run.results.length,
    );
  });

  it("titles every rule", () => {
    const rules = presentRules(run, translator(en, "en"));
    expect(rules.every((rule) => rule.title.length > 0)).toBe(true);
    expect(rules.find((rule) => rule.ruleId === "xdoc-packages")).toMatchObject({
      status: "failed",
      findingCount: 1,
    });
  });
});
