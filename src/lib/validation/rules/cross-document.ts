import Decimal from "decimal.js";
import type { EffectiveDocument, EffectiveField } from "@/lib/checks/effective";
import type { HeaderFieldKey } from "@/lib/domain/fields";
import {
  dec,
  documentPairs,
  evidence,
  finding,
  looseText,
  param,
  present,
  referenceKey,
  weightInKg,
} from "../helpers";
import type { Finding, FindingParam, Rule, RuleContext } from "../types";

type Value<T> = { value: T; fields: EffectiveField[]; display: FindingParam };

/** Compares one value across every pair of compared document types. */
function compareAcrossDocuments<T>(
  context: RuleContext,
  options: {
    ruleId: string;
    severity: "error" | "warning";
    read: (doc: EffectiveDocument) => Value<T> | null;
    equal: (a: T, b: T) => boolean;
    messageKey?: string;
  },
) {
  const findings: Finding[] = [];
  let evaluated = 0;
  for (const [a, b] of documentPairs(context.first)) {
    const valueA = options.read(a);
    const valueB = options.read(b);
    if (!valueA || !valueB) continue;
    evaluated++;
    if (options.equal(valueA.value, valueB.value)) continue;
    findings.push(
      finding({
        ruleId: options.ruleId,
        category: "crossDocument",
        subject: `${a.record.id}:${b.record.id}`,
        severity: options.severity,
        messageKey: options.messageKey,
        documents: [a, b],
        params: {
          docA: param.document(a),
          docB: param.document(b),
          valueA: valueA.display,
          valueB: valueB.display,
        },
        evidence: [
          ...valueA.fields.map((field) => evidence(a, field)),
          ...valueB.fields.map((field) => evidence(b, field)),
        ],
      }),
    );
  }
  return { evaluated, findings };
}

function headerCode(key: HeaderFieldKey, kind: "code" | "currency" | "country") {
  return (doc: EffectiveDocument): Value<string> | null => {
    const field = doc.header[key];
    if (!present(field)) return null;
    return { value: field.normalized, fields: [field], display: { kind, value: field.normalized } };
  };
}

/** Printed total quantity, or the sum of line quantities when every line has one. */
function totalQuantity(doc: EffectiveDocument): Value<Decimal> | null {
  const printed = dec(doc.header.totalQuantity);
  if (printed) {
    return { value: printed, fields: [doc.header.totalQuantity], display: param.quantity(printed) };
  }
  if (doc.lines.length === 0 || doc.lines.some((line) => !dec(line.quantity))) return null;
  const sum = doc.lines.reduce((acc, line) => acc.plus(dec(line.quantity)!), new Decimal(0));
  return {
    value: sum,
    fields: doc.lines.map((line) => line.quantity),
    display: param.quantity(sum),
  };
}

function weight(
  valueKey: "grossWeight" | "netWeight",
  unitKey: "grossWeightUnit" | "netWeightUnit",
) {
  return (doc: EffectiveDocument): Value<{ kg: Decimal; unit: string }> | null => {
    const field = doc.header[valueKey];
    if (!present(field)) return null;
    const converted = weightInKg(field, doc.header[unitKey]);
    if (!converted) return null;
    return {
      value: converted,
      fields: [field, doc.header[unitKey]].filter(present),
      display: param.weight(dec(field)!, converted.unit),
    };
  };
}

/** Same unit: exact. Different units: within 0.1 % after conversion (rounding on paper). */
function sameWeight(a: { kg: Decimal; unit: string }, b: { kg: Decimal; unit: string }) {
  if (a.unit === b.unit) return a.kg.eq(b.kg);
  if (a.unit === "" || b.unit === "") return false;
  return a.kg.minus(b.kg).abs().lte(Decimal.max(a.kg, b.kg).times("0.001"));
}

export const quantityRule: Rule = {
  id: "xdoc-quantity",
  category: "crossDocument",
  run: (context) =>
    compareAcrossDocuments(context, {
      ruleId: "xdoc-quantity",
      severity: "warning",
      read: totalQuantity,
      equal: (a, b) => a.eq(b),
    }),
};

export const packagesRule: Rule = {
  id: "xdoc-packages",
  category: "crossDocument",
  run: (context) =>
    compareAcrossDocuments(context, {
      ruleId: "xdoc-packages",
      severity: "error",
      read: (doc) => {
        const count = dec(doc.header.packageCount);
        return count
          ? { value: count, fields: [doc.header.packageCount], display: param.quantity(count) }
          : null;
      },
      equal: (a, b) => a.eq(b),
    }),
};

export const grossWeightRule: Rule = {
  id: "xdoc-gross-weight",
  category: "crossDocument",
  run: (context) =>
    compareAcrossDocuments(context, {
      ruleId: "xdoc-gross-weight",
      severity: "error",
      read: weight("grossWeight", "grossWeightUnit"),
      equal: sameWeight,
    }),
};

export const netWeightRule: Rule = {
  id: "xdoc-net-weight",
  category: "crossDocument",
  run: (context) =>
    compareAcrossDocuments(context, {
      ruleId: "xdoc-net-weight",
      severity: "error",
      read: weight("netWeight", "netWeightUnit"),
      equal: sameWeight,
    }),
};

