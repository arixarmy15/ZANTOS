import { NextResponse } from "next/server";
import { AiError, logAiError, toAiError } from "@/lib/anthropic/client";
import { errorResponse, findDocument } from "@/lib/api/http";
import { getServerEnv, isAnthropicConfigured } from "@/lib/config/env";
import { extractDocument } from "@/lib/extraction/extract";
import { getStorage } from "@/lib/storage";

type Context = { params: Promise<{ checkId: string; documentId: string }> };

// Reading a long PDF can take a while.
export const maxDuration = 300;

export async function POST(_request: Request, { params }: Context) {
  const { checkId, documentId } = await params;
  const found = await findDocument(checkId, documentId);
  if ("response" in found) return found.response;
  if (!isAnthropicConfigured(getServerEnv())) return errorResponse("not_configured", 503);

  const storage = await getStorage();
  const { document } = found;
  await storage.updateDocument(documentId, { status: "extracting", errorCode: null });

  try {
    const bytes = await storage.readDocumentFile(document);
    const { extraction, usage } = await extractDocument({
      bytes,
      mimeType: document.mimeType,
      pageCount: document.pageCount,
    });
    await storage.recordUsage({ checkId, documentId, kind: "extract", ...usage });

    // A fresh extraction replaces earlier corrections, which may point at lines that no
    // longer exist.
    const corrections = (await storage.listCorrections(checkId)).filter(
      (correction) => correction.documentId === documentId,
    );
    for (const correction of corrections)
      await storage.removeCorrection(documentId, correction.path);

    await storage.updateDocument(documentId, {
      status: "extracted",
      errorCode: null,
      extraction,
      extractedAt: new Date().toISOString(),
      documentType: extraction.documentType,
      documentLanguage: extraction.documentLanguage,
    });
    await storage.clearCached(checkId, "");
    return NextResponse.json({ status: "extracted", usage });
  } catch (caught) {
    const error: AiError = toAiError(caught);
    logAiError("extraction", error);
    if (error.usage) {
      await storage.recordUsage({ checkId, documentId, kind: "extract", ...error.usage });
    }
    await storage.updateDocument(documentId, { status: "failed", errorCode: error.code });
    return errorResponse(error.code, error.code === "not_configured" ? 503 : 502);
  }
}
