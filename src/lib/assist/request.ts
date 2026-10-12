import "server-only";
import type { z } from "zod";
import type { TokenUsage } from "@/lib/ai/errors";
import { generateStructured } from "@/lib/ai/generate";
import type { AiTask } from "@/lib/config/env";

/** One structured text request for an assist task, on the provider routed to that task. */
export async function structuredRequest<T extends z.ZodType>(input: {
  task: Extract<AiTask, "explain" | "email">;
  system: string;
  user: string;
  schema: T;
  maxTokens: number;
}): Promise<{ output: z.infer<T>; usage: TokenUsage }> {
  return generateStructured(input.task, {
    system: input.system,
    parts: [{ type: "text", text: input.user }],
    schema: input.schema,
    maxTokens: input.maxTokens,
    effort: "low",
  });
}
