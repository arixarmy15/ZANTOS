import { PDFDocument, StandardFonts } from "pdf-lib";
import { SqliteStorage } from "../../src/lib/storage/sqlite-storage";
import type { Extraction } from "../../src/lib/extraction/schema";
import { extraction, field } from "../../test/helpers/extraction";

/**
 * Test-only fixtures. They exercise the interface without calling Anthropic; they are
 * generated at test time, labelled as synthetic, and never shipped or shown in the product.
 */
export const E2E_DATA_DIR = ".e2e-data";

export async function syntheticPdf(lines: string[]): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595, 842]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  page.drawText("SYNTHETIC TEST FIXTURE", { x: 50, y: 800, size: 9, font });
  lines.forEach((text, i) => page.drawText(text, { x: 50, y: 760 - i * 18, size: 11, font }));
  return pdf.save();
}

export function storage() {
  return new SqliteStorage(E2E_DATA_DIR, 24);
}

export async function seedCheck(input: {
  name: string;
  documents: { fileName: string; lines: string[]; extraction: Extraction }[];
}) {
  const store = storage();
  const check = await store.createCheck({ name: input.name });
  const ids: string[] = [];
  for (const doc of input.documents) {
    const record = await store.addDocument(
      check.id,
      { fileName: doc.fileName, mimeType: "application/pdf", pageCount: 1 },
      await syntheticPdf(doc.lines),
    );
    await store.updateDocument(record.id, {
      status: "extracted",
      extraction: doc.extraction,
      documentType: doc.extraction.documentType,
      documentLanguage: doc.extraction.documentLanguage,
      extractedAt: new Date().toISOString(),
    });
    ids.push(record.id);
  }
  return { checkId: check.id, documentIds: ids };
}

export { extraction, field };
