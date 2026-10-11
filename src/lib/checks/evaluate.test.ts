import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { SqliteStorage } from "@/lib/storage/sqlite-storage";
import { extraction, field } from "../../../test/helpers/extraction";
import { compareCacheKey, evaluateCheck } from "./evaluate";

let dir: string;
let storage: SqliteStorage;
const bytes = new TextEncoder().encode("%PDF-test");

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "tradecheck-"));
  storage = new SqliteStorage(dir, 24);
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

async function seed() {
  const check = await storage.createCheck({ name: null });
  const meta = { mimeType: "application/pdf" as const, pageCount: 1 };
  const invoice = await storage.addDocument(check.id, { ...meta, fileName: "invoice.pdf" }, bytes);
  const packing = await storage.addDocument(check.id, { ...meta, fileName: "packing.pdf" }, bytes);
  await storage.addDocument(check.id, { ...meta, fileName: "unread.pdf" }, bytes);
  await storage.updateDocument(invoice.id, {
    status: "extracted",
    documentType: "commercial_invoice",
    extraction: extraction({ header: { sellerName: field("Anatolia Textiles Ltd") } }),
  });
  await storage.updateDocument(packing.id, {
    status: "extracted",
    documentType: "packing_list",
    extraction: extraction({
      documentType: "packing_list",
      header: { shipperName: field("Anatolia Tekstil A.Ş.") },
    }),
  });
  return check;
}

describe("evaluateCheck", () => {
  it("runs the rules over read documents and lists unread ones", async () => {
    const check = await seed();
    const { run, pending, effective } = await evaluateCheck(storage, check);
    expect(effective.map((doc) => doc.record.fileName)).toEqual(["invoice.pdf", "packing.pdf"]);
    expect(run.findings.some((item) => item.messageKey === "doc-not-read")).toBe(true);
    expect(pending.map((request) => request.kind)).toEqual(["party"]);
    expect(run.findings.find((item) => item.ruleId === "xdoc-exporter")?.messageKey).toBe(
      "xdoc-exporter-unknown",
    );
  });

  it("uses cached verdicts and ignores malformed cache entries", async () => {
    const check = await seed();
    const [request] = (await evaluateCheck(storage, check)).pending;
    await storage.setCached(check.id, compareCacheKey(request!), { same: "maybe" });
    expect((await evaluateCheck(storage, check)).pending).toHaveLength(1);

    await storage.setCached(check.id, compareCacheKey(request!), { same: true, confidence: 0.95 });
    const { run, pending } = await evaluateCheck(storage, check);
    expect(pending).toEqual([]);
    expect(run.findings.find((item) => item.ruleId === "xdoc-exporter")?.messageKey).toBe(
      "xdoc-exporter-same",
    );
  });
});
