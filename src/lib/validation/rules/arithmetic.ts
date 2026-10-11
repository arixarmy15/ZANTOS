import Decimal from "decimal.js";
import { dec, evidence, finding, param, present, weightInKg } from "../helpers";
import type { Finding, Rule } from "../types";

/** quantity × unit price = line total, within the check's rounding tolerance. */
export const lineTotalRule: Rule = {
  id: "arith-line-total",
  category: "arithmetic",
  run: ({ documents, tolerance }) => {
    const findings: Finding[] = [];
    let evaluated = 0;
    for (const doc of documents) {
      doc.lines.forEach((line, index) => {
        const quantity = dec(line.quantity);
        const price = dec(line.unitPrice);
        const total = dec(line.lineTotal);
        if (!quantity || !price || !total) return;
        evaluated++;
        const expected = quantity.times(price);
        const difference = expected.minus(total).abs();
        if (difference.lte(tolerance)) return;
        findings.push(
          finding({
            ruleId: "arith-line-total",
            category: "arithmetic",
            subject: `${doc.record.id}:lines.${index}`,
            severity: "error",
            documents: [doc],
            params: {
              line: param.number(index + 1),
              document: param.document(doc),
              quantity: param.quantity(quantity),
              unitPrice: param.amount(price),
              expected: param.amount(expected),
              actual: param.amount(total),
              difference: param.amount(difference),
            },
            evidence: [
              evidence(doc, line.quantity),
              evidence(doc, line.unitPrice),
              evidence(doc, line.lineTotal),
            ],
          }),
        );
      });
    }
    return { evaluated, findings };
  },
};

/** Sum of line totals = document total. Other charges are a common, legitimate cause. */
export const sumTotalRule: Rule = {
  id: "arith-sum-total",
  category: "arithmetic",
  run: ({ documents, tolerance }) => {
    const findings: Finding[] = [];
    let evaluated = 0;
    for (const doc of documents) {
      const total = dec(doc.header.totalAmount);
      if (!total || doc.lines.length === 0) continue;
      evaluated++;
      const missing = doc.lines.filter((line) => !dec(line.lineTotal)).length;
      if (missing > 0) {
        findings.push(
          finding({
            ruleId: "arith-sum-total",
            category: "arithmetic",
            subject: doc.record.id,
            severity: "info",
            unverified: true,
            messageKey: "arith-sum-incomplete",
            documents: [doc],
            params: { document: param.document(doc), count: param.number(missing) },
            evidence: [evidence(doc, doc.header.totalAmount)],
          }),
        );
        continue;
      }
      const sum = doc.lines.reduce((acc, line) => acc.plus(dec(line.lineTotal)!), new Decimal(0));
      const difference = sum.minus(total).abs();
      if (difference.lte(tolerance)) continue;
      findings.push(
        finding({
          ruleId: "arith-sum-total",
          category: "arithmetic",
          subject: doc.record.id,
          severity: "warning",
          documents: [doc],
          params: {
            document: param.document(doc),
            sum: param.amount(sum),
            total: param.amount(total),
            difference: param.amount(difference),
          },
          evidence: [
            evidence(doc, doc.header.totalAmount),
            ...doc.lines.map((line) => evidence(doc, line.lineTotal)),
          ],
        }),
      );
    }
    return { evaluated, findings };
  },
};

/** Sum of line quantities = printed total quantity (units may legitimately differ). */
export const quantitySumRule: Rule = {
  id: "arith-qty-sum",
  category: "arithmetic",
  run: ({ documents }) => {
    const findings: Finding[] = [];
    let evaluated = 0;
    for (const doc of documents) {
      const total = dec(doc.header.totalQuantity);
      if (!total || doc.lines.length === 0 || doc.lines.some((line) => !dec(line.quantity)))
        continue;
      evaluated++;
      const sum = doc.lines.reduce((acc, line) => acc.plus(dec(line.quantity)!), new Decimal(0));
      if (sum.eq(total)) continue;
      findings.push(
        finding({
          ruleId: "arith-qty-sum",
          category: "arithmetic",
          subject: doc.record.id,
          severity: "warning",
          documents: [doc],
          params: {
            document: param.document(doc),
            sum: param.quantity(sum),
            total: param.quantity(total),
          },
          evidence: [
            evidence(doc, doc.header.totalQuantity),
            ...doc.lines.map((line) => evidence(doc, line.quantity)),
          ],
        }),
      );
    }
    return { evaluated, findings };
  },
};

/** Net weight cannot exceed gross weight. */
export const netGrossRule: Rule = {
  id: "weight-net-gross",
  category: "arithmetic",
  run: ({ documents }) => {
    const findings: Finding[] = [];
    let evaluated = 0;
    for (const doc of documents) {
      if (!present(doc.header.netWeight) || !present(doc.header.grossWeight)) continue;
      const net = weightInKg(doc.header.netWeight, doc.header.netWeightUnit);
      const gross = weightInKg(doc.header.grossWeight, doc.header.grossWeightUnit);
      // Without units both values are compared as printed only if neither has a unit.
      if (!net || !gross || (net.unit === "") !== (gross.unit === "")) continue;
      evaluated++;
      if (net.kg.lte(gross.kg)) continue;
      findings.push(
        finding({
          ruleId: "weight-net-gross",
          category: "arithmetic",
          subject: doc.record.id,
          severity: "error",
          documents: [doc],
          params: {
            document: param.document(doc),
            net: param.weight(dec(doc.header.netWeight)!, net.unit),
            gross: param.weight(dec(doc.header.grossWeight)!, gross.unit),
          },
          evidence: [evidence(doc, doc.header.netWeight), evidence(doc, doc.header.grossWeight)],
        }),
      );
    }
    return { evaluated, findings };
  },
};
