import {
  HEADER_FIELD_KEYS,
  LINE_FIELD_KEYS,
  type HeaderFieldKey,
  type LineFieldKey,
} from "@/lib/domain/fields";
import type { ExtractedField, Extraction } from "@/lib/extraction/schema";

/**
 * Test-only builders for extraction results. They exist to exercise code paths; they are
 * never shown in the product and are not sample documents.
 */
export const missing: ExtractedField = {
  value: null,
  normalized: null,
  confidence: 0,
  source: null,
};

export function field(normalized: string, options: Partial<ExtractedField> = {}): ExtractedField {
  return {
    value: options.value ?? normalized,
    normalized,
    confidence: options.confidence ?? 0.95,
    source: options.source === undefined ? { page: 1, text: normalized } : options.source,
  };
}

export function extraction(
  input: {
    documentType?: Extraction["documentType"];
    documentLanguage?: string;
    header?: Partial<Record<HeaderFieldKey, ExtractedField>>;
    lines?: Partial<Record<LineFieldKey, ExtractedField>>[];
  } = {},
): Extraction {
  const header = Object.fromEntries(
    HEADER_FIELD_KEYS.map((key) => [key, input.header?.[key] ?? missing]),
  ) as Extraction["header"];
  const lines = (input.lines ?? []).map(
    (line) =>
      Object.fromEntries(
        LINE_FIELD_KEYS.map((key) => [key, line[key] ?? missing]),
      ) as Extraction["lines"][number],
  );
  return {
    documentType: input.documentType ?? "commercial_invoice",
    documentLanguage: input.documentLanguage ?? "en",
    header,
    lines,
  };
}
