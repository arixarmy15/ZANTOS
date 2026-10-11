import { NextResponse } from "next/server";
import { z } from "zod";
import { errorResponse, findDocument, readJson } from "@/lib/api/http";
import { DOCUMENT_TYPES } from "@/lib/domain/fields";
import { getStorage } from "@/lib/storage";

type Context = { params: Promise<{ checkId: string; documentId: string }> };

const patchSchema = z.object({ documentType: z.enum(DOCUMENT_TYPES) });

/** The user can correct the detected document type. */
export async function PATCH(request: Request, { params }: Context) {
  const { checkId, documentId } = await params;
  const found = await findDocument(checkId, documentId);
  if ("response" in found) return found.response;
  const body = patchSchema.safeParse(await readJson(request));
  if (!body.success) return errorResponse("invalid_request", 400);
  const storage = await getStorage();
  await storage.updateDocument(documentId, { documentType: body.data.documentType });
  await storage.clearCached(checkId, "");
  return new NextResponse(null, { status: 204 });
}

export async function DELETE(_request: Request, { params }: Context) {
  const { checkId, documentId } = await params;
  const found = await findDocument(checkId, documentId);
  if ("response" in found) return found.response;
  const storage = await getStorage();
  await storage.deleteDocument(checkId, documentId);
  await storage.clearCached(checkId, "");
  return new NextResponse(null, { status: 204 });
}
