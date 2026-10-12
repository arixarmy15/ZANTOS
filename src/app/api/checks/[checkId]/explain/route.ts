import { NextResponse } from "next/server";
import { z } from "zod";
import { errorResponse, findCheck, readJson } from "@/lib/api/http";
import { structuredRequest } from "@/lib/assist/request";
import {
  contentHash,
  EXPLAIN_SYSTEM_PROMPT,
  explainRequest,
  explanationSchema,
  findingFacts,
  LANGUAGE_TAG,
} from "@/lib/assist/prompts";
import { cachedAssist } from "@/lib/assist/route-helpers";
import { presentCheck } from "@/lib/checks/view";
import { getServerEnv, isTaskConfigured } from "@/lib/config/env";
import { getStorage } from "@/lib/storage";

type Context = { params: Promise<{ checkId: string }> };

const bodySchema = z.object({
  findingId: z.string().min(1).max(400),
  language: z.string().regex(LANGUAGE_TAG),
});

/** Plain-language explanation of one finding, labelled as AI-generated in the interface. */
export async function POST(request: Request, { params }: Context) {
  const { checkId } = await params;
  const found = await findCheck(checkId);
  if ("response" in found) return found.response;
  const body = bodySchema.safeParse(await readJson(request));
  if (!body.success) return errorResponse("invalid_request", 400);
  if (!isTaskConfigured(getServerEnv(), "explain")) return errorResponse("not_configured", 503);

  const storage = await getStorage();
  // The model sees the finding as the checks state it, in English, whatever the answer language.
  const { findings } = await presentCheck(storage, found.check, "en");
  const finding = findings.find((item) => item.id === body.data.findingId);
  if (!finding) return errorResponse("not_found", 404);

  const result = await cachedAssist({
    storage,
    checkId,
    kind: "explain",
    cacheKey: `explain:${contentHash(body.data.language, findingFacts(finding))}`,
    run: () =>
      structuredRequest({
        task: "explain",
        system: EXPLAIN_SYSTEM_PROMPT,
        user: explainRequest(finding, body.data.language),
        schema: explanationSchema,
        maxTokens: 1500,
      }),
  });
  if (!result.ok) return result.response;
  return NextResponse.json({ explanation: result.output.explanation, cached: result.cached });
}
