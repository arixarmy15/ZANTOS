import currencyCodes from "currency-codes";
import countries from "i18n-iso-countries";

/**
 * Reference lists. Only international standards are used here; country-specific rules
 * live in rule packs under /rules with their own sources.
 */

/**
 * ISO 4217 currency codes from the `currency-codes` package, which bundles SIX's
 * "List One" (the ISO 4217 maintenance agency). Amendments published after
 * CURRENCY_LIST_DATE are not included, so an unknown code is reported as a warning that
 * names the list date, never as a definite error.
 */
export const CURRENCY_LIST_DATE: string = currencyCodes.publishDate;
const CURRENCIES = new Set(currencyCodes.codes());

export function isIsoCurrency(code: string): boolean {
  return CURRENCIES.has(code);
}

/**
 * ISO 3166-1 alpha-2 codes from the `i18n-iso-countries` package. User-assigned code
 * elements (ISO 3166-1 §8.1.3: AA, QM–QZ, XA–XZ, ZZ) are not official country codes even
 * when they are widely used, so they are reported separately.
 */
export function isUserAssignedCountryCode(code: string): boolean {
  return (
    code === "AA" ||
    code === "ZZ" ||
    (code[0] === "Q" && code[1]! >= "M" && code[1]! <= "Z") ||
    code[0] === "X"
  );
}

export function isIsoCountry(code: string): boolean {
  return /^[A-Z]{2}$/.test(code) && !isUserAssignedCountryCode(code) && countries.isValid(code);
}

/** The 11 rules of Incoterms® 2020 (International Chamber of Commerce). */
export const INCOTERMS_2020 = new Set([
  "EXW",
  "FCA",
  "CPT",
  "CIP",
  "DAP",
  "DPU",
  "DDP",
  "FAS",
  "FOB",
  "CFR",
  "CIF",
]);

/** Rules from earlier editions that are not part of Incoterms® 2020. */
export const RETIRED_INCOTERMS: Record<string, string> = {
  DAT: "2010",
  DAF: "2000",
  DES: "2000",
  DEQ: "2000",
  DDU: "2000",
};

/** Kilograms per unit. The pound is the international avoirdupois pound (exact). */
export const KILOGRAMS_PER_UNIT: Record<string, string> = {
  kg: "1",
  g: "0.001",
  t: "1000",
  lb: "0.45359237",
};
