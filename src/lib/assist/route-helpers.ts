import "server-only";
import { AiError, aiErrorStatus, asAiError, logAiError, type TokenUsage } from "@/lib/ai/errors";
import { errorResponse } from "@/lib/api/http";
import type { Storage, UsageKind } from "@/lib/storage/types";

/**
 * Runs an AI request once per distinct input: the answer is cached under a content hash, and
 * the tokens used are recorded even when the answer is rejected.
 */
export async function cachedAssist<T>(input: {
  storage: Storage;
  checkId: string;
  kind: UsageKind;
  cacheKey: string;
  run: () => Promise<{ output: T; usage: TokenUsage }>;
}): Promise<{ ok: true; output: T; cached: boolean } | { ok: false; response: Response }> {
  const { storage, checkId, kind, cacheKey } = input;
  const cached = await storage.getCached<T>(checkId, cacheKey);
  if (cached) return { ok: true, output: cached, cached: true };
  try {
    const { output, usage } = await input.run();
    await storage.recordUsage({ checkId, documentId: null, kind, ...usage });
    await storage.setCached(checkId, cacheKey, output);
    return { ok: true, output, cached: false };
  } catch (caught) {
    const error: AiError = asAiError(caught);
    logAiError(kind, error);
    if (error.usage) await storage.recordUsage({ checkId, documentId: null, kind, ...error.usage });
    return {
      ok: false,
      response: errorResponse(error.code, aiErrorStatus(error)),
    };
  }
}
