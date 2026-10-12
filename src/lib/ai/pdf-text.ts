import "server-only";

/**
 * The text layer of a PDF, page by page, for models that cannot read PDF files directly.
 * Scanned pages have no text layer and come back empty.
 */
export async function pdfPageTexts(bytes: Uint8Array): Promise<string[]> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  // PDF.js may transfer the buffer to its worker, so it gets a copy.
  const task = pdfjs.getDocument({ data: new Uint8Array(bytes), enableXfa: false, verbosity: 0 });
  try {
    const document = await task.promise;
    const pages: string[] = [];
    for (let number = 1; number <= document.numPages; number++) {
      const page = await document.getPage(number);
      const content = await page.getTextContent();
      const text = content.items
        .map((item) => ("str" in item ? item.str + (item.hasEOL ? "\n" : " ") : ""))
        .join("")
        .replace(/[ \t]+\n/g, "\n")
        .trim();
      pages.push(text);
    }
    return pages;
  } finally {
    await task.destroy();
  }
}
