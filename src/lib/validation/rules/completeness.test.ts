import { describe, expect, it } from "vitest";
import { effective, record } from "../../../../test/helpers/documents";
import { field } from "../../../../test/helpers/extraction";
import { runChecks } from "../engine";

const run = (records: ReturnType<typeof record>[]) =>
  runChecks({
    documents: effective(records),
    unread: records.filter((item) => item.extraction === null),
    tolerance: "0.01",
    rulePacks: [],
  });
const byRule = (result: ReturnType<typeof runChecks>, ruleId: string) =>
  result.findings.filter((item) => item.ruleId === ruleId);
const keys = (result: ReturnType<typeof runChecks>, ruleId: string) =>
  byRule(result, ruleId).map((item) => item.messageKey);

const completeInvoice = {
  documentType: "commercial_invoice" as const,
  header: {
    documentNumber: field("INV-1"),
    documentDate: field("2026-03-01"),
    sellerName: field("Seller"),
    sellerAddress: field("Address"),
    buyerName: field("Buyer"),
    buyerAddress: field("Address"),
    currency: field("EUR"),
    totalAmount: field("10"),
    incoterm: field("FOB"),
    countryOfOrigin: field("TR"),
  },
  lines: [{ description: field("Goods"), quantity: field("1"), unitPrice: field("10") }],
};

describe("req-fields", () => {
  it("passes a commercial invoice with every expected field", () => {
    expect(byRule(run([record("inv", completeInvoice)]), "req-fields")).toEqual([]);
  });

  it("warns about required fields and notes recommended ones", () => {
    const result = run([
      record("inv", {
        ...completeInvoice,
        header: { ...completeInvoice.header, currency: undefined, incoterm: undefined },
      }),
    ]);
    expect(
      byRule(result, "req-fields").map((item) => [
        item.messageKey,
        item.severity,
        item.params.field?.value,
      ]),
    ).toEqual([
      ["req-field", "warning", "currency"],
      ["rec-field", "info", "incoterm"],
    ]);
  });

  it("accepts origin printed on every line instead of the header", () => {
    const result = run([
      record("inv", {
        ...completeInvoice,
        header: { ...completeInvoice.header, countryOfOrigin: undefined },
        lines: [{ ...completeInvoice.lines[0], countryOfOrigin: field("TR") }],
      }),
    ]);
    expect(byRule(result, "req-fields")).toEqual([]);
  });

  it("accepts the seller as exporter on a packing list, and asks for one of them", () => {
    const base = {
      documentType: "packing_list" as const,
      lines: [{ description: field("Goods"), quantity: field("1") }],
    };
    const withSeller = run([
      record("pl", {
        ...base,
        header: {
          sellerName: field("Seller"),
          consigneeName: field("Consignee"),
          packageCount: field("2"),
          grossWeight: field("10"),
          grossWeightUnit: field("kg"),
          documentNumber: field("PL-1"),
          documentDate: field("2026-03-01"),
          netWeight: field("9"),
          netWeightUnit: field("kg"),
        },
      }),
    ]);
    expect(byRule(withSeller, "req-fields")).toEqual([]);

    const withNeither = run([record("pl", { ...base, header: { consigneeName: field("C") } })]);
    expect(byRule(withNeither, "req-fields")[0]).toMatchObject({
      messageKey: "req-field-either",
      params: { fieldA: { value: "shipperName" }, fieldB: { value: "sellerName" } },
    });
  });

  it("notes a weight without a unit", () => {
    const result = run([
      record("pl", { documentType: "packing_list", header: { grossWeight: field("10") } }),
    ]);
    expect(keys(result, "req-fields")).toContain("req-weight-unit");
  });

  it("reports missing goods lines and missing line values with counts", () => {
    expect(keys(run([record("po", { documentType: "purchase_order" })]), "req-fields")).toContain(
      "req-lines",
    );
    const result = run([
      record("inv", {
        ...completeInvoice,
        lines: [
          { description: field("A"), quantity: field("1"), unitPrice: field("1") },
          { description: field("B"), unitPrice: field("1") },
          { description: field("C"), unitPrice: field("1") },
        ],
      }),
    ]);
    expect(byRule(result, "req-fields")[0]).toMatchObject({
      messageKey: "req-line-field",
      severity: "warning",
      params: { field: { value: "quantity" }, count: { value: "2" }, total: { value: "3" } },
    });
  });

  it("does not check documents of other types", () => {
    const result = run([record("x", { documentType: "other" })]);
    expect(byRule(result, "req-fields")).toEqual([]);
  });
});

describe("docset", () => {
  it("has nothing to say about an empty check", () => {
    const result = run([]);
    expect(byRule(result, "docset")).toEqual([]);
    expect(result.results.find((item) => item.ruleId === "docset")?.status).toBe("not_applicable");
  });

  it("lists missing documents and the general reminder", () => {
    const result = run([record("inv", completeInvoice)]);
    expect(byRule(result, "docset").map((item) => [item.messageKey, item.severity])).toEqual([
      ["docset-missing", "warning"],
      ["docset-optional", "info"],
      ["docset-typical", "info"],
    ]);
    expect(byRule(result, "docset")[0]?.params.documentType).toEqual({
      kind: "documentType",
      value: "packing_list",
    });
  });

  it("names the destination country in the reminder, without listing its rules", () => {
    const result = run([
      record("inv", {
        ...completeInvoice,
        header: { ...completeInvoice.header, countryOfDestination: field("DE") },
      }),
    ]);
    expect(byRule(result, "docset").at(-1)).toMatchObject({
      messageKey: "docset-typical-country",
      params: { country: { kind: "country", value: "DE" } },
    });
  });

  it("mentions insurance for CIF and CIP", () => {
    const result = run([
      record("inv", {
        ...completeInvoice,
        header: { ...completeInvoice.header, incoterm: field("CIP") },
      }),
    ]);
    expect(keys(result, "docset")).toContain("docset-insurance");
  });

  it("reports unread, duplicate and unrecognized documents", () => {
    const result = run([
      record("inv", completeInvoice),
      record("inv2", completeInvoice),
      record("other", { documentType: "other" }),
      record("pending", {}, { read: false }),
    ]);
    const findings = byRule(result, "docset");
    expect(findings.find((item) => item.messageKey === "doc-not-read")?.documentIds).toEqual([
      "pending",
    ]);
    expect(findings.find((item) => item.messageKey === "docset-duplicate")).toMatchObject({
      documentIds: ["inv", "inv2"],
      params: { document: { value: "inv" } },
    });
    expect(findings.find((item) => item.messageKey === "docset-other-type")?.documentIds).toEqual([
      "other",
    ]);
  });
});
