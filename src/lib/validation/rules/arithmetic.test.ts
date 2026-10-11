import { describe, expect, it } from "vitest";
import { effective, record } from "../../../../test/helpers/documents";
import { field } from "../../../../test/helpers/extraction";
import { runChecks } from "../engine";

const check = (records: ReturnType<typeof record>[], tolerance = "0.01") =>
  runChecks({ documents: effective(records), tolerance, rulePacks: [] });

const byRule = (run: ReturnType<typeof runChecks>, ruleId: string) =>
  run.findings.filter((item) => item.ruleId === ruleId);

const statusOf = (run: ReturnType<typeof runChecks>, ruleId: string) =>
  run.results.find((result) => result.ruleId === ruleId)?.status;

const line = (quantity: string, unitPrice: string, lineTotal: string) => ({
  description: field("Goods"),
  quantity: field(quantity),
  unitPrice: field(unitPrice),
  lineTotal: field(lineTotal),
});

describe("arith-line-total", () => {
  it("passes when quantity × unit price equals the line total", () => {
    const run = check([record("inv", { lines: [line("10", "2.50", "25.00")] })]);
    expect(byRule(run, "arith-line-total")).toEqual([]);
    expect(statusOf(run, "arith-line-total")).toBe("passed");
  });

  it("reports the expected total and the difference as exact decimals", () => {
    const run = check([record("inv", { lines: [line("3", "0.1", "0.31")] })], "0");
    const [item] = byRule(run, "arith-line-total");
    expect(item).toMatchObject({
      severity: "error",
      documentIds: ["inv"],
      params: {
        line: { kind: "number", value: "1" },
        expected: { kind: "amount", value: "0.3" },
        actual: { kind: "amount", value: "0.31" },
        difference: { kind: "amount", value: "0.01" },
      },
    });
    expect(item!.evidence.map((entry) => entry.path)).toEqual([
      "lines.0.quantity",
      "lines.0.unitPrice",
      "lines.0.lineTotal",
    ]);
  });

  it("does not use binary floating point (0.1 × 3 is exactly 0.3)", () => {
    const run = check([record("inv", { lines: [line("3", "0.1", "0.3")] })], "0");
    expect(byRule(run, "arith-line-total")).toEqual([]);
  });

  it("accepts rounding within the check's tolerance", () => {
    const run = check([record("inv", { lines: [line("3", "3.333", "10.00")] })], "0.01");
    expect(byRule(run, "arith-line-total")).toEqual([]);
    const strict = check([record("inv", { lines: [line("3", "3.333", "10.00")] })], "0.0001");
    expect(byRule(strict, "arith-line-total")).toHaveLength(1);
  });

  it("is not applicable when a line misses one of the three values", () => {
    const run = check([
      record("inv", { lines: [{ quantity: field("3"), lineTotal: field("9") }] }),
    ]);
    expect(statusOf(run, "arith-line-total")).toBe("not_applicable");
  });
});

describe("arith-sum-total", () => {
  it("passes when the line totals add up to the document total", () => {
    const run = check([
      record("inv", {
        header: { totalAmount: field("55.00") },
        lines: [line("1", "25", "25.00"), line("1", "30", "30.00")],
      }),
    ]);
    expect(byRule(run, "arith-sum-total")).toEqual([]);
    expect(statusOf(run, "arith-sum-total")).toBe("passed");
  });

  it("warns when they do not, with sum and difference", () => {
    const run = check([
      record("inv", {
        header: { totalAmount: field("60.00") },
        lines: [line("1", "25", "25.00"), line("1", "30", "30.00")],
      }),
    ]);
    expect(byRule(run, "arith-sum-total")[0]).toMatchObject({
      severity: "warning",
      messageKey: "arith-sum-total",
      params: { sum: { value: "55" }, total: { value: "60" }, difference: { value: "5" } },
    });
  });

  it("cannot be verified when a line has no total", () => {
    const run = check([
      record("inv", {
        header: { totalAmount: field("55.00") },
        lines: [line("1", "25", "25.00"), { description: field("Goods"), quantity: field("1") }],
      }),
    ]);
    expect(byRule(run, "arith-sum-total")[0]).toMatchObject({
      severity: "info",
      unverified: true,
      messageKey: "arith-sum-incomplete",
      params: { count: { kind: "number", value: "1" } },
    });
    expect(statusOf(run, "arith-sum-total")).toBe("unverified");
  });
});

describe("arith-qty-sum", () => {
  it("compares the line quantities with the printed total quantity", () => {
    const run = check([
      record("pl", {
        documentType: "packing_list",
        header: { totalQuantity: field("120") },
        lines: [{ quantity: field("100") }, { quantity: field("10") }],
      }),
    ]);
    expect(byRule(run, "arith-qty-sum")[0]).toMatchObject({
      severity: "warning",
      params: { sum: { value: "110" }, total: { value: "120" } },
    });
  });
});

describe("weight-net-gross", () => {
  const weights = (net: string, netUnit: string | null, gross: string, grossUnit: string | null) =>
    record("pl", {
      documentType: "packing_list",
      header: {
        netWeight: field(net),
        grossWeight: field(gross),
        ...(netUnit ? { netWeightUnit: field(netUnit) } : {}),
        ...(grossUnit ? { grossWeightUnit: field(grossUnit) } : {}),
      },
    });

  it("reports a net weight above the gross weight", () => {
    const run = check([weights("510", "kg", "500", "kg")]);
    expect(byRule(run, "weight-net-gross")[0]).toMatchObject({
      severity: "error",
      params: { net: { value: "510 kg" }, gross: { value: "500 kg" } },
    });
  });

  it("converts units before comparing", () => {
    // 100 lb = 45.359237 kg
    expect(byRule(check([weights("100", "lb", "50", "kg")]), "weight-net-gross")).toEqual([]);
    expect(byRule(check([weights("120", "lb", "50", "kg")]), "weight-net-gross")).toHaveLength(1);
    expect(byRule(check([weights("0.9", "t", "950", "kg")]), "weight-net-gross")).toEqual([]);
  });

  it("does not compare a weight with a unit against one without", () => {
    const run = check([weights("510", "kg", "500", null)]);
    expect(statusOf(run, "weight-net-gross")).toBe("not_applicable");
  });
});
