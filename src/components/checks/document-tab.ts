import type { DocumentType } from "@/lib/domain/fields";

/**
 * Binder tab colour per document type (DESIGN.md §18). Categorical only: it tells documents
 * apart at a glance and never stands for a status.
 */
export const DOCUMENT_TAB: Record<DocumentType, string> = {
  commercial_invoice: "bg-tab-invoice",
  packing_list: "bg-tab-packing",
  purchase_order: "bg-tab-order",
  other: "bg-tab-other",
};

export function documentTab(type: DocumentType | null): string {
  return type ? DOCUMENT_TAB[type] : "bg-rule";
}
