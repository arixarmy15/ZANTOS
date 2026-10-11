import type { EffectiveDocument, EffectiveField } from "@/lib/checks/effective";
import { isValidNormalized } from "@/lib/checks/effective";
import { evidence, finding, param, present } from "../helpers";
import {
  CURRENCY_LIST_DATE,
  INCOTERMS_2020,
  isIsoCountry,
  isIsoCurrency,
  isUserAssignedCountryCode,
  RETIRED_INCOTERMS,
} from "../reference";
import type { Evidence, Finding, Rule } from "../types";

/** Every field of a document with its path, header first, then lines in order. */
function allFields(doc: EffectiveDocument): EffectiveField[] {
  return [...Object.values(doc.header), ...doc.lines.flatMap((line) => Object.values(line))];
}

/** Values that pass the shape check for their kind; the others are reported once, below. */
function wellFormed(field: EffectiveField): field is EffectiveField & { normalized: string } {
  return present(field) && isValidNormalized(field.kind, field.normalized);
}

/**
 * A value the checks cannot read (a date that is not a date, an amount with letters).
 * Usually an extraction slip; the user can correct it and the checks re-run.
 */
export const valueFormatRule: Rule = {
  id: "fmt-value",
  category: "format",
  run: ({ documents }) => {
    const findings: Finding[] = [];
    let evaluated = 0;
    for (const doc of documents) {
      for (const field of allFields(doc)) {
        if (!present(field)) continue;
        evaluated++;
        if (isValidNormalized(field.kind, field.normalized)) continue;
        findings.push(
          finding({
            ruleId: "fmt-value",
            category: "format",
            subject: `${doc.record.id}:${field.path}`,
            severity: "warning",
            documents: [doc],
            params: {
              document: param.document(doc),
              field: param.field(field.path),
              value: param.text(field.value ?? field.normalized),
            },
            evidence: [evidence(doc, field)],
          }),
        );
      }
    }
    return { evaluated, findings };
  },
};

/** ISO 4217, against the bundled list; an unknown code may be newer than the list. */
export const currencyFormatRule: Rule = {
  id: "fmt-currency",
  category: "format",
  run: ({ documents }) => {
    const findings: Finding[] = [];
    let evaluated = 0;
    for (const doc of documents) {
      const field = doc.header.currency;
      if (!wellFormed(field)) continue;
      evaluated++;
      if (isIsoCurrency(field.normalized)) continue;
      findings.push(
        finding({
          ruleId: "fmt-currency",
          category: "format",
          subject: doc.record.id,
          severity: "warning",
          documents: [doc],
          params: {
            document: param.document(doc),
            value: param.code(field.normalized),
            listDate: param.date(CURRENCY_LIST_DATE),
          },
          evidence: [evidence(doc, field)],
        }),
      );
    }
    return { evaluated, findings };
  },
};

/** ISO 3166-1 alpha-2 for every country field, header and lines. */
export const countryFormatRule: Rule = {
  id: "fmt-country",
  category: "format",
  run: ({ documents }) => {
    const findings: Finding[] = [];
    let evaluated = 0;
    for (const doc of documents) {
      for (const field of allFields(doc)) {
        if (field.kind !== "country" || !wellFormed(field)) continue;
        evaluated++;
        if (isIsoCountry(field.normalized)) continue;
        const userAssigned = isUserAssignedCountryCode(field.normalized);
        findings.push(
          finding({
            ruleId: "fmt-country",
            category: "format",
            subject: `${doc.record.id}:${field.path}`,
            severity: "warning",
            messageKey: userAssigned ? "fmt-country-user-assigned" : "fmt-country",
            documents: [doc],
            params: {
              document: param.document(doc),
              field: param.field(field.path),
              value: param.code(field.normalized),
            },
            evidence: [evidence(doc, field)],
          }),
        );
      }
    }
    return { evaluated, findings };
  },
};

/** Incoterms® 2020: one of the 11 rules, followed by a named place. */
export const incotermFormatRule: Rule = {
  id: "fmt-incoterm",
  category: "format",
  run: ({ documents }) => {
    const findings: Finding[] = [];
    let evaluated = 0;
    for (const doc of documents) {
      const field = doc.header.incoterm;
      if (!wellFormed(field)) continue;
      evaluated++;
      const code = field.normalized;
      const base = {
        ruleId: "fmt-incoterm",
        category: "format" as const,
        documents: [doc],
        evidence: [evidence(doc, field)],
      };
      if (INCOTERMS_2020.has(code)) {
        if (!present(doc.header.incotermPlace)) {
          findings.push(
            finding({
              ...base,
              subject: `${doc.record.id}:place`,
              severity: "info",
              messageKey: "fmt-incoterm-no-place",
              params: { document: param.document(doc), value: param.code(code) },
            }),
          );
        }
        continue;
      }
      const edition = RETIRED_INCOTERMS[code];
      findings.push(
        finding({
          ...base,
          subject: doc.record.id,
          severity: "warning",
          messageKey: edition ? "fmt-incoterm-retired" : "fmt-incoterm",
          params: {
            document: param.document(doc),
            value: param.code(code),
            ...(edition ? { edition: param.code(edition) } : {}),
          },
        }),
      );
    }
    return { evaluated, findings };
  },
};

