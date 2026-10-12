import type { RuleCategory, Severity } from "./types";

/** Display order, kept apart from the engine so client components stay light. */
export const SEVERITY_ORDER: Severity[] = ["error", "warning", "info"];
export const CATEGORY_ORDER: RuleCategory[] = [
  "arithmetic",
  "crossDocument",
  "format",
  "completeness",
];
