import { describe, expect, it } from "vitest";
import { extraction, field } from "../../../test/helpers/extraction";
import type { DocumentRecord } from "@/lib/storage/types";
import { isValidNormalized, toEffectiveDocuments } from "./effective";

const doc = (id: string, result = extraction()): DocumentRecord => ({
  id,
  checkId: "c",
  fileName: `${id}.pdf`,
  mimeType: "application/pdf",
  size: 1,
  pageCount: 1,
  createdAt: "",
  status: "extracted",
  errorCode: null,
  documentType: result.documentType,
  documentLanguage: "en",
  extraction: result,
  extractedAt: "",
});

describe("toEffectiveDocuments", () => {
  it("applies user corrections and keeps the extracted value", () => {
    const [effective] = toEffectiveDocuments(
      [doc("a", extraction({ header: { currency: field("EUR", { confidence: 0.4 }) } }))],
      [{ documentId: "a", path: "header.currency", normalized: "USD", correctedAt: "" }],
    );
    expect(effective!.header.currency).toMatchObject({
      normalized: "USD",
      extractedNormalized: "EUR",
      corrected: true,
      lowConfidence: false,
    });
  });

  it("flags low-confidence values that have not been corrected", () => {
    const [effective] = toEffectiveDocuments(
      [
        doc(
          "a",
          extraction({
            header: { currency: field("EUR", { confidence: 0.5 }) },
            lines: [{ quantity: field("10", { confidence: 0.99 }) }],
          }),
        ),
      ],
      [],
    );
    expect(effective!.header.currency.lowConfidence).toBe(true);
    expect(effective!.lines[0]!.quantity.lowConfidence).toBe(false);
    expect(effective!.lines[0]!.quantity.path).toBe("lines.0.quantity");
    // A field that was not printed is not "low confidence"; it is missing.
    expect(effective!.header.iban.lowConfidence).toBe(false);
  });

  it("skips documents that have not been read yet", () => {
    expect(toEffectiveDocuments([{ ...doc("a"), extraction: null }], [])).toEqual([]);
  });
});

describe("isValidNormalized", () => {
  it.each([
    ["amount", "1250.50", true],
    ["amount", "1,250.50", false],
    ["quantity", "-3", false],
    ["date", "2026-02-29", false],
    ["date", "2028-02-29", true],
    ["currency", "EUR", true],
    ["currency", "eur", false],
    ["country", "TR", true],
    ["incoterm", "FOB", true],
    ["weightUnit", "kg", true],
    ["weightUnit", "kgs", false],
    ["hsCode", "850440", true],
    ["hsCode", "8504.40", false],
    ["iban", "DE89370400440532013000", true],
  ] as const)("%s %s → %s", (kind, value, expected) => {
    expect(isValidNormalized(kind, value)).toBe(expected);
  });
});