/**
 * HS codes: format only. The first six digits are the internationally harmonized part;
 * longer codes are national extensions (8 to 12 digits). TradeCheck never suggests or
 * confirms a classification, so every document with HS codes gets an expert-review note.
 */
export const hsFormatRule: Rule = {
  id: "fmt-hs",
  category: "format",
  run: ({ documents }) => {
    const findings: Finding[] = [];
    let evaluated = 0;
    const withCodes: EffectiveDocument[] = [];
    const codeEvidence: Evidence[] = [];
    for (const doc of documents) {
      let hasCodes = false;
      doc.lines.forEach((line, index) => {
        const field = line.hsCode;
        if (!wellFormed(field)) return;
        evaluated++;
        hasCodes = true;
        codeEvidence.push(evidence(doc, field));
        if (field.normalized.length >= 6) return;
        findings.push(
          finding({
            ruleId: "fmt-hs",
            category: "format",
            subject: `${doc.record.id}:lines.${index}`,
            severity: "warning",
            messageKey: "fmt-hs-short",
            documents: [doc],
            params: {
              document: param.document(doc),
              line: param.number(index + 1),
              value: param.code(field.normalized),
            },
            evidence: [evidence(doc, field)],
          }),
        );
      });
      if (hasCodes) withCodes.push(doc);
    }
    if (withCodes.length > 0) {
      findings.push(
        finding({
          ruleId: "fmt-hs",
          category: "format",
          subject: "classification",
          severity: "info",
          messageKey: "fmt-hs-expert",
          documents: withCodes,
          evidence: codeEvidence,
        }),
      );
    }
    return { evaluated, findings };
  },
};

/** IBAN structure and ISO 7064 MOD 97-10 check digits (ISO 13616). */
export function isValidIban(raw: string): boolean {
  const iban = raw.replace(/\s+/g, "").toUpperCase();
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(iban)) return false;
  const rearranged = iban.slice(4) + iban.slice(0, 4);
  let remainder = 0;
  for (const character of rearranged) {
    const digits = /\d/.test(character) ? character : String(character.charCodeAt(0) - 55);
    for (const digit of digits) remainder = (remainder * 10 + Number(digit)) % 97;
  }
  return remainder === 1;
}

export const ibanFormatRule: Rule = {
  id: "fmt-iban",
  category: "format",
  run: ({ documents }) => {
    const findings: Finding[] = [];
    let evaluated = 0;
    for (const doc of documents) {
      const field = doc.header.iban;
      if (!wellFormed(field)) continue;
      evaluated++;
      if (isValidIban(field.normalized)) continue;
      findings.push(
        finding({
          ruleId: "fmt-iban",
          category: "format",
          subject: doc.record.id,
          severity: "error",
          documents: [doc],
          params: { document: param.document(doc), value: param.code(field.normalized) },
          evidence: [evidence(doc, field)],
        }),
      );
    }
    return { evaluated, findings };
  },
};

/** The purchase order comes first: invoice and packing list are not dated before it. */
export const dateOrderRule: Rule = {
  id: "date-order",
  category: "format",
  run: ({ first }) => {
    const findings: Finding[] = [];
    let evaluated = 0;
    const order = first("purchase_order");
    if (!order || !wellFormed(order.header.documentDate)) return { evaluated, findings };
    const orderDate = order.header.documentDate.normalized;
    for (const doc of [first("commercial_invoice"), first("packing_list")]) {
      if (!doc || !wellFormed(doc.header.documentDate)) continue;
      evaluated++;
      const date = doc.header.documentDate.normalized;
      // ISO dates compare correctly as strings.
      if (date >= orderDate) continue;
      findings.push(
        finding({
          ruleId: "date-order",
          category: "format",
          subject: `${doc.record.id}:${order.record.id}`,
          severity: "warning",
          documents: [doc, order],
          params: {
            docA: param.document(order),
            dateA: param.date(orderDate),
            docB: param.document(doc),
            dateB: param.date(date),
          },
          evidence: [
            evidence(doc, doc.header.documentDate),
            evidence(order, order.header.documentDate),
          ],
        }),
      );
    }
    return { evaluated, findings };
  },
};
