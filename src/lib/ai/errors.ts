/** Provider-neutral error codes; the interface translates each one. */
export type AiErrorCode =
  | "not_configured"
  | "refused"
  | "truncated"
  | "invalid_output"
  | "auth"
  | "rate_limited"
  | "unreachable"
  | "document_too_large"
  | "unsupported_document"
  | "api_error"
  /** A failure in Tickline itself, not in the provider's answer. */
  | "internal";

export type TokenUsage = {
  model: string;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
};

export class AiError extends Error {
  constructor(
    readonly code: AiErrorCode,
    /** Present when the request reached the model and was billed. */
    readonly usage: TokenUsage | null = null,
  ) {
    super(`AI request failed: ${code}`);
    this.name = "AiError";
  }
}

/** Any failure as an AiError; unexpected ones are reported as internal, never as a bad answer. */
export function asAiError(error: unknown): AiError {
  return error instanceof AiError ? error : new AiError("internal");
}

/** HTTP status for an AI failure: our side (500), not set up (503) or the provider (502). */
export function aiErrorStatus(error: AiError): number {
  if (error.code === "internal") return 500;
  return error.code === "not_configured" ? 503 : 502;
}

/** Errors are logged by code only: never the request, the response or document content. */
export function logAiError(operation: string, error: AiError) {
  console.warn(`[tickline] ${operation} failed: ${error.code}`);
}
