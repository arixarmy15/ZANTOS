import type { EffectiveDocument } from "@/lib/checks/effective";
import type { DocumentRecord } from "@/lib/storage/types";
import type Decimal from "decimal.js";

export type Severity = "error" | "warning" | "info";
export type RuleCategory = "arithmetic" | "crossDocument" | "format" | "completeness";

/**
 * Message parameters carry raw values plus their kind; the interface formats them for
 * the reader's language (Intl), so findings stay language-neutral.
 */
export type ParamKind =
  | "amount"
  | "quantity"
  | "weight"
  | "number"
  | "text"
  | "code"
  | "date"
  | "country"
  | "currency"
  | "document"
  | "documentType"
  | "field";

export type FindingParam = { kind: ParamKind; value: string };

export type Evidence = {
  documentId: string;
  path: string;
  page: number | null;
  /** Verbatim excerpt from the document, as returned by extraction. */
  text: string | null;
  /** The value as printed. */
  printed: string | null;
};

export type Finding = {
  /** Stable within a check, e.g. `arith-line-total:<doc>:lines.2`. */
  id: string;
  ruleId: string;
  category: RuleCategory;
  severity: Severity;
  /** True when the rule could not reach a conclusion (missing data, AI not available). */
  unverified: boolean;
  /** True when part of the conclusion came from an AI comparison. */
  aiAssisted: boolean;
  messageKey: string;
  params: Record<string, FindingParam>;
  documentIds: string[];
  evidence: Evidence[];
  /** Set for findings from a country rule pack. */
  rulePack?: string;
};

export type RuleStatus = "passed" | "failed" | "unverified" | "not_applicable";

export type RuleResult = {
  ruleId: string;
  category: RuleCategory;
  status: RuleStatus;
  /** Set for rules contributed by a country rule pack. */
  rulePack?: string;
};

/** Outcome of an AI comparison of two texts, cached per check. */
export type SemanticVerdict = { same: boolean; confidence: number };

export type RuleContext = {
  /** Documents that have been read, in upload order. */
  documents: EffectiveDocument[];
  /** Uploaded documents that have not been read (yet, or reading failed). */
  unread: DocumentRecord[];
  /** First document of a type (comparisons use one document per type). */
  first: (type: EffectiveDocument["record"]["documentType"]) => EffectiveDocument | undefined;
  tolerance: Decimal;
  semantic: (kind: "party" | "goods", a: string, b: string) => SemanticVerdict | null;
};

export type RuleOutput = { evaluated: number; findings: Finding[] };

export type Rule = {
  id: string;
  category: RuleCategory;
  run: (context: RuleContext) => RuleOutput;
};
