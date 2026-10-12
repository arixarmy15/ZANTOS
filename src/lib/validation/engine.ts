import Decimal from "decimal.js";
import type { EffectiveDocument } from "@/lib/checks/effective";
import { LOW_CONFIDENCE_THRESHOLD } from "@/lib/domain/fields";
import type { DocumentRecord } from "@/lib/storage/types";
import { RULE_PACKS } from "../../../rules";
import { CATEGORY_ORDER, SEVERITY_ORDER } from "./order";
import type { RulePack } from "./rule-pack";
import { lineTotalRule, netGrossRule, quantitySumRule, sumTotalRule } from "./rules/arithmetic";
import { documentSetRule, requiredFieldsRule } from "./rules/completeness";
import {
  currencyRule,
  destinationRule,
  exporterRule,
  goodsRule,
  grossWeightRule,
  hsCodeRule,
  importerRule,
  incotermRule,
  netWeightRule,
  orderReferenceRule,
  originRule,
  packagesRule,
  quantityRule,
} from "./rules/cross-document";
import {
  countryFormatRule,
  currencyFormatRule,
  dateOrderRule,
  hsFormatRule,
  ibanFormatRule,
  incotermFormatRule,
  valueFormatRule,
} from "./rules/format";
import type { Finding, Rule, RuleContext, RuleResult, RuleStatus, SemanticVerdict } from "./types";

/** The universal rules, in the order they are listed in the report. */
export const CORE_RULES: Rule[] = [
  lineTotalRule,
  sumTotalRule,
  quantitySumRule,
  netGrossRule,
  quantityRule,
  packagesRule,
  grossWeightRule,
  netWeightRule,
  orderReferenceRule,
  currencyRule,
  incotermRule,
  originRule,
  destinationRule,
  exporterRule,
  importerRule,
  goodsRule,
  hsCodeRule,
  valueFormatRule,
  currencyFormatRule,
  countryFormatRule,
  incotermFormatRule,
  hsFormatRule,
  ibanFormatRule,
  dateOrderRule,
  requiredFieldsRule,
  documentSetRule,
];

export { CATEGORY_ORDER, SEVERITY_ORDER };

export type SemanticLookup = (
  kind: "party" | "goods",
  a: string,
  b: string,
) => SemanticVerdict | null;

export type CheckRun = {
  findings: Finding[];
  results: RuleResult[];
  /** Ids of the country rule packs that were applied. */
  rulePacks: string[];
};

function status(evaluated: number, findings: Finding[]): RuleStatus {
  if (findings.some((item) => !item.unverified && item.severity !== "info")) return "failed";
  if (findings.some((item) => item.unverified)) return "unverified";
  if (evaluated > 0 || findings.length > 0) return "passed";
  return "not_applicable";
}

function compareFindings(a: Finding, b: Finding): number {
  return (
    SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity) ||
    Number(a.unverified) - Number(b.unverified) ||
    CATEGORY_ORDER.indexOf(a.category) - CATEGORY_ORDER.indexOf(b.category) ||
    0
  );
}

/**
 * Runs every rule over the read documents. Deterministic: the same documents, corrections,
 * tolerance and cached AI verdicts always give the same findings. AI verdicts below the
 * low-confidence threshold count as "could not be verified".
 */
export function runChecks(input: {
  documents: EffectiveDocument[];
  unread?: DocumentRecord[];
  tolerance: string | Decimal;
  semantic?: SemanticLookup;
  rulePacks?: RulePack[];
}): CheckRun {
  const semantic: SemanticLookup = (kind, a, b) => {
    const verdict = input.semantic?.(kind, a, b) ?? null;
    return verdict && verdict.confidence >= LOW_CONFIDENCE_THRESHOLD ? verdict : null;
  };
  const context: RuleContext = {
    documents: input.documents,
    unread: input.unread ?? [],
    first: (type) => input.documents.find((doc) => doc.record.documentType === type),
    tolerance: new Decimal(input.tolerance),
    semantic,
  };

  const destinations = new Set(
    input.documents
      .map((doc) => doc.header.countryOfDestination.normalized)
      .filter((code): code is string => code !== null),
  );
  const packs = (input.rulePacks ?? RULE_PACKS).filter((pack) => destinations.has(pack.country));

  const findings: Finding[] = [];
  const results: RuleResult[] = [];
  const apply = (rule: Rule, pack?: RulePack) => {
    try {
      const output = rule.run(context);
      const own = pack
        ? output.findings.map((item) => ({ ...item, rulePack: pack.id }))
        : output.findings;
      findings.push(...own);
      results.push({
        ruleId: rule.id,
        category: rule.category,
        status: status(output.evaluated, own),
        ...(pack ? { rulePack: pack.id } : {}),
      });
    } catch {
      // A broken rule must not hide the others; it is reported as not verified.
      // Only the rule id is logged, never document content.
      console.error(`TradeCheck rule failed: ${rule.id}`);
      results.push({
        ruleId: rule.id,
        category: rule.category,
        status: "unverified",
        ...(pack ? { rulePack: pack.id } : {}),
      });
    }
  };
  for (const rule of CORE_RULES) apply(rule);
  for (const pack of packs) for (const rule of pack.rules) apply(rule, pack);

  return {
    findings: findings.sort(compareFindings),
    results,
    rulePacks: packs.map((pack) => pack.id),
  };
}