export const currencyRule: Rule = {
  id: "xdoc-currency",
  category: "crossDocument",
  run: (context) =>
    compareAcrossDocuments(context, {
      ruleId: "xdoc-currency",
      severity: "error",
      read: headerCode("currency", "currency"),
      equal: (a, b) => a === b,
    }),
};

export const incotermRule: Rule = {
  id: "xdoc-incoterm",
  category: "crossDocument",
  run: (context) => {
    const codes = compareAcrossDocuments(context, {
      ruleId: "xdoc-incoterm",
      severity: "error",
      read: headerCode("incoterm", "code"),
      equal: (a, b) => a === b,
    });
    const places = compareAcrossDocuments(context, {
      ruleId: "xdoc-incoterm",
      messageKey: "xdoc-incoterm-place",
      severity: "warning",
      read: (doc) => {
        const field = doc.header.incotermPlace;
        return present(field)
          ? {
              value: looseText(field.normalized),
              fields: [field],
              display: param.text(field.normalized),
            }
          : null;
      },
      equal: (a, b) => a === b,
    });
    // Place findings need distinct ids from code findings.
    places.findings.forEach(
      (item) => (item.id = item.id.replace("xdoc-incoterm:", "xdoc-incoterm-place:")),
    );
    return {
      evaluated: codes.evaluated + places.evaluated,
      findings: [...codes.findings, ...places.findings],
    };
  },
};

export const originRule: Rule = {
  id: "xdoc-origin",
  category: "crossDocument",
  run: (context) =>
    compareAcrossDocuments(context, {
      ruleId: "xdoc-origin",
      severity: "error",
      read: headerCode("countryOfOrigin", "country"),
      equal: (a, b) => a === b,
    }),
};

export const destinationRule: Rule = {
  id: "xdoc-destination",
  category: "crossDocument",
  run: (context) =>
    compareAcrossDocuments(context, {
      ruleId: "xdoc-destination",
      severity: "warning",
      read: headerCode("countryOfDestination", "country"),
      equal: (a, b) => a === b,
    }),
};

/** Invoice and packing list must refer to the purchase order's number. */
export const orderReferenceRule: Rule = {
  id: "xdoc-order-ref",
  category: "crossDocument",
  run: ({ first }) => {
    const findings: Finding[] = [];
    let evaluated = 0;
    const order = first("purchase_order");
    const referencing = [first("commercial_invoice"), first("packing_list")].filter(
      (doc): doc is EffectiveDocument => doc !== undefined,
    );
    if (order && present(order.header.documentNumber)) {
      const orderNumber = order.header.documentNumber;
      for (const doc of referencing) {
        evaluated++;
        const reference = doc.header.orderReference;
        if (!present(reference)) {
          findings.push(
            finding({
              ruleId: "xdoc-order-ref",
              category: "crossDocument",
              subject: doc.record.id,
              severity: "info",
              unverified: true,
              messageKey: "xdoc-order-ref-missing",
              documents: [doc, order],
              params: { document: param.document(doc) },
              evidence: [evidence(order, orderNumber)],
            }),
          );
          continue;
        }
        if (referenceKey(reference.normalized) === referenceKey(orderNumber.normalized)) continue;
        findings.push(
          finding({
            ruleId: "xdoc-order-ref",
            category: "crossDocument",
            subject: `${doc.record.id}:${order.record.id}`,
            severity: "error",
            documents: [doc, order],
            params: {
              docA: param.document(doc),
              valueA: param.code(reference.normalized),
              docB: param.document(order),
              valueB: param.code(orderNumber.normalized),
            },
            evidence: [evidence(doc, reference), evidence(order, orderNumber)],
          }),
        );
      }
    } else if (referencing.length === 2) {
      const [a, b] = referencing as [EffectiveDocument, EffectiveDocument];
      if (present(a.header.orderReference) && present(b.header.orderReference)) {
        evaluated++;
        if (
          referenceKey(a.header.orderReference.normalized) !==
          referenceKey(b.header.orderReference.normalized)
        ) {
          findings.push(
            finding({
              ruleId: "xdoc-order-ref",
              category: "crossDocument",
              subject: `${a.record.id}:${b.record.id}`,
              severity: "warning",
              messageKey: "xdoc-order-ref-pair",
              documents: [a, b],
              params: {
                docA: param.document(a),
                valueA: param.code(a.header.orderReference.normalized),
                docB: param.document(b),
                valueB: param.code(b.header.orderReference.normalized),
              },
              evidence: [
                evidence(a, a.header.orderReference),
                evidence(b, b.header.orderReference),
              ],
            }),
          );
        }
      }
    }
    return { evaluated, findings };
  },
};

/** Exporter = shipper, or the seller when no shipper is named; importer likewise. */
export function partyField(
  doc: EffectiveDocument,
  role: "exporter" | "importer",
): EffectiveField | null {
  const [primary, fallback] =
    role === "exporter"
      ? [doc.header.shipperName, doc.header.sellerName]
      : [doc.header.consigneeName, doc.header.buyerName];
  if (present(primary)) return primary;
  return present(fallback) ? fallback : null;
}

