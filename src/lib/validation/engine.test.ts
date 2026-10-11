import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { RULE_PACKS } from "../../../rules";
import en from "../../../messages/en.json";
import { effective, record } from "../../../test/helpers/documents";
import { field } from "../../../test/helpers/extraction";
import { CORE_RULES, runChecks } from "./engine";
import { validateRulePack, type RulePack } from "./rule-pack";
import { collectSemanticRequests, semanticKey, semanticLookup } from "./semantic";
import type { Rule } from "./types";

const invoice = record("inv", {
  documentType: "commercial_invoice",
  header: {
    totalAmount: field("100"),
    currency: field("EUR"),
    countryOfDestination: field("DE"),
    sellerName: field("Anatolia Textiles Ltd"),
    packageCount: field("10"),
  },
  lines: [
    {
      description: field("Towels"),
      quantity: field("10"),
      unitPrice: field("9"),
      lineTotal: field("90"),
    },
  ],
});
const packing = record("pl", {
  documentType: "packing_list",
  header: {
    shipperName: field("Anatolia Tekstil A.Ş."),
    packageCount: field("11"),
    netWeight: field("12"),
    netWeightUnit: field("kg"),
    grossWeight: field("10"),
    grossWeightUnit: field("kg"),
  },
  lines: [{ description: field("Bath towels"), quantity: field("10") }],
});

const baseInput = { documents: effective([invoice, packing]), tolerance: "0.01", rulePacks: [] };

describe("runChecks", () => {
  it("sorts findings by severity, errors first", () => {
    const { findings } = runChecks(baseInput);
    const order = findings.map((item) => item.severity);
    expect(order).toEqual(
      [...order].sort(
        (a, b) => ["error", "warning", "info"].indexOf(a) - ["error", "warning", "info"].indexOf(b),
      ),
    );
    expect(order[0]).toBe("error");
  });

  it("is deterministic", () => {
    expect(runChecks(baseInput)).toEqual(runChecks(baseInput));
  });

  it("gives every core rule exactly one result with a status", () => {
    const { results } = runChecks(baseInput);
    expect(results.map((result) => result.ruleId)).toEqual(CORE_RULES.map((rule) => rule.id));
    const status = Object.fromEntries(results.map((result) => [result.ruleId, result.status]));
    expect(status["arith-line-total"]).toBe("passed");
    expect(status["arith-sum-total"]).toBe("failed");
    expect(status["weight-net-gross"]).toBe("failed");
    expect(status["xdoc-packages"]).toBe("failed");
    expect(status["xdoc-exporter"]).toBe("unverified");
    expect(status["xdoc-currency"]).toBe("not_applicable");
    expect(status["fmt-currency"]).toBe("passed");
  });

  it("gives every finding a unique id", () => {
    const { findings } = runChecks(baseInput);
    expect(new Set(findings.map((item) => item.id)).size).toBe(findings.length);
  });

  it("uses corrected values", () => {
    const corrected = runChecks({
      ...baseInput,
      documents: effective(
        [invoice, packing],
        [{ documentId: "pl", path: "header.packageCount", normalized: "10", correctedAt: "" }],
      ),
    });
    expect(corrected.findings.some((item) => item.ruleId === "xdoc-packages")).toBe(false);
  });

  it("keeps running when a rule fails and reports that rule as not verified", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const broken: Rule = {
      id: "pack-de-broken",
      category: "format",
      run: () => {
        throw new Error("bug");
      },
    };
    const pack: RulePack = {
      country: "DE",
      id: "de-test",
      version: "test",
      sources: [],
      rules: [broken],
    };
    const result = runChecks({ ...baseInput, rulePacks: [pack] });
    expect(result.results.at(-1)).toEqual({
      ruleId: "pack-de-broken",
      category: "format",
      status: "unverified",
      rulePack: "de-test",
    });
    expect(result.results).toHaveLength(CORE_RULES.length + 1);
    expect(error).toHaveBeenCalledWith("TradeCheck rule failed: pack-de-broken");
    error.mockRestore();
  });
});

