import { NextResponse } from "next/server";
import { z } from "zod";
import { errorResponse, findCheck, readJson } from "@/lib/api/http";
import { getStorage } from "@/lib/storage";

type Context = { params: Promise<{ checkId: string }> };

const patchSchema = z.object({
  // Absolute rounding tolerance for amount checks, e.g. "0.01".
  tolerance: z
    .string()
    .regex(/^\d{1,6}(?:\.\d{1,6})?$/)
    .optional(),
  name: z.string().trim().max(120).nullable().optional(),
});

export async function PATCH(request: Request, { params }: Context) {
  const { checkId } = await params;
  const found = await findCheck(checkId);
  if ("response" in found) return found.response;
  const body = patchSchema.safeParse(await readJson(request));
  if (!body.success) return errorResponse("invalid_request", 400);
  const storage = await getStorage();
  await storage.updateCheck(checkId, {
    tolerance: body.data.tolerance,
    name: body.data.name === undefined ? undefined : body.data.name || null,
  });
  await storage.clearCached(checkId, "");
  return new NextResponse(null, { status: 204 });
}

/** Manual deletion: removes the check's rows and uploaded files immediately. */
export async function DELETE(_request: Request, { params }: Context) {
  const { checkId } = await params;
  const found = await findCheck(checkId);
  if ("response" in found) return found.response;
  await (await getStorage()).deleteCheck(checkId);
  return new NextResponse(null, { status: 204 });
}
