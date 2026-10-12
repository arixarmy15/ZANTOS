import type { EffectiveDocument } from "@/lib/checks/effective";
import type { DocumentType, HeaderFieldKey, LineFieldKey } from "@/lib/domain/fields";
import { COMPARED_TYPES, evidence, finding, param, present } from "../helpers";
import type { Finding, Rule } from "../types";

type ComparedType = (typeof COMPARED_TYPES)[number];

/**
 * What each document type should show for the checks to work. These are general trade
 * practice, not any country's legal requirements: country-specific requirements belong in
 * rule packs with their sources. "Required" fields are reported as warnings, "recommended"
 * ones as information. A list of keys means any one of them is enough.
 */
const EXPECTED: Record<
  ComparedType,
  {
    required: HeaderFieldKey[][];
    recommended: HeaderFieldKey[][];
    lineRequired: LineFieldKey[];
    lineRecommended: LineFieldKey[];
  }
> = {
  commercial_invoice: {
    required: [
      ["documentNumber"],
      ["documentDate"],
      ["sellerName"],
      ["buyerName"],
      ["currency"],
      ["totalAmount"],
    ],
    recommended: [["sellerAddress"], ["buyerAddress"], ["incoterm"]],
    lineRequired: ["description", "quantity"],
    lineRecommended: ["unitPrice"],
  },
  packing_list: {
    required: [
      ["shipperName", "sellerName"],
      ["consigneeName", "buyerName"],
      ["packageCount"],
      ["grossWeight"],
    ],
    recommended: [["documentNumber"], ["documentDate"], ["netWeight"]],
    lineRequired: ["description", "quantity"],
    lineRecommended: [],
  },
  purchase_order: {
    required: [["documentNumber"], ["documentDate"], ["buyerName"], ["sellerName"]],
    recommended: [["currency"], ["totalAmount"]],
    lineRequired: ["description", "quantity"],
    lineRecommended: ["unitPrice"],
  },
};

function isCompared(type: DocumentType | null): type is ComparedType {
  return (COMPARED_TYPES as readonly string[]).includes(type ?? "");
}

/** Origin may be printed once in the header or on every line. */
function hasOrigin(doc: EffectiveDocument): boolean {
  if (present(doc.header.countryOfOrigin)) return true;
  return doc.lines.length > 0 && doc.lines.every((line) => present(line.countryOfOrigin));
}

export const requiredFieldsRule: Rule = {
  id: "req-fields",
  category: "completeness",
  run: ({ documents }) => {
    const findings: Finding[] = [];
    let evaluated = 0;
    for (const doc of documents) {
      const type = doc.record.documentType;
      if (!isCompared(type)) continue;
      evaluated++;
      const expected = EXPECTED[type];
      const base = {
        ruleId: "req-fields",
        category: "completeness" as const,
        documents: [doc],
      };
      const headerGroups: [HeaderFieldKey[], "warning" | "info"][] = [
        ...expected.required.map((keys) => [keys, "warning"] as [HeaderFieldKey[], "warning"]),
        ...expected.recommended.map((keys) => [keys, "info"] as [HeaderFieldKey[], "info"]),
      ];
      for (const [keys, severity] of headerGroups) {
        if (keys.some((key) => present(doc.header[key]))) continue;
        findings.push(
          finding({
            ...base,
            subject: `${doc.record.id}:${keys.join("|")}`,
            severity,
            messageKey:
              keys.length > 1
                ? "req-field-either"
                : severity === "warning"
                  ? "req-field"
                  : "rec-field",
            params:
              keys.length > 1
                ? {
                    document: param.document(doc),
                    fieldA: param.field(keys[0]!),
                    fieldB: param.field(keys[1]!),
                  }
                : { document: param.document(doc), field: param.field(keys[0]!) },
          }),
        );
      }

      if (type === "commercial_invoice" && !hasOrigin(doc)) {
        findings.push(
          finding({
            ...base,
            subject: `${doc.record.id}:countryOfOrigin`,
            severity: "info",
            messageKey: "rec-field",
            params: { document: param.document(doc), field: param.field("countryOfOrigin") },
          }),
        );
      }

      // A weight without its unit cannot be compared with another document's weight.
      for (const [value, unit] of [
        ["grossWeight", "grossWeightUnit"],
        ["netWeight", "netWeightUnit"],
      ] as const) {
        if (!present(doc.header[value]) || present(doc.header[unit])) continue;
        findings.push(
          finding({
            ...base,
            subject: `${doc.record.id}:${unit}`,
            severity: "info",
            messageKey: "req-weight-unit",
            params: { document: param.document(doc), field: param.field(value) },
            evidence: [evidence(doc, doc.header[value])],
          }),
        );
      }

      if (doc.lines.length === 0) {
        findings.push(
          finding({
            ...base,
            subject: `${doc.record.id}:lines`,
            severity: "warning",
            messageKey: "req-lines",
            params: { document: param.document(doc) },
          }),
        );
        continue;
      }
      const lineGroups: [LineFieldKey, "warning" | "info"][] = [
        ...expected.lineRequired.map((key) => [key, "warning"] as [LineFieldKey, "warning"]),
        ...expected.lineRecommended.map((key) => [key, "info"] as [LineFieldKey, "info"]),
      ];
      for (const [key, severity] of lineGroups) {
        const missing = doc.lines
          .map((line, index) => ({ line, index }))
          .filter(({ line }) => !present(line[key]));
        if (missing.length === 0) continue;
        findings.push(
          finding({
            ...base,
            subject: `${doc.record.id}:lines.${key}`,
            severity,
            messageKey: "req-line-field",
            params: {
              document: param.document(doc),
              field: param.field(key),
              count: param.number(missing.length),
              total: param.number(doc.lines.length),
            },
          }),
        );
      }
    }
    return { evaluated, findings };
  },
};

