import type { z } from "zod";

/** Input to a model, independent of the provider's wire format. */
export type AiPart =
  | { type: "text"; text: string }
  | { type: "pdf"; data: Uint8Array }
  | { type: "image"; mimeType: "image/png" | "image/jpeg"; data: Uint8Array };

export type StructuredInput<S extends z.ZodType> = {
  system: string;
  parts: AiPart[];
  /** The answer must match this schema; anything else is rejected, never repaired. */
  schema: S;
  maxTokens: number;
  /** Reasoning effort, where the provider supports it. */
  effort: "low" | "medium";
};