function partyRule(role: "exporter" | "importer"): Rule {
  const ruleId = `xdoc-${role}`;
  return {
    id: ruleId,
    category: "crossDocument",
    run: ({ first, semantic }) => {
      const findings: Finding[] = [];
      let evaluated = 0;
      for (const [a, b] of documentPairs(first)) {
        const nameA = partyField(a, role);
        const nameB = partyField(b, role);
        if (!nameA || !nameB) continue;
        evaluated++;
        if (looseText(nameA.normalized!) === looseText(nameB.normalized!)) continue;
        const verdict = semantic("party", nameA.normalized!, nameB.normalized!);
        const outcome = verdict === null ? "unknown" : verdict.same ? "same" : "different";
        findings.push(
          finding({
            ruleId,
            category: "crossDocument",
            subject: `${a.record.id}:${b.record.id}`,
            severity: outcome === "different" ? "warning" : outcome === "same" ? "info" : "warning",
            unverified: outcome === "unknown",
            aiAssisted: outcome !== "unknown",
            messageKey: `${ruleId}-${outcome}`,
            documents: [a, b],
            params: {
              docA: param.document(a),
              valueA: param.text(nameA.normalized!),
              docB: param.document(b),
              valueB: param.text(nameB.normalized!),
            },
            evidence: [evidence(a, nameA), evidence(b, nameB)],
          }),
        );
      }
      return { evaluated, findings };
    },
  };
}

export const exporterRule = partyRule("exporter");
export const importerRule = partyRule("importer");

/** Goods descriptions: line by line when the line counts match, otherwise the counts differ. */
export const goodsRule: Rule = {
  id: "xdoc-goods",
  category: "crossDocument",
  run: ({ first, semantic }) => {
    const findings: Finding[] = [];
    let evaluated = 0;
    for (const [a, b] of documentPairs(first)) {
      if (a.lines.length === 0 || b.lines.length === 0) continue;
      evaluated++;
      if (a.lines.length !== b.lines.length) {
        findings.push(
          finding({
            ruleId: "xdoc-goods",
            category: "crossDocument",
            subject: `${a.record.id}:${b.record.id}:count`,
            severity: "warning",
            messageKey: "xdoc-line-count",
            documents: [a, b],
            params: {
              docA: param.document(a),
              countA: param.number(a.lines.length),
              docB: param.document(b),
              countB: param.number(b.lines.length),
            },
          }),
        );
        continue;
      }
      a.lines.forEach((lineA, index) => {
        const lineB = b.lines[index]!;
        if (!present(lineA.description) || !present(lineB.description)) return;
        if (looseText(lineA.description.normalized) === looseText(lineB.description.normalized))
          return;
        const verdict = semantic(
          "goods",
          lineA.description.normalized,
          lineB.description.normalized,
        );
        if (verdict?.same) return;
        findings.push(
          finding({
            ruleId: "xdoc-goods",
            category: "crossDocument",
            subject: `${a.record.id}:${b.record.id}:lines.${index}`,
            severity: "warning",
            unverified: verdict === null,
            aiAssisted: verdict !== null,
            messageKey: verdict === null ? "xdoc-goods-unknown" : "xdoc-goods-different",
            documents: [a, b],
            params: {
              line: param.number(index + 1),
              docA: param.document(a),
              valueA: param.text(lineA.description.normalized),
              docB: param.document(b),
              valueB: param.text(lineB.description.normalized),
            },
            evidence: [evidence(a, lineA.description), evidence(b, lineB.description)],
          }),
        );
      });
    }
    return { evaluated, findings };
  },
};

/**
 * HS codes, line by line: only the internationally harmonized first six digits are
 * compared, since national extensions may legitimately differ between documents.
 */
export const hsCodeRule: Rule = {
  id: "xdoc-hs",
  category: "crossDocument",
  run: ({ first }) => {
    const findings: Finding[] = [];
    let evaluated = 0;
    for (const [a, b] of documentPairs(first)) {
      if (a.lines.length === 0 || a.lines.length !== b.lines.length) continue;
      a.lines.forEach((lineA, index) => {
        const lineB = b.lines[index]!;
        const codeA = lineA.hsCode.normalized;
        const codeB = lineB.hsCode.normalized;
        if (!codeA || !codeB || !/^\d{6,12}$/.test(codeA) || !/^\d{6,12}$/.test(codeB)) return;
        evaluated++;
        if (codeA.slice(0, 6) === codeB.slice(0, 6)) return;
        findings.push(
          finding({
            ruleId: "xdoc-hs",
            category: "crossDocument",
            subject: `${a.record.id}:${b.record.id}:lines.${index}`,
            severity: "warning",
            documents: [a, b],
            params: {
              line: param.number(index + 1),
              docA: param.document(a),
              valueA: param.code(codeA),
              docB: param.document(b),
              valueB: param.code(codeB),
            },
            evidence: [evidence(a, lineA.hsCode), evidence(b, lineB.hsCode)],
          }),
        );
      });
    }
    return { evaluated, findings };
  },
};