/**
 * The document set: what is missing, what was not compared and why, and a general
 * reminder that the destination country decides what else is needed. Tickline does not
 * list country-specific documents (no rule pack, no claim).
 */
export const documentSetRule: Rule = {
  id: "docset",
  category: "completeness",
  run: ({ documents, unread, first }) => {
    const findings: Finding[] = [];
    if (documents.length === 0 && unread.length === 0) return { evaluated: 0, findings };
    const base = { ruleId: "docset", category: "completeness" as const };

    for (const record of unread) {
      findings.push(
        finding({
          ...base,
          subject: `${record.id}:unread`,
          severity: "warning",
          messageKey: "doc-not-read",
          documents: [record.id],
          params: { document: param.document(record.id) },
        }),
      );
    }

    if (documents.length === 0) return { evaluated: 1, findings };

    for (const type of COMPARED_TYPES) {
      const docs = documents.filter((doc) => doc.record.documentType === type);
      if (docs.length === 0) {
        findings.push(
          finding({
            ...base,
            subject: `missing:${type}`,
            severity: type === "purchase_order" ? "info" : "warning",
            messageKey: type === "purchase_order" ? "docset-optional" : "docset-missing",
            documents: [],
            params: { documentType: param.documentType(type) },
          }),
        );
      } else if (docs.length > 1) {
        findings.push(
          finding({
            ...base,
            subject: `duplicate:${type}`,
            severity: "info",
            messageKey: "docset-duplicate",
            documents: docs,
            params: { documentType: param.documentType(type), document: param.document(docs[0]!) },
          }),
        );
      }
    }

    for (const doc of documents) {
      if (isCompared(doc.record.documentType)) continue;
      findings.push(
        finding({
          ...base,
          subject: `${doc.record.id}:other`,
          severity: "info",
          messageKey: "docset-other-type",
          documents: [doc],
          params: { document: param.document(doc) },
        }),
      );
    }

    // Incoterms® 2020 CIF and CIP oblige the seller to obtain cargo insurance (A5).
    const terms = COMPARED_TYPES.map((type) => first(type)?.header.incoterm.normalized).filter(
      Boolean,
    );
    const insured = terms.find((term) => term === "CIF" || term === "CIP");
    if (insured) {
      findings.push(
        finding({
          ...base,
          subject: "insurance",
          severity: "info",
          messageKey: "docset-insurance",
          documents: [],
          params: { value: param.code(insured) },
        }),
      );
    }

    const destinations = [
      ...new Set(
        documents
          .map((doc) => doc.header.countryOfDestination.normalized)
          .filter((code): code is string => code !== null && /^[A-Z]{2}$/.test(code)),
      ),
    ];
    findings.push(
      finding({
        ...base,
        subject: "typical",
        severity: "info",
        messageKey: destinations.length === 1 ? "docset-typical-country" : "docset-typical",
        documents: [],
        params: destinations.length === 1 ? { country: param.country(destinations[0]!) } : {},
      }),
    );

    return { evaluated: 1, findings };
  },
};