describe("rule packs", () => {
  const rule: Rule = {
    id: "pack-de-example",
    category: "completeness",
    run: ({ documents }) => ({
      evaluated: 1,
      findings: [
        {
          id: "pack-de-example:x",
          ruleId: "pack-de-example",
          category: "completeness",
          severity: "info",
          unverified: false,
          aiAssisted: false,
          messageKey: "pack-de-example",
          params: {},
          documentIds: [documents[0]!.record.id],
          evidence: [],
        },
      ],
    }),
  };
  const pack: RulePack = {
    country: "DE",
    id: "de-test",
    version: "test",
    sources: [
      { title: "Test", publisher: "Test", url: "https://example.org", retrieved: "2026-01-01" },
    ],
    rules: [rule],
  };

  it("applies a pack only when a document names its country as destination", () => {
    const applied = runChecks({ ...baseInput, rulePacks: [pack] });
    expect(applied.rulePacks).toEqual(["de-test"]);
    expect(applied.findings.find((item) => item.ruleId === "pack-de-example")?.rulePack).toBe(
      "de-test",
    );

    const other = runChecks({
      ...baseInput,
      rulePacks: [{ ...pack, country: "FR", id: "fr-test" }],
    });
    expect(other.rulePacks).toEqual([]);
    expect(other.findings.some((item) => item.ruleId === "pack-de-example")).toBe(false);
  });

  it("validates pack metadata and sources", () => {
    expect(validateRulePack(pack)).toEqual([]);
    expect(
      validateRulePack({
        ...pack,
        country: "ZZ",
        id: "x",
        sources: [
          { title: "Blog", publisher: "", url: "http://example.org", retrieved: "recently" },
        ],
        rules: [{ ...rule, id: "other-rule" }],
      }),
    ).toHaveLength(6);
    expect(validateRulePack({ ...pack, sources: [], rules: [] })).toEqual([
      "at least one official source is required",
      "a pack needs at least one rule",
    ]);
  });

  it("registers only valid packs (none ship without verified sources)", () => {
    for (const registered of RULE_PACKS) expect(validateRulePack(registered)).toEqual([]);
  });
});

describe("semantic comparisons", () => {
  it("keys a pair independently of order", () => {
    expect(semanticKey("party", "A", "B")).toBe(semanticKey("party", "B", "A"));
    expect(semanticKey("party", "A", "B")).not.toBe(semanticKey("goods", "A", "B"));
  });

  it("collects exactly the comparisons the rules need", () => {
    const requests = collectSemanticRequests(baseInput);
    expect(requests.map((request) => [request.kind, request.a, request.b])).toEqual([
      ["party", "Anatolia Textiles Ltd", "Anatolia Tekstil A.Ş."],
      ["goods", "Towels", "Bath towels"],
    ]);
  });

  it("feeds cached verdicts back into the rules", () => {
    const verdicts = new Map(
      collectSemanticRequests(baseInput).map((request) => [
        request.key,
        { same: true, confidence: 0.9 },
      ]),
    );
    const { findings } = runChecks({ ...baseInput, semantic: semanticLookup(verdicts) });
    expect(findings.find((item) => item.ruleId === "xdoc-exporter")?.messageKey).toBe(
      "xdoc-exporter-same",
    );
    expect(findings.some((item) => item.ruleId === "xdoc-goods")).toBe(false);
  });
});

describe("finding messages", () => {
  const messages = en.findings.messages as Record<string, string>;
  const titles = en.findings.rules as Record<string, string>;

  it("has a title for every core rule", () => {
    for (const rule of CORE_RULES) expect(titles[rule.id], rule.id).toBeTypeOf("string");
  });

  it("has a message for every message key the rules can produce", () => {
    const rulesDir = path.join(__dirname, "rules");
    const literals = new Set<string>();
    for (const file of readdirSync(rulesDir).filter((name) => !name.includes(".test."))) {
      const source = readFileSync(path.join(rulesDir, file), "utf8");
      for (const match of source.matchAll(
        /"((?:arith|weight|xdoc|fmt|date|req|rec|doc|docset)-[a-z0-9-]+)"/g,
      )) {
        literals.add(match[1]!);
      }
    }
    for (const role of ["exporter", "importer"])
      for (const outcome of ["same", "different", "unknown"])
        literals.add(`xdoc-${role}-${outcome}`);
    const ruleIds = new Set(CORE_RULES.map((rule) => rule.id));
    for (const key of literals) {
      if (ruleIds.has(key) && !(key in messages)) continue;
      expect(messages[key], key).toBeTypeOf("string");
    }
    // And no message is left over without a rule that produces it.
    for (const key of Object.keys(messages)) expect(literals.has(key), key).toBe(true);
  });
});
