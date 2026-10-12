import "server-only";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import type { z } from "zod";
import { fallbackOptions, getAnthropic, toAiError, usageFrom } from "@/lib/anthropic/client";
import { AiError, type TokenUsage } from "./errors";
import type { AiPart, StructuredInput } from "./types";

function block(part: AiPart) {
  if (part.type === "text") return { type: "text", text: part.text } as const;
  const data = Buffer.from(part.data).toString("base64");
  return part.type === "pdf"
    ? ({
        type: "document",
        source: { type: "base64", media_type: "application/pdf", data },
      } as const)
    : ({ type: "image", source: { type: "base64", media_type: part.mimeType, data } } as const);
}

/** Claude reads PDFs and images natively and returns schema-constrained output. */
export async function anthropicStructured<S extends z.ZodType>(
  model: string,
  input: StructuredInput<S>,
): Promise<{ output: z.infer<S>; usage: TokenUsage }> {
  const client = getAnthropic();
  let response;
  try {
    response = await client.beta.messages.parse({
      model,
      max_tokens: input.maxTokens,
      // The system prompt carries no per-request data, so it can be cached.
      system: [{ type: "text", text: input.system, cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content: input.parts.map(block) }],
      output_config: { effort: input.effort, format: betaZodOutputFormat(input.schema) },
      ...fallbackOptions(model),
    });
  } catch (error) {
    throw toAiError(error);
  }

  const usage = usageFrom(response);
  if (response.stop_reason === "refusal") throw new AiError("refused", usage);
  if (response.stop_reason === "max_tokens") throw new AiError("truncated", usage);
  // The SDK validates against the schema; validate again so nothing unchecked is stored.
  const checked = input.schema.safeParse(response.parsed_output);
  if (!checked.success) throw new AiError("invalid_output", usage);
  return { output: checked.data, usage };
}
