import "server-only";
import type { TokenUsage } from "@/lib/ai/errors";
import { generateStructured } from "@/lib/ai/generate";
import type { SupportedMimeType } from "@/lib/upload/file-type";
import { EXTRACTION_SYSTEM_PROMPT, EXTRACTION_USER_PROMPT } from "./prompt";
import { extractionSchema, sanitizeExtraction, type Extraction } from "./schema";

export type ExtractionResult = { extraction: Extraction; usage: TokenUsage };

export async function extractDocument(input: {
  bytes: Uint8Array;
  mimeType: SupportedMimeType;
  pageCount: number | null;
}): Promise<ExtractionResult> {
  const document =
    input.mimeType === "application/pdf"
      ? ({ type: "pdf", data: input.bytes } as const)
      : ({ type: "image", mimeType: input.mimeType, data: input.bytes } as const);

  const { output, usage } = await generateStructured("extract", {
    system: EXTRACTION_SYSTEM_PROMPT,
    parts: [document, { type: "text", text: EXTRACTION_USER_PROMPT }],
    schema: extractionSchema,
    maxTokens: 16000,
    // Careful transcription without the cost of the highest effort levels.
    effort: "medium",
  });
  return { extraction: sanitizeExtraction(output, input.pageCount), usage };
}
