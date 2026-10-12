import "server-only";
import type { z } from "zod";
import { getServerEnv, resolveRoute, type AiTask } from "@/lib/config/env";
import { anthropicStructured } from "./anthropic";
import { AiError, type TokenUsage } from "./errors";
import { openAiCompatibleStructured } from "./openai-compatible";
import type { StructuredInput } from "./types";

/**
 * One structured request for a task, sent to the provider and model the configuration
 * routes that task to. Callers never see the provider's wire format.
 */
export async function generateStructured<S extends z.ZodType>(
  task: AiTask,
  input: StructuredInput<S>,
): Promise<{ output: z.infer<S>; usage: TokenUsage }> {
  const env = getServerEnv();
  const route = resolveRoute(env, task);
  if (!route.model) throw new AiError("not_configured");
  if (route.provider === "anthropic") return anthropicStructured(route.model, input);
  if (!env.OPENAI_COMPATIBLE_BASE_URL) throw new AiError("not_configured");
  return openAiCompatibleStructured(
    {
      baseUrl: env.OPENAI_COMPATIBLE_BASE_URL,
      apiKey: env.OPENAI_COMPATIBLE_API_KEY,
      model: route.model,
    },
    input,
  );
}
