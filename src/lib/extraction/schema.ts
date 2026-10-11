import { z } from "zod";
import {
  DOCUMENT_TYPES,
  HEADER_FIELD_KEYS,
  LINE_FIELD_KEYS,
  type HeaderFieldKey,
  type LineFieldKey,
} from "@/lib/domain/fields";

/**
 * Shape the model must return. Sent as a structured-output schema and validated again
 * here; anything that does not match is rejected, never repaired by guessing.
 */
export const evidenceSchema = z.object({
  page: z.number().int().min(1),
  text: z.string(),
});

export const extractedFieldSchema = z.object({
  /** Exactly as printed, in the document's own language and script. */
  value: z.string().nullable(),
  /** Machine-readable form (ISO dates and codes, plain decimals). */
  normalized: z.string().nullable(),
  confidence: z.number().min(0).max(1),
  source: evidenceSchema.nullable(),
});

const headerShape = Object.fromEntries(
  HEADER_FIELD_KEYS.map((key) => [key, extractedFieldSchema]),
) as Record<HeaderFieldKey, typeof extractedFieldSchema>;

const lineShape = Object.fromEntries(
  LINE_FIELD_KEYS.map((key) => [key, extractedFieldSchema]),
) as Record<LineFieldKey, typeof extractedFieldSchema>;

export const extractionSchema = z.object({
  documentType: z.enum(DOCUMENT_TYPES),
  /** BCP 47 primary language of the document, e.g. "en", "tr", "zh". */
  documentLanguage: z.string(),
  header: z.object(headerShape),
  lines: z.array(z.object(lineShape)),
});

export type Evidence = z.infer<typeof evidenceSchema>;
export type ExtractedField = z.infer<typeof extractedFieldSchema>;
export type Extraction = z.infer<typeof extractionSchema>;
export type ExtractionLine = Extraction["lines"][number];

const LANGUAGE_TAG = /^[a-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/;

/**
 * Post-validation that needs facts the schema cannot know: evidence must point at a page
 * that exists. Evidence that does not is dropped (the value stays, marked as having no
 * source) rather than trusted.
 */
export function sanitizeExtraction(extraction: Extraction, pageCount: number | null): Extraction {
  const fixField = (field: ExtractedField): ExtractedField => {
    const pageOk = field.source && (pageCount === null || field.source.page <= pageCount);
    const textOk = field.source && field.source.text.trim().length > 0;
    return { ...field, source: pageOk && textOk ? field.source : null };
  };
  const mapFields = <K extends string>(record: Record<K, ExtractedField>) =>
    Object.fromEntries(
      Object.entries(record).map(([key, field]) => [key, fixField(field as ExtractedField)]),
    ) as Record<K, ExtractedField>;

  return {
    documentType: extraction.documentType,
    documentLanguage: LANGUAGE_TAG.test(extraction.documentLanguage)
      ? extraction.documentLanguage
      : "und",
    header: mapFields(extraction.header),
    lines: extraction.lines.map((line) => mapFields(line)),
  };
}
