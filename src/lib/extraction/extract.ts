import "server-only";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import {
  AiError,
  fallbackOptions,
  getAnthropic,
  getModel,
  toAiError,
  usageFrom,
  type TokenUsage,
} from "@/lib/anthropic/client";
import type { SupportedMimeType } from "@/lib/upload/file-type";
import { EXTRACTION_SYSTEM_PROMPT, EXTRACTION_USER_PROMPT } from "./prompt";
import { extractionSchema, sanitizeExtraction, type Extraction } from "./schema";

export type ExtractionResult = { extraction: Extraction; usage: TokenUsage };

export async function extractDocument(input: {
  bytes: Uint8Array;
  mimeType: SupportedMimeType;
  pageCount: number | null;
}): Promise<ExtractionResult> {
  const client = getAnthropic();
  const model = getModel();
  const data = Buffer.from(input.bytes).toString("base64");
  const file =
    input.mimeType === "application/pdf"
      ? ({
          type: "document",
          source: { type: "base64", media_type: "application/pdf", data },
        } as const)
      : ({ type: "image", source: { type: "base64", media_type: input.mimeType, data } } as const);

  let response;
  try {
    response = await client.beta.messages.parse({
      model,
      max_tokens: 16000,
      system: [
        { type: "text", text: EXTRACTION_SYSTEM_PROMPT, cache_control: { type: "ephemeral" } },
      ],
      messages: [{ role: "user", content: [file, { type: "text", text: EXTRACTION_USER_PROMPT }] }],
      // Careful transcription without the cost of the highest effort levels.
      output_config: { effort: "medium", format: betaZodOutputFormat(extractionSchema) },
      ...fallbackOptions(model),
    });
  } catch (error) {
    throw toAiError(error);
  }

  const usage = usageFrom(response);
  if (response.stop_reason === "refusal") throw new AiError("refused", usage);
  if (response.stop_reason === "max_tokens") throw new AiError("truncated", usage);

  // The SDK validates against the schema; validate again so nothing unchecked is stored.
  const checked = extractionSchema.safeParse(response.parsed_output);
  if (!checked.success) throw new AiError("invalid_output", usage);

  return { extraction: sanitizeExtraction(checked.data, input.pageCount), usage };
}
