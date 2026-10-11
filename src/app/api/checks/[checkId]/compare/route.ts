import { NextResponse } from "next/server";
import { logAiError, toAiError } from "@/lib/anthropic/client";
import { errorResponse, findCheck } from "@/lib/api/http";
import { compareCacheKey, evaluateCheck } from "@/lib/checks/evaluate";
import { COMPARE_BATCH_SIZE, compareTexts } from "@/lib/comparison/compare";
import { getServerEnv, isAnthropicConfigured } from "@/lib/config/env";
import { getStorage } from "@/lib/storage";

type Context = { params: Promise<{ checkId: string }> };

export const maxDuration = 300;

/**
 * Asks the model only for the name and description comparisons that have no cached
 * verdict yet. Everything else in the check is computed by code.
 */
export async function POST(_request: Request, { params }: Context) {
  const { checkId } = await params;
  const found = await findCheck(checkId);
  if ("response" in found) return found.response;
  if (!isAnthropicConfigured(getServerEnv())) return errorResponse("not_configured", 503);

  const storage = await getStorage();
  const { pending } = await evaluateCheck(storage, found.check);
  let compared = 0;
  for (let start = 0; start < pending.length; start += COMPARE_BATCH_SIZE) {
    const batch = pending.slice(start, start + COMPARE_BATCH_SIZE);
    try {
      const { verdicts, usage } = await compareTexts(batch);
      await storage.recordUsage({ checkId, documentId: null, kind: "compare", ...usage });
      for (const request of batch) {
        const verdict = verdicts.get(request.key);
        if (!verdict) continue;
        await storage.setCached(checkId, compareCacheKey(request), verdict);
        compared++;
      }
    } catch (caught) {
      const error = toAiError(caught);
      logAiError("comparison", error);
      if (error.usage) {
        await storage.recordUsage({ checkId, documentId: null, kind: "compare", ...error.usage });
      }
      return errorResponse(error.code, error.code === "not_configured" ? 503 : 502, { compared });
    }
  }
  return NextResponse.json({ compared, requested: pending.length });
}
