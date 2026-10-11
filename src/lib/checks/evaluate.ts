import "server-only";
import { z } from "zod";
import type { CheckRecord, DocumentRecord, Storage } from "@/lib/storage/types";
import { runChecks, type CheckRun } from "@/lib/validation/engine";
import {
  collectSemanticRequests,
  semanticLookup,
  type SemanticRequest,
} from "@/lib/validation/semantic";
import type { SemanticVerdict } from "@/lib/validation/types";
import { toEffectiveDocuments, type EffectiveDocument } from "./effective";

const verdictSchema = z.object({ same: z.boolean(), confidence: z.number().min(0).max(1) });

export const compareCacheKey = (request: SemanticRequest) => `compare:${request.key}`;

export async function loadVerdicts(
  storage: Storage,
  checkId: string,
  requests: SemanticRequest[],
): Promise<Map<string, SemanticVerdict>> {
  const verdicts = new Map<string, SemanticVerdict>();
  for (const request of requests) {
    const cached = verdictSchema.safeParse(
      await storage.getCached(checkId, compareCacheKey(request)),
    );
    if (cached.success) verdicts.set(request.key, cached.data);
  }
  return verdicts;
}

export type CheckEvaluation = {
  documents: DocumentRecord[];
  effective: EffectiveDocument[];
  run: CheckRun;
  /** Comparisons that need an AI verdict which has not been made yet. */
  pending: SemanticRequest[];
};

/** Loads a check's documents and corrections and runs every rule. */
export async function evaluateCheck(
  storage: Storage,
  check: CheckRecord,
): Promise<CheckEvaluation> {
  const documents = await storage.listDocuments(check.id);
  const corrections = await storage.listCorrections(check.id);
  const effective = toEffectiveDocuments(documents, corrections);
  const input = {
    documents: effective,
    unread: documents.filter((document) => document.extraction === null),
    tolerance: check.tolerance,
  };
  const requests = collectSemanticRequests(input);
  const verdicts = await loadVerdicts(storage, check.id, requests);
  return {
    documents,
    effective,
    run: runChecks({ ...input, semantic: semanticLookup(verdicts) }),
    pending: requests.filter((request) => !verdicts.has(request.key)),
  };
}
