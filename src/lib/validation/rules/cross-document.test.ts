import { describe, expect, it } from "vitest";
import { effective, record } from "../../../../test/helpers/documents";
import { field } from "../../../../test/helpers/extraction";
import { runChecks, type SemanticLookup } from "../engine";

type Header = NonNullable<Parameters<typeof record>[1]>["header"];
type Lines = NonNullable<Parameters<typeof record>[1]>["lines"];

const invoice = (header: Header = {}, lines: Lines = []) =>
  record("inv", { documentType: "commercial_invoice", header, lines });
const packing = (header: Header = {}, lines: Lines = []) =>
  record("pl", { documentType: "packing_list", header, lines });
const order = (header: Header = {}, lines: Lines = []) =>
  record("po", { documentType: "purchase_order", header, lines });

const check = (records: ReturnType<typeof record>[], semantic?: SemanticLookup) =>
  runChecks({ documents: effective(records), tolerance: "0.01", semantic, rulePacks: [] });

const byRule = (run: ReturnType<typeof runChecks>, ruleId: string) =>
  run.findings.filter((item) => item.ruleId === ruleId);

describe("value comparisons across documents", () => {
  it("reports a different number of packages as an error naming both documents", () => {
    const run = check([
      invoice({ packageCount: field("12") }),
      packing({ packageCount: field("14") }),
    ]);
    expect(byRule(run, "xdoc-packages")[0]).toMatchObject({
      severity: "error",
      documentIds: ["inv", "pl"],
      params: {
        docA: { kind: "document", value: "inv" },
        valueA: { kind: "quantity", value: "12" },
        docB: { kind: "document", value: "pl" },
        valueB: { kind: "quantity", value: "14" },
      },
    });
  });

  it("compares every pair of invoice, packing list and purchase order", () => {
    const run = check([
      invoice({ currency: field("EUR") }),
      packing({ currency: field("EUR") }),
      order({ currency: field("USD") }),
    ]);
    expect(byRule(run, "xdoc-currency").map((item) => item.documentIds)).toEqual([
      ["inv", "po"],
      ["pl", "po"],
    ]);
  });

  it("uses the sum of line quantities when no total quantity is printed", () => {
    const run = check([
      invoice({ totalQuantity: field("120") }),
      packing({}, [{ quantity: field("100") }, { quantity: field("20") }]),
    ]);
    expect(byRule(run, "xdoc-quantity")).toEqual([]);
    expect(run.results.find((result) => result.ruleId === "xdoc-quantity")?.status).toBe("passed");
  });

  it("converts weight units and tolerates rounding on paper only across units", () => {
    const same = check([
      invoice({ grossWeight: field("1"), grossWeightUnit: field("t") }),
      packing({ grossWeight: field("1000"), grossWeightUnit: field("kg") }),
    ]);
    expect(byRule(same, "xdoc-gross-weight")).toEqual([]);

    const rounded = check([
      invoice({ grossWeight: field("2204.62"), grossWeightUnit: field("lb") }),
      packing({ grossWeight: field("1000"), grossWeightUnit: field("kg") }),
    ]);
    expect(byRule(rounded, "xdoc-gross-weight")).toEqual([]);

    const sameUnit = check([
      invoice({ netWeight: field("1000.5"), netWeightUnit: field("kg") }),
      packing({ netWeight: field("1000"), netWeightUnit: field("kg") }),
    ]);
    expect(byRule(sameUnit, "xdoc-net-weight")).toHaveLength(1);
  });

  it("reports Incoterms rule and place separately with distinct ids", () => {
    const run = check([
      invoice({ incoterm: field("FOB"), incotermPlace: field("Izmir Port") }),
      packing({ incoterm: field("CIF"), incotermPlace: field("Hamburg") }),
    ]);
    const findings = byRule(run, "xdoc-incoterm");
    expect(findings.map((item) => [item.messageKey, item.severity])).toEqual([
      ["xdoc-incoterm", "error"],
      ["xdoc-incoterm-place", "warning"],
    ]);
    expect(new Set(findings.map((item) => item.id)).size).toBe(2);
  });

  it("ignores case and punctuation in the Incoterms place", () => {
    const run = check([
      invoice({ incoterm: field("FOB"), incotermPlace: field("Izmir port.") }),
      packing({ incoterm: field("FOB"), incotermPlace: field("IZMIR  Port") }),
    ]);
    expect(byRule(run, "xdoc-incoterm")).toEqual([]);
  });

  it("compares origin and destination countries", () => {
    const run = check([
      invoice({ countryOfOrigin: field("TR"), countryOfDestination: field("DE") }),
      packing({ countryOfOrigin: field("CN"), countryOfDestination: field("AT") }),
    ]);
    expect(byRule(run, "xdoc-origin")[0]?.severity).toBe("error");
    expect(byRule(run, "xdoc-destination")[0]?.severity).toBe("warning");
  });

  it("is not applicable with a single document", () => {
    const run = check([invoice({ currency: field("EUR") })]);
    expect(run.results.find((result) => result.ruleId === "xdoc-currency")?.status).toBe(
      "not_applicable",
    );
  });
});

