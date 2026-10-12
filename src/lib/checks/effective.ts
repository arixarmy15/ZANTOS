import {
  fieldKind,
  HEADER_FIELD_KEYS,
  LINE_FIELD_KEYS,
  LOW_CONFIDENCE_THRESHOLD,
  type FieldKind,
  type HeaderFieldKey,
  type LineFieldKey,
} from "@/lib/domain/fields";
import type { ExtractedField } from "@/lib/extraction/schema";
import type { CorrectionRecord, DocumentRecord } from "@/lib/storage/types";

/** A field as the checks see it: the extracted value with any user correction applied. */
export type EffectiveField = ExtractedField & {
  path: string;
  kind: FieldKind;
  corrected: boolean;
  /** The model's normalized value, kept so a correction can be explained and undone. */
  extractedNormalized: string | null;
  lowConfidence: boolean;
};

export type EffectiveDocument = {
  record: DocumentRecord;
  header: Record<HeaderFieldKey, EffectiveField>;
  lines: Record<LineFieldKey, EffectiveField>[];
};

function effective(
  path: string,
  field: ExtractedField,
  corrections: Map<string, CorrectionRecord>,
): EffectiveField {
  const correction = corrections.get(path);
  const kind = fieldKind(path)!;
  if (correction) {
    return {
      ...field,
      path,
      kind,
      normalized: correction.normalized,
      // A value the user confirmed is not "low confidence" any more.
      confidence: 1,
      corrected: true,
      extractedNormalized: field.normalized,
      lowConfidence: false,
    };
  }
  return {
    ...field,
    path,
    kind,
    corrected: false,
    extractedNormalized: field.normalized,
    lowConfidence: field.normalized !== null && field.confidence < LOW_CONFIDENCE_THRESHOLD,
  };
}

export function toEffectiveDocuments(
  documents: DocumentRecord[],
  corrections: CorrectionRecord[],
): EffectiveDocument[] {
  return documents
    .filter((document) => document.extraction !== null)
    .map((document) => {
      const byPath = new Map(
        corrections.filter((c) => c.documentId === document.id).map((c) => [c.path, c]),
      );
      const extraction = document.extraction!;
      // Documents read before a field existed simply do not have it.
      const missing: ExtractedField = {
        value: null,
        normalized: null,
        confidence: 0,
        source: null,
      };
      const header = Object.fromEntries(
        HEADER_FIELD_KEYS.map((key) => [
          key,
          effective(`header.${key}`, extraction.header[key] ?? missing, byPath),
        ]),
      ) as Record<HeaderFieldKey, EffectiveField>;
      const lines = extraction.lines.map(
        (line, index) =>
          Object.fromEntries(
            LINE_FIELD_KEYS.map((key) => [
              key,
              effective(`lines.${index}.${key}`, line[key] ?? missing, byPath),
            ]),
          ) as Record<LineFieldKey, EffectiveField>,
      );
      return { record: document, header, lines };
    });
}

/** Format rules for values typed by the user (DESIGN: "Used for checks" column). */
const NORMALIZED_PATTERNS: Record<FieldKind, RegExp> = {
  text: /^[\s\S]{1,500}$/,
  party: /^[\s\S]{1,300}$/,
  date: /^\d{4}-\d{2}-\d{2}$/,
  amount: /^-?\d{1,15}(?:\.\d{1,6})?$/,
  quantity: /^\d{1,15}(?:\.\d{1,6})?$/,
  currency: /^[A-Z]{3}$/,
  country: /^[A-Z]{2}$/,
  incoterm: /^[A-Z]{3}$/,
  weightUnit: /^(?:kg|g|t|lb)$/,
  hsCode: /^\d{4,12}$/,
  iban: /^[A-Z0-9]{5,34}$/,
  // Tax and customs identifiers from any country; their structure is checked by the rules.
  vatId: /^[A-Z0-9]{3,20}$/,
  eori: /^[A-Z0-9]{3,20}$/,
};

export function isValidNormalized(kind: FieldKind, value: string): boolean {
  if (!NORMALIZED_PATTERNS[kind].test(value)) return false;
  if (kind === "date") {
    const date = new Date(`${value}T00:00:00Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
  }
  return true;
}
