import { NextResponse } from "next/server";
import { z } from "zod";
import { errorResponse, readJson } from "@/lib/api/http";
import { getStorage } from "@/lib/storage";

const createSchema = z.object({ name: z.string().trim().max(120).nullable().optional() });

export async function POST(request: Request) {
  const body = createSchema.safeParse((await readJson(request)) ?? {});
  if (!body.success) return errorResponse("invalid_request", 400);
  const check = await (await getStorage()).createCheck({ name: body.data.name || null });
  return NextResponse.json({ id: check.id }, { status: 201 });
}
