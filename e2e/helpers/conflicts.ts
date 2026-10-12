import { extraction, field, seedCheck } from "./seed";

/** Synthetic invoice and packing list that contradict each other in known ways. */
export function seedConflicts(name: string) {
  const at = (text: string) => ({ source: { page: 1, text } });
  return seedCheck({
    name,
    documents: [
      {
        fileName: "synthetic-invoice.pdf",
        lines: [
          "Invoice no. INV-E2E-1",
          "Seller: Synthetic Exporter Ltd",
          "Buyer: Synthetic Importer GmbH",
          "Packages: 12",
          "Towels  10 x 9.00 = 95.00",
          "Total EUR 95.00",
        ],
        extraction: extraction({
          documentType: "commercial_invoice",
          header: {
            documentNumber: field("INV-E2E-1", at("Invoice no. INV-E2E-1")),
            documentDate: field("2026-03-01"),
            sellerName: field("Synthetic Exporter Ltd", at("Seller: Synthetic Exporter Ltd")),
            buyerName: field("Synthetic Importer GmbH", at("Buyer: Synthetic Importer GmbH")),
            currency: field("EUR", at("Total EUR 95.00")),
            totalAmount: field("95.00", at("Total EUR 95.00")),
            packageCount: field("12", at("Packages: 12")),
          },
          lines: [
            {
              description: field("Towels", at("Towels")),
              quantity: field("10", at("Towels  10 x 9.00 = 95.00")),
              unitPrice: field("9.00", at("Towels  10 x 9.00 = 95.00")),
              lineTotal: field("95.00", at("Towels  10 x 9.00 = 95.00")),
            },
          ],
        }),
      },
      {
        fileName: "synthetic-packing-list.pdf",
        lines: [
          "Packing list",
          "Shipper: Synthetic Export Limited",
          "Packages: 14",
          "Net weight 120 kg",
          "Gross weight 110 kg",
          "Towels 10",
        ],
        extraction: extraction({
          documentType: "packing_list",
          header: {
            shipperName: field("Synthetic Export Limited", at("Shipper: Synthetic Export Limited")),
            consigneeName: field("Synthetic Importer GmbH"),
            packageCount: field("14", at("Packages: 14")),
            netWeight: field("120", at("Net weight 120 kg")),
            netWeightUnit: field("kg", at("Net weight 120 kg")),
            grossWeight: field("110", at("Gross weight 110 kg")),
            grossWeightUnit: field("kg", at("Gross weight 110 kg")),
          },
          lines: [
            {
              description: field("Towels", at("Towels 10")),
              quantity: field("10", at("Towels 10")),
            },
          ],
        }),
      },
    ],
  });
}
