import { isIsoCountry } from "./reference";
import type { Rule } from "./types";

/** An official publication a rule pack is based on. */
export type RulePackSource = {
  title: string;
  /** The authority that publishes it, e.g. a customs administration. */
  publisher: string;
  url: string;
  /** When the source was last read, as YYYY-MM-DD. */
  retrieved: string;
};

/**
 * Rules for one destination country. A pack applies when a document in the check names
 * that country as its destination. Every pack must cite the official sources its rules
 * implement; Tickline ships none until such sources have been verified.
 */
export type RulePack = {
  /** ISO 3166-1 alpha-2 code of the destination country, e.g. "DE". */
  country: string;
  /** Stable identifier, `<country lower case>-<version>`, e.g. "de-2026.1". */
  id: string;
  version: string;
  sources: RulePackSource[];
  /** Rule ids start with `pack-<country lower case>-`; findings use translation keys under `findings.messages`. */
  rules: Rule[];
};

/** Problems that keep a pack from being registered; empty when the pack is valid. */
export function validateRulePack(pack: RulePack): string[] {
  const problems: string[] = [];
  const prefix = `pack-${pack.country.toLowerCase()}-`;
  if (!isIsoCountry(pack.country))
    problems.push(`country "${pack.country}" is not an ISO 3166-1 alpha-2 code`);
  if (!pack.id.startsWith(`${pack.country.toLowerCase()}-`))
    problems.push(`id must start with "${pack.country.toLowerCase()}-"`);
  if (pack.sources.length === 0) problems.push("at least one official source is required");
  for (const source of pack.sources) {
    if (!/^https:\/\//.test(source.url))
      problems.push(`source "${source.title}" needs an https URL`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(source.retrieved))
      problems.push(`source "${source.title}" needs a retrieved date`);
    if (!source.publisher.trim()) problems.push(`source "${source.title}" needs a publisher`);
  }
  if (pack.rules.length === 0) problems.push("a pack needs at least one rule");
  for (const rule of pack.rules) {
    if (!rule.id.startsWith(prefix)) problems.push(`rule "${rule.id}" must start with "${prefix}"`);
  }
  return problems;
}
