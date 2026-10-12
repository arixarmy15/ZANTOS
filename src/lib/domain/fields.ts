/**
 * The fields TradeCheck extracts. Adding a document type (bill of lading, air waybill,
 * certificate of origin) means adding it to DOCUMENT_TYPES, extending these maps where it
 * has new fields, and adding its required fields in the validation rules.
 */
export const DOCUMENT_TYPES = [
  "commercial_invoice",
  "packing_list",
  "purchase_order",
  "other",
] as const;
export type DocumentType = (typeof DOCUMENT_TYPES)[number];

/** How a field's normalized value is formatted and checked. */
export type FieldKind =
  | "text"
  | "party"
  | "date"
  | "amount"
  | "quantity"
  | "currency"
  | "country"
  | "incoterm"
  | "weightUnit"
  | "hsCode"
  | "iban"
  | "vatId"
  | "eori";

export const HEADER_FIELDS = {
  documentNumber: "text",
  documentDate: "date",
  orderReference: "text",
  sellerName: "party",
  sellerAddress: "text",
  sellerVatId: "vatId",
  sellerEori: "eori",
  buyerName: "party",
  buyerAddress: "text",
  buyerVatId: "vatId",
  buyerEori: "eori",
  shipperName: "party",
  consigneeName: "party",
  currency: "currency",
  totalAmount: "amount",
  incoterm: "incoterm",
  incotermPlace: "text",
  countryOfOrigin: "country",
  countryOfDestination: "country",
  totalQuantity: "quantity",
  packageCount: "quantity",
  grossWeight: "quantity",
  grossWeightUnit: "weightUnit",
  netWeight: "quantity",
  netWeightUnit: "weightUnit",
  iban: "iban",
} as const satisfies Record<string, FieldKind>;

export const LINE_FIELDS = {
  description: "text",
  hsCode: "hsCode",
  quantity: "quantity",
  unit: "text",
  unitPrice: "amount",
  lineTotal: "amount",
  countryOfOrigin: "country",
} as const satisfies Record<string, FieldKind>;

export type HeaderFieldKey = keyof typeof HEADER_FIELDS;
export type LineFieldKey = keyof typeof LINE_FIELDS;

export const HEADER_FIELD_KEYS = Object.keys(HEADER_FIELDS) as HeaderFieldKey[];
export const LINE_FIELD_KEYS = Object.keys(LINE_FIELDS) as LineFieldKey[];

/** Extracted fields below this confidence are marked "Low confidence — please verify". */
export const LOW_CONFIDENCE_THRESHOLD = 0.7;

/** Path of a field inside a document: `header.totalAmount` or `lines.2.quantity`. */
export type FieldPath = `header.${HeaderFieldKey}` | `lines.${number}.${LineFieldKey}`;

export function parseFieldPath(
  path: string,
):
  | { scope: "header"; key: HeaderFieldKey }
  | { scope: "line"; index: number; key: LineFieldKey }
  | null {
  const header = /^header\.([A-Za-z]+)$/.exec(path);
  if (header && header[1]! in HEADER_FIELDS)
    return { scope: "header", key: header[1] as HeaderFieldKey };
  const line = /^lines\.(\d{1,4})\.([A-Za-z]+)$/.exec(path);
  if (line && line[2]! in LINE_FIELDS) {
    return { scope: "line", index: Number(line[1]), key: line[2] as LineFieldKey };
  }
  return null;
}

export function fieldKind(path: string): FieldKind | null {
  const parsed = parseFieldPath(path);
  if (!parsed) return null;
  return parsed.scope === "header" ? HEADER_FIELDS[parsed.key] : LINE_FIELDS[parsed.key];
}
