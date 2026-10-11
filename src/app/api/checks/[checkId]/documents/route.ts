import { NextResponse } from "next/server";
import { errorResponse, findCheck } from "@/lib/api/http";
import { getServerEnv } from "@/lib/config/env";
import { getStorage } from "@/lib/storage";
import { inspectUpload } from "@/lib/upload/file-type";

type Context = { params: Promise<{ checkId: string }> };

function cleanFileName(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? "";
  const cleaned = base.replace(/[\u0000-\u001f\u007f]/g, "").trim();
  return (cleaned || "document").slice(0, 200);
}

export async function POST(request: Request, { params }: Context) {
  const { checkId } = await params;
  const found = await findCheck(checkId);
  if ("response" in found) return found.response;

  const env = getServerEnv();
  const storage = await getStorage();
  if ((await storage.listDocuments(checkId)).length >= env.UPLOAD_MAX_FILES_PER_CHECK) {
    return errorResponse("too_many_files", 409);
  }

  let file: FormDataEntryValue | null;
  try {
    file = (await request.formData()).get("file");
  } catch {
    return errorResponse("invalid_request", 400);
  }
  if (!(file instanceof File)) return errorResponse("invalid_request", 400);

  const maxBytes = env.UPLOAD_MAX_FILE_MB * 1024 * 1024;
  // Reject by declared size before reading the body into memory.
  if (file.size > maxBytes) return errorResponse("too_large", 413);

  const bytes = new Uint8Array(await file.arrayBuffer());
  const inspected = await inspectUpload(bytes, { maxBytes, maxPages: env.UPLOAD_MAX_PAGES });
  if (!inspected.ok) {
    return errorResponse(inspected.reason, inspected.reason === "too_large" ? 413 : 422);
  }

  const document = await storage.addDocument(
    checkId,
    {
      fileName: cleanFileName(file.name),
      mimeType: inspected.mimeType,
      pageCount: inspected.pageCount,
    },
    bytes,
  );
  return NextResponse.json({ id: document.id }, { status: 201 });
}
