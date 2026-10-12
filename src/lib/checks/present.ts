import { parseFieldPath, type DocumentType } from "@/lib/domain/fields";
import { formatDecimal, formatIsoDate, formatNormalized } from "@/lib/format";
import type { CheckRun } from "@/lib/validation/engine";
import type {
  Finding,
  FindingParam,
  RuleCategory,
  RuleStatus,
  Severity,
} from "@/lib/validation/types";

/** A next-intl translator, or anything with the same shape (tests). */
export type Translate = (key: string, values?: Record<string, string | number>) => string;

export type DisplayStatus = Severity | "unverified";

export type EvidenceView = {
  documentId: string;
  documentName: string;
  fieldLabel: string;
  page: number | null;
  /** Verbatim excerpt from the document; untrusted text, always rendered as text. */
  text: string | null;
  printed: string | null;
};

export type QuoteView = {
  documentId: string;
  documentName: string;
  page: number | null;
  text: string;
  fields: string[];
};

export type FindingView = {
  id: string;
  /** Reference tag, `F1`, `F2`… in report order. */
  ref: string;
  ruleId: string;
  ruleTitle: string;
  category: RuleCategory;
  severity: Severity;
  status: DisplayStatus;
  unverified: boolean;
  aiAssisted: boolean;
  rulePack: string | null;
  message: string;
  documentIds: string[];
  evidence: EvidenceView[];
  quotes: QuoteView[];
};

export type RuleView = {
  ruleId: string;
  title: string;
  category: RuleCategory;
  status: RuleStatus;
  rulePack: string | null;
  findingCount: number;
};

export type CheckSummary = {
  counts: Record<DisplayStatus, number>;
  /** Issues (errors, warnings, unverified) per category, for the category chart. */
  issuesByCategory: Record<RuleCategory, number>;
  rules: Record<RuleStatus, number>;
};

type Documents = Map<string, { fileName: string; documentType: DocumentType | null }>;

// First strong isolate / pop directional isolate: keeps file names, codes and quoted text
// from reordering the surrounding sentence in right-to-left languages.
const isolate = (value: string) => `⁨${value}⁩`;

/** Amounts show at least two decimals: exact arithmetic drops trailing zeros (9.00 → 9). */
export function withCents(value: string): string {
  if (!/^-?\d+(?:\.\d+)?$/.test(value)) return value;
  const [whole, fraction = ""] = value.split(".");
  return `${whole}.${fraction.padEnd(2, "0")}`;
}

/** Evidence excerpts quoted once, with every field they support. */
export function quotes(evidence: EvidenceView[]): QuoteView[] {
  const grouped: QuoteView[] = [];
  for (const item of evidence) {
    if (!item.text) continue;
    const existing = grouped.find(
      (quote) =>
        quote.documentId === item.documentId &&
        quote.page === item.page &&
        quote.text === item.text,
    );
    if (existing) {
      if (!existing.fields.includes(item.fieldLabel)) existing.fields.push(item.fieldLabel);
    } else {
      grouped.push({
        documentId: item.documentId,
        documentName: item.documentName,
        page: item.page,
        text: item.text,
        fields: [item.fieldLabel],
      });
    }
  }
  return grouped;
}

export function fieldLabel(path: string, t: Translate): string {
  const parsed = parseFieldPath(path);
  if (!parsed) return t(`fields.labels.${path}`);
  const label = t(`fields.labels.${parsed.key}`);
  return parsed.scope === "header"
    ? label
    : `${t("fields.line", { number: parsed.index + 1 })} · ${label}`;
}

function formatParam(
  param: FindingParam,
  context: { locale: string; t: Translate; documents: Documents },
): string | number {
  const { locale, t, documents } = context;
  switch (param.kind) {
    case "amount":
      return isolate(formatDecimal(withCents(param.value), locale));
    case "quantity":
      return isolate(formatDecimal(param.value, locale));
    case "weight": {
      const [value = "", unit = ""] = param.value.split(" ");
      return isolate(`${formatDecimal(value, locale)}${unit ? ` ${unit}` : ""}`);
    }
    case "number":
      return Number(param.value);
    case "date":
      return isolate(formatIsoDate(param.value, locale));
    case "country":
      return isolate(formatNormalized("country", param.value, locale));
    case "document":
      return isolate(documents.get(param.value)?.fileName ?? param.value);
    case "documentType":
      return t(`document.types.${param.value}`);
    case "field":
      return fieldLabel(param.value, t);
    case "text":
    case "code":
    case "currency":
      return isolate(param.value);
  }
}

export function presentFindings(
  findings: Finding[],
  context: { locale: string; t: Translate; documents: Documents },
): FindingView[] {
  return findings.map((finding, index) => {
    const evidence = finding.evidence.map((item) => ({
      documentId: item.documentId,
      documentName: context.documents.get(item.documentId)?.fileName ?? item.documentId,
      fieldLabel: fieldLabel(item.path, context.t),
      page: item.page,
      text: item.text,
      printed: item.printed,
    }));
    const values = Object.fromEntries(
      Object.entries(finding.params).map(([name, param]) => [name, formatParam(param, context)]),
    );
    return {
      id: finding.id,
      ref: `F${index + 1}`,
      ruleId: finding.ruleId,
      ruleTitle: context.t(`findings.rules.${finding.ruleId}`),
      category: finding.category,
      severity: finding.severity,
      status: finding.unverified ? "unverified" : finding.severity,
      unverified: finding.unverified,
      aiAssisted: finding.aiAssisted,
      rulePack: finding.rulePack ?? null,
      message: context.t(`findings.messages.${finding.messageKey}`, values),
      documentIds: finding.documentIds,
      evidence,
      quotes: quotes(evidence),
    };
  });
}

export function presentRules(run: CheckRun, t: Translate): RuleView[] {
  return run.results.map((result) => ({
    ruleId: result.ruleId,
    title: t(`findings.rules.${result.ruleId}`),
    category: result.category,
    status: result.status,
    rulePack: result.rulePack ?? null,
    findingCount: run.findings.filter((item) => item.ruleId === result.ruleId).length,
  }));
}

export function summarize(run: CheckRun): CheckSummary {
  const counts: Record<DisplayStatus, number> = { error: 0, warning: 0, info: 0, unverified: 0 };
  const issuesByCategory: Record<RuleCategory, number> = {
    arithmetic: 0,
    crossDocument: 0,
    format: 0,
    completeness: 0,
  };
  for (const finding of run.findings) {
    const status: DisplayStatus = finding.unverified ? "unverified" : finding.severity;
    counts[status]++;
    if (status !== "info") issuesByCategory[finding.category]++;
  }
  const rules: Record<RuleStatus, number> = {
    passed: 0,
    failed: 0,
    unverified: 0,
    not_applicable: 0,
  };
  for (const result of run.results) rules[result.status]++;
  return { counts, issuesByCategory, rules };
}
