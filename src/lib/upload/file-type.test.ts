import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";
import { detectMimeType, inspectUpload } from "./file-type";

async function pdfWithPages(pages: number): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  for (let i = 0; i < pages; i++) pdf.addPage();
  return pdf.save();
}

const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0]);
const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0]);
const limits = { maxBytes: 1024 * 1024, maxPages: 3 };

describe("detectMimeType", () => {
  it("recognises PDF, PNG and JPEG by their magic bytes", async () => {
    expect(detectMimeType(await pdfWithPages(1))).toBe("application/pdf");
    expect(detectMimeType(png)).toBe("image/png");
    expect(detectMimeType(jpeg)).toBe("image/jpeg");
  });

  it("rejects anything else, whatever its name claims", () => {
    expect(detectMimeType(new TextEncoder().encode("<html>invoice.pdf</html>"))).toBeNull();
    expect(detectMimeType(new Uint8Array([0x50, 0x4b, 0x03, 0x04]))).toBeNull(); // zip/docx
  });
});

describe("inspectUpload", () => {
  it("accepts a PDF within the page limit and reports its page count", async () => {
    expect(await inspectUpload(await pdfWithPages(3), limits)).toEqual({
      ok: true,
      mimeType: "application/pdf",
      pageCount: 3,
    });
  });

  it("rejects a PDF over the page limit", async () => {
    expect(await inspectUpload(await pdfWithPages(4), limits)).toEqual({
      ok: false,
      reason: "too_many_pages",
    });
  });

  it("rejects empty, oversized, unsupported and broken files", async () => {
    expect(await inspectUpload(new Uint8Array(), limits)).toEqual({ ok: false, reason: "empty" });
    expect(await inspectUpload(new Uint8Array(limits.maxBytes + 1), limits)).toEqual({
      ok: false,
      reason: "too_large",
    });
    expect(await inspectUpload(new Uint8Array([1, 2, 3]), limits)).toEqual({
      ok: false,
      reason: "unsupported_type",
    });
    expect(await inspectUpload(new TextEncoder().encode("%PDF-1.7 broken"), limits)).toEqual({
      ok: false,
      reason: "unreadable_pdf",
    });
  });

  it("treats images as single pages", async () => {
    expect(await inspectUpload(png, limits)).toEqual({
      ok: true,
      mimeType: "image/png",
      pageCount: 1,
    });
  });
});
