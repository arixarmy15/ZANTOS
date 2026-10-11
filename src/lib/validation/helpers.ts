import Decimal from "decimal.js";
import type { EffectiveDocument, EffectiveField } from "@/lib/checks/effective";
import type { Evidence, Finding, FindingParam, RuleCategory, Severity } from "./types";
import { KILOGRAMS_PER_UNIT } from "./reference";

/** Exact decimal arithmetic for amounts; never binary floating point. */
export function dec(field: EffectiveField | undefined): Decimal | null {
  const value = field?.normalized;
  if (value === null || value === undefined) return null;
  try {
    const parsed = new Decimal(value);
    return parsed.isFinite() ? parsed : null;
  } catch {
    return null;
  }
}

export function present(
  field: EffectiveField | undefined,
): field is EffectiveField & { normalized: string } {
  return field !== undefined && field.normalized !== null && field.normalized.trim() !== "";
}

export function evidence(document: EffectiveDocument, field: EffectiveField): Evidence {
  return {
    documentId: document.record.id,
    path: field.path,
    page: field.source?.page ?? null,
    text: field.source?.text ?? null,
    printed: field.value,
  };
}

export const param = {
  amount: (value: Decimal | string): FindingParam => ({ kind: "amount", value: value.toString() }),
  quantity: (value: Decimal | string): FindingParam => ({
    kind: "quantity",
    value: value.toString(),
  }),
  weight: (value: Decimal, unit: string): FindingParam => ({
    kind: "weight",
    value: `${value.toString()} ${unit}`,
  }),
  number: (value: number): FindingParam => ({ kind: "number", value: String(value) }),
  text: (value: string): FindingParam => ({ kind: "text", value }),
  code: (value: string): FindingParam => ({ kind: "code", value }),
  date: (value: string): FindingParam => ({ kind: "date", value }),
  country: (value: string): FindingParam => ({ kind: "country", value }),
  currency: (value: string): FindingParam => ({ kind: "currency", value }),
  document: (document: EffectiveDocument | string): FindingParam => ({
    kind: "document",
    value: typeof document === "string" ? document : document.record.id,
  }),
  documentType: (value: string): FindingParam => ({ kind: "documentType", value }),
  field: (key: string): FindingParam => ({ kind: "field", value: key }),
};

export function finding(input: {
  ruleId: string;
  category: RuleCategory;
  subject: string;
  severity: Severity;
  messageKey?: string;
  params?: Record<string, FindingParam>;
  documents: (EffectiveDocument | string)[];
  evidence?: Evidence[];
  unverified?: boolean;
  aiAssisted?: boolean;
}): Finding {
  return {
    id: `${input.ruleId}:${input.subject}`,
    ruleId: input.ruleId,
    category: input.category,
    severity: input.severity,
    unverified: input.unverified ?? false,
    aiAssisted: input.aiAssisted ?? false,
    messageKey: input.messageKey ?? input.ruleId,
    params: input.params ?? {},
    documentIds: [
      ...new Set(input.documents.map((doc) => (typeof doc === "string" ? doc : doc.record.id))),
    ],
    evidence: input.evidence ?? [],
  };
}

/** Weight in kilograms, or null when the value or a known unit is missing. */
export function weightInKg(
  value: EffectiveField,
  unit: EffectiveField,
): { kg: Decimal; unit: string } | null {
  const amount = dec(value);
  if (!amount) return null;
  const unitCode = unit.normalized ?? null;
  if (unitCode === null) return { kg: amount, unit: "" };
  const factor = KILOGRAMS_PER_UNIT[unitCode];
  return factor ? { kg: amount.times(factor), unit: unitCode } : null;
}

/** Case-, spacing- and punctuation-insensitive form of a name or reference. */
export function looseText(value: string): string {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase("und")
    .replace(/[\p{P}\p{S}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Reference numbers: only case and whitespace are ignored; dashes and slashes matter. */
export function referenceKey(value: string): string {
  return value.normalize("NFKC").toUpperCase().replace(/\s+/g, "");
}

export const COMPARED_TYPES = ["commercial_invoice", "packing_list", "purchase_order"] as const;

/** Every pair of compared document types that are both present (first of each type). */
export function documentPairs(
  first: (type: (typeof COMPARED_TYPES)[number]) => EffectiveDocument | undefined,
): [EffectiveDocument, EffectiveDocument][] {
  const docs = COMPARED_TYPES.map((type) => first(type)).filter(
    (doc): doc is EffectiveDocument => doc !== undefined,
  );
  const pairs: [EffectiveDocument, EffectiveDocument][] = [];
  for (let i = 0; i < docs.length; i++) {
    for (let j = i + 1; j < docs.length; j++) pairs.push([docs[i]!, docs[j]!]);
  }
  return pairs;
}
