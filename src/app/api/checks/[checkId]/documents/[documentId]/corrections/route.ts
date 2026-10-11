import { NextResponse } from "next/server";
import { z } from "zod";
import { errorResponse, findDocument, readJson } from "@/lib/api/http";
import { isValidNormalized } from "@/lib/checks/effective";
import { fieldKind, parseFieldPath } from "@/lib/domain/fields";
import { getStorage } from "@/lib/storage";

type Context = { params: Promise<{ checkId: string; documentId: string }> };

const bodySchema = z.object({
  path: z.string().max(64),
  /** New value used for checks; null means "not present in the document". */
  normalized: z.string().trim().max(500).nullable(),
  /** Restore the extracted value instead of storing a correction. */
  revert: z.boolean().optional(),
});

export async function PUT(request: Request, { params }: Context) {
  const { checkId, documentId } = await params;
  const found = await findDocument(checkId, documentId);
  if ("response" in found) return found.response;
  const extraction = found.document.extraction;
  if (!extraction) return errorResponse("not_extracted", 409);

  const body = bodySchema.safeParse(await readJson(request));
  if (!body.success) return errorResponse("invalid_request", 400);
  const parsedPath = parseFieldPath(body.data.path);
  if (!parsedPath || (parsedPath.scope === "line" && parsedPath.index >= extraction.lines.length)) {
    return errorResponse("invalid_request", 400);
  }

  const storage = await getStorage();
  if (body.data.revert) {
    await storage.removeCorrection(documentId, body.data.path);
  } else {
    const value = body.data.normalized === "" ? null : body.data.normalized;
    const kind = fieldKind(body.data.path)!;
    const normalizedValue =
      kind === "iban" && value ? value.replace(/\s+/g, "").toUpperCase() : value;
    if (normalizedValue !== null && !isValidNormalized(kind, normalizedValue)) {
      return errorResponse("invalid_value", 422, { kind });
    }
    await storage.setCorrection(documentId, body.data.path, normalizedValue);
  }
  // Findings are recomputed on the next view; AI results are cached by content hash.
  return new NextResponse(null, { status: 204 });
}
