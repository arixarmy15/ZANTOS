import { NextResponse } from "next/server";
import { z } from "zod";
import { errorResponse, findCheck, readJson } from "@/lib/api/http";
import { structuredRequest } from "@/lib/assist/request";
import {
  contentHash,
  EMAIL_SYSTEM_PROMPT,
  emailIssues,
  emailRequest,
  emailSchema,
  findingFacts,
  LANGUAGE_TAG,
} from "@/lib/assist/prompts";
import { cachedAssist } from "@/lib/assist/route-helpers";
import { presentCheck } from "@/lib/checks/view";
import { getServerEnv, isAnthropicConfigured } from "@/lib/config/env";
import { getStorage } from "@/lib/storage";

type Context = { params: Promise<{ checkId: string }> };

const bodySchema = z.object({ language: z.string().regex(LANGUAGE_TAG) });

/**
 * Drafts a correction request. The draft is only returned for the user to copy or open in
 * their own mail program; TradeCheck never sends e-mail.
 */
export async function POST(request: Request, { params }: Context) {
  const { checkId } = await params;
  const found = await findCheck(checkId);
  if ("response" in found) return found.response;
  const body = bodySchema.safeParse(await readJson(request));
  if (!body.success) return errorResponse("invalid_request", 400);
  if (!isAnthropicConfigured(getServerEnv())) return errorResponse("not_configured", 503);

  const storage = await getStorage();
  const { findings } = await presentCheck(storage, found.check, "en");
  const issues = emailIssues(findings);
  if (issues.length === 0) return errorResponse("no_issues", 409);

  const result = await cachedAssist({
    storage,
    checkId,
    kind: "email",
    cacheKey: `email:${contentHash(body.data.language, issues.map(findingFacts))}`,
    run: () =>
      structuredRequest({
        system: EMAIL_SYSTEM_PROMPT,
        user: emailRequest(issues, body.data.language),
        schema: emailSchema,
        maxTokens: 4000,
      }),
  });
  if (!result.ok) return result.response;
  return NextResponse.json({ ...result.output, cached: result.cached });
}
