import "server-only";
import { NextResponse } from "next/server";
import { getStorage, type CheckRecord, type DocumentRecord } from "@/lib/storage";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export function errorResponse(code: string, status: number, extra?: Record<string, unknown>) {
  return NextResponse.json({ error: code, ...extra }, { status });
}

export async function findCheck(
  checkId: string,
): Promise<{ check: CheckRecord } | { response: NextResponse }> {
  if (!UUID.test(checkId)) return { response: errorResponse("not_found", 404) };
  const check = await (await getStorage()).getCheck(checkId);
  return check ? { check } : { response: errorResponse("not_found", 404) };
}

export async function findDocument(
  checkId: string,
  documentId: string,
): Promise<{ check: CheckRecord; document: DocumentRecord } | { response: NextResponse }> {
  const found = await findCheck(checkId);
  if ("response" in found) return found;
  if (!UUID.test(documentId)) return { response: errorResponse("not_found", 404) };
  const document = await (await getStorage()).getDocument(checkId, documentId);
  return document
    ? { check: found.check, document }
    : { response: errorResponse("not_found", 404) };
}

export async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}
