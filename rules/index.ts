import type { RulePack } from "@/lib/validation/rule-pack";

/**
 * Country rule packs, one folder per destination country: /rules/<ISO 3166-1 alpha-2>/.
 * Empty on purpose: a pack is added only together with the official sources it
 * implements. See rules/README.md.
 */
export const RULE_PACKS: RulePack[] = [];
