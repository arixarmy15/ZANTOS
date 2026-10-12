import { describe, expect, it } from "vitest";
import { effective, record } from "../../../test/helpers/documents";
import { field } from "../../../test/helpers/extraction";
import { collectPartyIdentifiers } from "./identifiers";

describe("collectPartyIdentifiers", () => {
  it("lists each distinct number once with the documents that print it and where to verify it", () => {
    const documents = effective([
      record("inv", {
        documentType: "commercial_invoice",
        header: { sellerVatId: field("NL123456789B01"), sellerEori: field("NL123456789") },
      }),
      record("pl", {
        documentType: "packing_list",
        header: { sellerVatId: field("NL123456789B01"), buyerVatId: field("CHE123456789MWST") },
      }),
    ]);
    expect(collectPartyIdentifiers(documents)).toEqual([
      {
        party: "seller",
        kind: "vatId",
        value: "NL123456789B01",
        documents: [documents[0]!.record.fileName, documents[1]!.record.fileName],
        verifyAt: "vies",
      },
      {
        party: "seller",
        kind: "eori",
        value: "NL123456789",
        documents: [documents[0]!.record.fileName],
        verifyAt: "eori",
      },
      {
        party: "buyer",
        kind: "vatId",
        value: "CHE123456789MWST",
        documents: [documents[1]!.record.fileName],
        verifyAt: null,
      },
    ]);
  });

  it("is empty when no document prints a party identifier", () => {
    expect(collectPartyIdentifiers(effective([record("inv")]))).toEqual([]);
  });
});
