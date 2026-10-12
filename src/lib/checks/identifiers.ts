import { EU_VAT_PREFIXES } from "@/lib/validation/reference";
import type { EffectiveDocument } from "./effective";

/** Official services where a number can be confirmed. TradeCheck never queries them itself. */
export const VERIFICATION_LINKS = {
  vies: "https://ec.europa.eu/taxation_customs/vies/",
  eori: "https://taxation-customs.ec.europa.eu/customs/customs-procedures-import-and-export/customs-operations/economic-operators-registration-and-identification-number-eori_en",
} as const;

export type PartyIdentifier = {
  party: "seller" | "buyer";
  kind: "vatId" | "eori";
  value: string;
  /** File names of the documents that print this number. */
  documents: string[];
  /** Where it can be verified; null for VAT numbers without an EU prefix. */
  verifyAt: keyof typeof VERIFICATION_LINKS | null;
};

const FIELDS = [
  ["seller", "vatId", "sellerVatId"],
  ["seller", "eori", "sellerEori"],
  ["buyer", "vatId", "buyerVatId"],
  ["buyer", "eori", "buyerEori"],
] as const;

/** Every distinct party VAT and EORI number in the read documents, with where it appears. */
export function collectPartyIdentifiers(documents: EffectiveDocument[]): PartyIdentifier[] {
  const found = new Map<string, PartyIdentifier>();
  for (const [party, kind, key] of FIELDS) {
    for (const doc of documents) {
      const value = doc.header[key].normalized;
      if (!value) continue;
      const id = `${party}:${kind}:${value}`;
      const entry = found.get(id) ?? {
        party,
        kind,
        value,
        documents: [],
        verifyAt: kind === "eori" ? "eori" : EU_VAT_PREFIXES.has(value.slice(0, 2)) ? "vies" : null,
      };
      if (!entry.documents.includes(doc.record.fileName)) entry.documents.push(doc.record.fileName);
      found.set(id, entry);
    }
  }
  return [...found.values()];
}
