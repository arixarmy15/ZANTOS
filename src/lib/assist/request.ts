import "server-only";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import type { z } from "zod";
import {
  AiError,
  fallbackOptions,
  getAnthropic,
  getModel,
  toAiError,
  usageFrom,
  type TokenUsage,
} from "@/lib/anthropic/client";

/** One structured-output request with the same safety handling as extraction. */
export async function structuredRequest<T extends z.ZodType>(input: {
  system: string;
  user: string;
  schema: T;
  maxTokens: number;
}): Promise<{ output: z.infer<T>; usage: TokenUsage }> {
  const client = getAnthropic();
  const model = getModel();
  let response;
  try {
    response = await client.beta.messages.parse({
      model,
      max_tokens: input.maxTokens,
      system: [{ type: "text", text: input.system, cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content: input.user }],
      output_config: { effort: "low", format: betaZodOutputFormat(input.schema) },
      ...fallbackOptions(model),
    });
  } catch (error) {
    throw toAiError(error);
  }
  const usage = usageFrom(response);
  if (response.stop_reason === "refusal") throw new AiError("refused", usage);
  if (response.stop_reason === "max_tokens") throw new AiError("truncated", usage);
  const checked = input.schema.safeParse(response.parsed_output);
  if (!checked.success) throw new AiError("invalid_output", usage);
  return { output: checked.data, usage };
}
