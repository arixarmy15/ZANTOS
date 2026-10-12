import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { AiError, type TokenUsage } from "@/lib/ai/errors";
import { getServerEnv } from "@/lib/config/env";

/** Server-side refusal fallback ("default" form, Claude API only) is accepted on these models. */
const SERVER_FALLBACK_MODELS = new Set([
  "claude-sonnet-5-5",
  "claude-opus-5-5",
  "claude-opus-5",
  "claude-fable-5-1",
]);
const SERVER_FALLBACK_BETA = "server-side-fallback-2026-07-01";

export { AiError, logAiError } from "@/lib/ai/errors";
export type { AiErrorCode, TokenUsage } from "@/lib/ai/errors";

let client: Anthropic | undefined;

export function getAnthropic(): Anthropic {
  const env = getServerEnv();
  if (!env.ANTHROPIC_API_KEY) throw new AiError("not_configured");
  client ??= new Anthropic({ apiKey: env.ANTHROPIC_API_KEY, maxRetries: 2, timeout: 180_000 });
  return client;
}

/** Opt into server-side refusal fallback where the configured model supports it. */
export function fallbackOptions(model: string) {
  return SERVER_FALLBACK_MODELS.has(model)
    ? { betas: [SERVER_FALLBACK_BETA], fallbacks: "default" as const }
    : {};
}

type UsageLike = {
  input_tokens: number;
  output_tokens: number;
  cache_read_input_tokens?: number | null;
  cache_creation_input_tokens?: number | null;
};

export function usageFrom(response: { model: string; usage: UsageLike }): TokenUsage {
  return {
    model: response.model,
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
    cacheReadTokens: response.usage.cache_read_input_tokens ?? 0,
    cacheWriteTokens: response.usage.cache_creation_input_tokens ?? 0,
  };
}

/** Maps SDK errors to stable codes by class and status, never by message text. */
export function toAiError(error: unknown): AiError {
  if (error instanceof AiError) return error;
  if (
    error instanceof Anthropic.AuthenticationError ||
    error instanceof Anthropic.PermissionDeniedError
  ) {
    return new AiError("auth");
  }
  if (error instanceof Anthropic.RateLimitError) return new AiError("rate_limited");
  if (error instanceof Anthropic.APIConnectionError) return new AiError("unreachable");
  if (error instanceof Anthropic.APIError) {
    return new AiError(error.status === 413 ? "document_too_large" : "api_error");
  }
  // Anything else (for example a structured output the SDK could not parse).
  return new AiError("invalid_output");
}
