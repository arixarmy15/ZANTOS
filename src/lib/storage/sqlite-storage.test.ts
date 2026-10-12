import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { extraction, field } from "../../../test/helpers/extraction";
import { SqliteStorage } from "./sqlite-storage";

let dir: string;
let storage: SqliteStorage;
const bytes = new TextEncoder().encode("%PDF-test");

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "tickline-"));
  storage = new SqliteStorage(dir, 24);
});

afterEach(() => rmSync(dir, { recursive: true, force: true }));

describe("SqliteStorage", () => {
  it("creates checks with an expiry based on the retention period", async () => {
    const check = await storage.createCheck({ name: "PO 4711" });
    const hours = (Date.parse(check.expiresAt) - Date.parse(check.createdAt)) / 3_600_000;
    expect(hours).toBe(24);
    expect(await storage.getCheck(check.id)).toEqual(check);
    expect((await storage.listChecks()).map((c) => c.id)).toEqual([check.id]);
  });

  it("stores documents with their file and returns them in upload order", async () => {
    const check = await storage.createCheck({ name: null });
    const first = await storage.addDocument(
      check.id,
      { fileName: "a.pdf", mimeType: "application/pdf", pageCount: 2 },
      bytes,
    );
    await storage.addDocument(
      check.id,
      { fileName: "b.png", mimeType: "image/png", pageCount: 1 },
      bytes,
    );
    expect((await storage.listDocuments(check.id)).map((d) => d.fileName)).toEqual([
      "a.pdf",
      "b.png",
    ]);
    expect(await storage.readDocumentFile(first)).toEqual(bytes);
    expect(first.status).toBe("uploaded");
  });

  it("saves extractions, corrections and token usage", async () => {
    const check = await storage.createCheck({ name: null });
    const doc = await storage.addDocument(
      check.id,
      { fileName: "a.pdf", mimeType: "application/pdf", pageCount: 1 },
      bytes,
    );
    const result = extraction({ header: { currency: field("EUR") } });
    await storage.updateDocument(doc.id, { status: "extracted", extraction: result });
    expect((await storage.getDocument(check.id, doc.id))?.extraction).toEqual(result);

    await storage.setCorrection(doc.id, "header.currency", "USD");
    await storage.setCorrection(doc.id, "header.currency", "GBP");
    expect((await storage.listCorrections(check.id)).map((c) => c.normalized)).toEqual(["GBP"]);
    await storage.removeCorrection(doc.id, "header.currency");
    expect(await storage.listCorrections(check.id)).toEqual([]);

    await storage.recordUsage({
      checkId: check.id,
      documentId: doc.id,
      kind: "extract",
      model: "claude-sonnet-5-5",
      inputTokens: 1200,
      outputTokens: 300,
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
    });
    const [summary] = await storage.listChecks();
    expect(summary).toMatchObject({ documentCount: 1, inputTokens: 1200, outputTokens: 300 });
  });

  it("deletes a check with its files", async () => {
    const check = await storage.createCheck({ name: null });
    await storage.addDocument(
      check.id,
      { fileName: "a.pdf", mimeType: "application/pdf", pageCount: 1 },
      bytes,
    );
    await storage.deleteCheck(check.id);
    expect(await storage.getCheck(check.id)).toBeNull();
    expect(existsSync(join(dir, "files", check.id))).toBe(false);
  });

  it("purges checks whose retention period has ended", async () => {
    const check = await storage.createCheck({ name: null });
    await storage.addDocument(
      check.id,
      { fileName: "a.pdf", mimeType: "application/pdf", pageCount: 1 },
      bytes,
    );
    expect(await storage.purgeExpired(new Date())).toBe(0);
    expect(await storage.purgeExpired(new Date(Date.now() + 25 * 3_600_000))).toBe(1);
    expect(existsSync(join(dir, "files", check.id))).toBe(false);
  });

  it("keeps a small cache per check that can be cleared by prefix", async () => {
    const check = await storage.createCheck({ name: null });
    await storage.setCached(check.id, "explain:F1:en", { text: "x" });
    await storage.setCached(check.id, "compare:abc", { same: true });
    await storage.clearCached(check.id, "explain:");
    expect(await storage.getCached(check.id, "explain:F1:en")).toBeNull();
    expect(await storage.getCached(check.id, "compare:abc")).toEqual({ same: true });
  });

  it("keeps the database written under the previous name", async () => {
    const legacy = mkdtempSync(join(tmpdir(), "tickline-legacy-"));
    try {
      // A data folder from before the rename holds tradecheck.sqlite.
      const old = new DatabaseSync(join(legacy, "tradecheck.sqlite"));
      old.exec("CREATE TABLE marker (id INTEGER); INSERT INTO marker VALUES (7);");
      old.close();
      const reopened = new SqliteStorage(legacy, 24);
      expect(await reopened.listChecks()).toEqual([]);
      expect(existsSync(join(legacy, "tradecheck.sqlite"))).toBe(false);
      const moved = new DatabaseSync(join(legacy, "tickline.sqlite"));
      expect(moved.prepare("SELECT id FROM marker").get()).toEqual({ id: 7 });
      moved.close();
    } finally {
      rmSync(legacy, { recursive: true, force: true });
    }
  });
});
