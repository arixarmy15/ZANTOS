import { describe, expect, it } from "vitest";
import { effective, record } from "../../../../test/helpers/documents";
import { field } from "../../../../test/helpers/extraction";
import { runChecks } from "../engine";
import { CURRENCY_LIST_DATE } from "../reference";
import { isValidIban } from "./format";

type Input = NonNullable<Parameters<typeof record>[1]>;

const check = (...records: ReturnType<typeof record>[]) =>
  runChecks({ documents: effective(records), tolerance: "0.01", rulePacks: [] });
const one = (input: Input) =>
  check(record("inv", { documentType: "commercial_invoice", ...input }));
const byRule = (run: ReturnType<typeof runChecks>, ruleId: string) =>
  run.findings.filter((item) => item.ruleId === ruleId);

describe("fmt-value", () => {
  it("reports a value that cannot be read as its kind, once", () => {
    const run = one({ header: { documentDate: field("2026-02-30"), totalAmount: field("12,50") } });
    expect(byRule(run, "fmt-value").map((item) => item.params.field?.value)).toEqual([
      "header.documentDate",
      "header.totalAmount",
    ]);
    // A malformed date is not reported again by the date rules.
    expect(byRule(run, "date-order")).toEqual([]);
  });
});

describe("fmt-currency", () => {
  it("accepts ISO 4217 codes and names the list date for unknown ones", () => {
    expect(byRule(one({ header: { currency: field("EUR") } }), "fmt-currency")).toEqual([]);
    expect(byRule(one({ header: { currency: field("XYZ") } }), "fmt-currency")[0]).toMatchObject({
      severity: "warning",
      params: { value: { value: "XYZ" }, listDate: { kind: "date", value: CURRENCY_LIST_DATE } },
    });
  });
});

describe("fmt-country", () => {
  it("checks header and line countries against ISO 3166-1", () => {
    const run = one({
      header: { countryOfOrigin: field("TR"), countryOfDestination: field("UK") },
      lines: [{ countryOfOrigin: field("XK") }],
    });
    expect(
      byRule(run, "fmt-country").map((item) => [item.messageKey, item.params.field?.value]),
    ).toEqual([
      ["fmt-country", "header.countryOfDestination"],
      ["fmt-country-user-assigned", "lines.0.countryOfOrigin"],
    ]);
  });
});

describe("fmt-incoterm", () => {
  it("accepts the 11 Incoterms 2020 rules with a named place", () => {
    const run = one({ header: { incoterm: field("DPU"), incotermPlace: field("Rotterdam") } });
    expect(byRule(run, "fmt-incoterm")).toEqual([]);
  });

  it("notes a rule without a named place", () => {
    const run = one({ header: { incoterm: field("FOB") } });
    expect(byRule(run, "fmt-incoterm")[0]).toMatchObject({
      severity: "info",
      messageKey: "fmt-incoterm-no-place",
    });
  });

  it("names the edition of a retired rule", () => {
    const run = one({ header: { incoterm: field("DAT"), incotermPlace: field("Mersin") } });
    expect(byRule(run, "fmt-incoterm")[0]).toMatchObject({
      severity: "warning",
      messageKey: "fmt-incoterm-retired",
      params: { edition: { value: "2010" } },
    });
  });

  it("reports codes that are not Incoterms rules", () => {
    const run = one({ header: { incoterm: field("CNF"), incotermPlace: field("Mersin") } });
    expect(byRule(run, "fmt-incoterm")[0]?.messageKey).toBe("fmt-incoterm");
  });
});

describe("fmt-hs", () => {
  it("checks format only and always asks for expert confirmation", () => {
    const run = one({ lines: [{ hsCode: field("630260") }, { hsCode: field("6302") }] });
    const findings = byRule(run, "fmt-hs");
    expect(findings.map((item) => [item.messageKey, item.severity])).toEqual([
      ["fmt-hs-short", "warning"],
      ["fmt-hs-expert", "info"],
    ]);
    expect(findings[0]?.params.line).toEqual({ kind: "number", value: "2" });
  });

  it("adds no note when no HS code is printed", () => {
    expect(byRule(one({ lines: [{ description: field("Towels") }] }), "fmt-hs")).toEqual([]);
  });

  it("reports letters in an HS code as an unreadable value, not as a code", () => {
    const run = one({ lines: [{ hsCode: field("63O260") }] });
    expect(byRule(run, "fmt-value")).toHaveLength(1);
    expect(byRule(run, "fmt-hs")).toEqual([]);
  });
});

describe("IBAN", () => {
  it("validates ISO 13616 check digits", () => {
    // Published examples from the ISO 13616 / SWIFT IBAN registry documentation.
    expect(isValidIban("DE89370400440532013000")).toBe(true);
    expect(isValidIban("GB82 WEST 1234 5698 7654 32")).toBe(true);
    expect(isValidIban("DE89370400440532013001")).toBe(false);
    expect(isValidIban("DE8937040044")).toBe(false);
  });

  it("reports an invalid IBAN as an error", () => {
    const run = one({ header: { iban: field("DE89370400440532013001") } });
    expect(byRule(run, "fmt-iban")[0]?.severity).toBe("error");
    expect(byRule(one({ header: { iban: field("DE89370400440532013000") } }), "fmt-iban")).toEqual(
      [],
    );
  });
});

describe("date-order", () => {
  it("warns when the invoice is dated before the purchase order", () => {
    const run = check(
      record("inv", {
        documentType: "commercial_invoice",
        header: { documentDate: field("2026-03-01") },
      }),
      record("po", {
        documentType: "purchase_order",
        header: { documentDate: field("2026-03-10") },
      }),
    );
    expect(byRule(run, "date-order")[0]).toMatchObject({
      severity: "warning",
      params: { dateA: { kind: "date", value: "2026-03-10" }, dateB: { value: "2026-03-01" } },
    });
  });

  it("accepts the same day", () => {
    const run = check(
      record("pl", { documentType: "packing_list", header: { documentDate: field("2026-03-10") } }),
      record("po", {
        documentType: "purchase_order",
        header: { documentDate: field("2026-03-10") },
      }),
    );
    expect(byRule(run, "date-order")).toEqual([]);
    expect(run.results.find((result) => result.ruleId === "date-order")?.status).toBe("passed");
  });
});
