import { findDocument } from "@/lib/api/http";
import { getStorage } from "@/lib/storage";

type Context = { params: Promise<{ checkId: string; documentId: string }> };

/** Serves the uploaded file to the document viewer. Never cached, never sniffed. */
export async function GET(_request: Request, { params }: Context) {
  const { checkId, documentId } = await params;
  const found = await findDocument(checkId, documentId);
  if ("response" in found) return found.response;
  const bytes = await (await getStorage()).readDocumentFile(found.document);
  return new Response(new Blob([bytes as BlobPart]), {
    headers: {
      "Content-Type": found.document.mimeType,
      "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(found.document.fileName)}`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
