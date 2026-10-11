import { EncryptedPDFError, PDFDocument } from "pdf-lib";

export const SUPPORTED_MIME_TYPES = ["application/pdf", "image/png", "image/jpeg"] as const;
export type SupportedMimeType = (typeof SUPPORTED_MIME_TYPES)[number];

/** Identifies a file by its leading bytes; the file name and declared type are ignored. */
export function detectMimeType(bytes: Uint8Array): SupportedMimeType | null {
  const startsWith = (signature: number[]) => signature.every((byte, i) => bytes[i] === byte);
  if (startsWith([0x25, 0x50, 0x44, 0x46, 0x2d])) return "application/pdf"; // %PDF-
  if (startsWith([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "image/png";
  if (startsWith([0xff, 0xd8, 0xff])) return "image/jpeg";
  return null;
}

export type UploadRejection =
  | "empty"
  | "too_large"
  | "unsupported_type"
  | "too_many_pages"
  | "encrypted_pdf"
  | "unreadable_pdf"
  | "too_many_files";

export type UploadCheck =
  | { ok: true; mimeType: SupportedMimeType; pageCount: number | null }
  | { ok: false; reason: UploadRejection };

export async function inspectUpload(
  bytes: Uint8Array,
  limits: { maxBytes: number; maxPages: number },
): Promise<UploadCheck> {
  if (bytes.byteLength === 0) return { ok: false, reason: "empty" };
  if (bytes.byteLength > limits.maxBytes) return { ok: false, reason: "too_large" };
  const mimeType = detectMimeType(bytes);
  if (!mimeType) return { ok: false, reason: "unsupported_type" };
  if (mimeType !== "application/pdf") return { ok: true, mimeType, pageCount: 1 };

  try {
    const pdf = await PDFDocument.load(bytes, { updateMetadata: false });
    const pageCount = pdf.getPageCount();
    if (pageCount > limits.maxPages) return { ok: false, reason: "too_many_pages" };
    return { ok: true, mimeType, pageCount };
  } catch (error) {
    return {
      ok: false,
      reason: error instanceof EncryptedPDFError ? "encrypted_pdf" : "unreadable_pdf",
    };
  }
}
