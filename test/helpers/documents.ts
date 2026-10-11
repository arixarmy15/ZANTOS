import { toEffectiveDocuments, type EffectiveDocument } from "@/lib/checks/effective";
import type { CorrectionRecord, DocumentRecord } from "@/lib/storage/types";
import type { Extraction } from "@/lib/extraction/schema";
import { extraction } from "./extraction";

/**
 * Test-only document records built from synthetic extraction results. They exercise the
 * rules; they are never shown in the product and are not sample documents.
 */
export function record(
  id: string,
  input: Parameters<typeof extraction>[0] = {},
  options: { read?: boolean } = {},
): DocumentRecord {
  const result: Extraction | null = options.read === false ? null : extraction(input);
  return {
    id,
    checkId: "check",
    fileName: `${id}.pdf`,
    mimeType: "application/pdf",
    size: 1,
    pageCount: 1,
    createdAt: "",
    status: result ? "extracted" : "uploaded",
    errorCode: null,
    documentType: result?.documentType ?? null,
    documentLanguage: result?.documentLanguage ?? null,
    extraction: result,
    extractedAt: result ? "" : null,
  };
}

export function effective(
  records: DocumentRecord[],
  corrections: CorrectionRecord[] = [],
): EffectiveDocument[] {
  return toEffectiveDocuments(records, corrections);
}
