import { createHash } from "node:crypto";
import { runChecks, type SemanticLookup } from "./engine";
import type { SemanticVerdict } from "./types";

export type SemanticKind = "party" | "goods";
export type SemanticRequest = { key: string; kind: SemanticKind; a: string; b: string };

/** Content-addressed and order-independent, so a cached verdict is never stale. */
export function semanticKey(kind: SemanticKind, a: string, b: string): string {
  const [first, second] = [a, b].sort();
  return createHash("sha256").update(`${kind}\u0000${first}\u0000${second}`).digest("hex");
}

/** The comparisons the rules would ask for, found by running them without verdicts. */
export function collectSemanticRequests(
  input: Omit<Parameters<typeof runChecks>[0], "semantic">,
): SemanticRequest[] {
  const requests = new Map<string, SemanticRequest>();
  runChecks({
    ...input,
    semantic: (kind, a, b) => {
      const key = semanticKey(kind, a, b);
      requests.set(key, { key, kind, a, b });
      return null;
    },
  });
  return [...requests.values()];
}

export function semanticLookup(verdicts: Map<string, SemanticVerdict>): SemanticLookup {
  return (kind, a, b) => verdicts.get(semanticKey(kind, a, b)) ?? null;
}