describe("xdoc-order-ref", () => {
  it("matches references ignoring case and spaces but not dashes", () => {
    const ok = check([
      invoice({ orderReference: field("po 2026-17") }),
      order({ documentNumber: field("PO2026-17") }),
    ]);
    expect(byRule(ok, "xdoc-order-ref")).toEqual([]);

    const wrong = check([
      invoice({ orderReference: field("PO2026/17") }),
      order({ documentNumber: field("PO2026-17") }),
    ]);
    expect(byRule(wrong, "xdoc-order-ref")[0]).toMatchObject({
      severity: "error",
      params: { valueA: { value: "PO2026/17" }, valueB: { value: "PO2026-17" } },
    });
  });

  it("marks a missing reference as not verifiable", () => {
    const run = check([invoice(), order({ documentNumber: field("PO-1") })]);
    expect(byRule(run, "xdoc-order-ref")[0]).toMatchObject({
      severity: "info",
      unverified: true,
      messageKey: "xdoc-order-ref-missing",
    });
  });

  it("compares invoice and packing list references when there is no purchase order", () => {
    const run = check([
      invoice({ orderReference: field("PO-1") }),
      packing({ orderReference: field("PO-2") }),
    ]);
    expect(byRule(run, "xdoc-order-ref")[0]).toMatchObject({
      severity: "warning",
      messageKey: "xdoc-order-ref-pair",
    });
  });
});

describe("xdoc-exporter and xdoc-importer", () => {
  const names = (a: string, b: string) => [
    invoice({ sellerName: field(a) }),
    packing({ shipperName: field(b) }),
  ];

  it("treats names that differ only in case and punctuation as equal without AI", () => {
    let asked = false;
    const run = check(names("Anatolia Textiles Ltd.", "ANATOLIA TEXTILES LTD"), () => {
      asked = true;
      return null;
    });
    expect(byRule(run, "xdoc-exporter")).toEqual([]);
    expect(asked).toBe(false);
  });

  it("uses the shipper, or the seller when no shipper is named", () => {
    const run = check([
      invoice({ sellerName: field("A Ltd"), shipperName: field("B Ltd") }),
      packing({ sellerName: field("B Ltd") }),
    ]);
    expect(byRule(run, "xdoc-exporter")).toEqual([]);
  });

  it("cannot verify differently written names without an AI verdict", () => {
    const run = check(names("Anatolia Textiles Ltd", "Anatolia Tekstil A.Ş."));
    expect(byRule(run, "xdoc-exporter")[0]).toMatchObject({
      severity: "warning",
      unverified: true,
      aiAssisted: false,
      messageKey: "xdoc-exporter-unknown",
    });
  });

  it("reports an AI verdict as AI-assisted", () => {
    const same = check(names("Anatolia Textiles Ltd", "Anatolia Tekstil A.Ş."), () => ({
      same: true,
      confidence: 0.9,
    }));
    expect(byRule(same, "xdoc-exporter")[0]).toMatchObject({
      severity: "info",
      unverified: false,
      aiAssisted: true,
      messageKey: "xdoc-exporter-same",
    });

    const different = check(names("Anatolia Textiles Ltd", "Baltic Freight GmbH"), () => ({
      same: false,
      confidence: 0.95,
    }));
    expect(byRule(different, "xdoc-exporter")[0]).toMatchObject({
      severity: "warning",
      aiAssisted: true,
      messageKey: "xdoc-exporter-different",
    });
  });

  it("treats a low-confidence AI verdict as not verified", () => {
    const run = check(names("A Ltd", "B Ltd"), () => ({ same: false, confidence: 0.4 }));
    expect(byRule(run, "xdoc-exporter")[0]?.messageKey).toBe("xdoc-exporter-unknown");
  });

  it("compares consignee or buyer for the importer", () => {
    const run = check([
      invoice({ buyerName: field("Nordhafen GmbH") }),
      packing({ consigneeName: field("Südkai AG") }),
    ]);
    expect(byRule(run, "xdoc-importer")[0]?.messageKey).toBe("xdoc-importer-unknown");
  });
});

describe("xdoc-goods", () => {
  it("reports different line counts once instead of comparing lines", () => {
    const run = check([
      invoice({}, [{ description: field("Towels") }, { description: field("Robes") }]),
      packing({}, [{ description: field("Towels") }]),
    ]);
    expect(byRule(run, "xdoc-goods")).toEqual([
      expect.objectContaining({
        messageKey: "xdoc-line-count",
        params: expect.objectContaining({ countA: { kind: "number", value: "2" } }),
      }),
    ]);
  });

  it("asks for a semantic verdict only for lines written differently", () => {
    const asked: string[] = [];
    const run = check(
      [
        invoice({}, [
          { description: field("Cotton towels") },
          { description: field("Bath robes") },
        ]),
        packing({}, [
          { description: field("COTTON TOWELS") },
          { description: field("Bathrobes, white") },
        ]),
      ],
      (kind, a, b) => {
        asked.push(`${kind}:${a}|${b}`);
        return { same: true, confidence: 0.9 };
      },
    );
    expect(asked).toEqual(["goods:Bath robes|Bathrobes, white"]);
    expect(byRule(run, "xdoc-goods")).toEqual([]);
  });

  it("reports different goods per line", () => {
    const run = check(
      [
        invoice({}, [{ description: field("Cotton towels") }]),
        packing({}, [{ description: field("Steel bolts") }]),
      ],
      () => ({ same: false, confidence: 0.99 }),
    );
    expect(byRule(run, "xdoc-goods")[0]).toMatchObject({
      messageKey: "xdoc-goods-different",
      aiAssisted: true,
      params: { line: { kind: "number", value: "1" } },
    });
  });
});

describe("xdoc-hs", () => {
  it("compares only the internationally harmonized first six digits", () => {
    const national = check([
      invoice({}, [{ hsCode: field("630260001000") }]),
      packing({}, [{ hsCode: field("63026000") }]),
    ]);
    expect(byRule(national, "xdoc-hs")).toEqual([]);

    const different = check([
      invoice({}, [{ hsCode: field("630260") }]),
      packing({}, [{ hsCode: field("630291") }]),
    ]);
    expect(byRule(different, "xdoc-hs")[0]).toMatchObject({ severity: "warning" });
  });
});
