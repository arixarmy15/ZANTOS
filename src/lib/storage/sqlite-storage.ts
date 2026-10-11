import { randomUUID } from "node:crypto";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import type { DocumentType } from "@/lib/domain/fields";
import type { Extraction } from "@/lib/extraction/schema";
import type { SupportedMimeType } from "@/lib/upload/file-type";
import type {
  CheckRecord,
  CheckSummary,
  CorrectionRecord,
  DocumentRecord,
  DocumentStatus,
  Storage,
  UsageKind,
  UsageRecord,
} from "./types";

const SCHEMA = `
PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;
CREATE TABLE IF NOT EXISTS checks (
  id TEXT PRIMARY KEY,
  name TEXT,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  tolerance TEXT NOT NULL DEFAULT '0.01'
);
CREATE TABLE IF NOT EXISTS documents (
  id TEXT PRIMARY KEY,
  check_id TEXT NOT NULL REFERENCES checks(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size INTEGER NOT NULL,
  page_count INTEGER,
  created_at TEXT NOT NULL,
  status TEXT NOT NULL,
  error_code TEXT,
  document_type TEXT,
  document_language TEXT,
  extraction TEXT,
  extracted_at TEXT
);
CREATE INDEX IF NOT EXISTS documents_check ON documents(check_id);
CREATE TABLE IF NOT EXISTS corrections (
  document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  path TEXT NOT NULL,
  normalized TEXT,
  corrected_at TEXT NOT NULL,
  PRIMARY KEY (document_id, path)
);
CREATE TABLE IF NOT EXISTS usage (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  check_id TEXT NOT NULL REFERENCES checks(id) ON DELETE CASCADE,
  document_id TEXT,
  kind TEXT NOT NULL,
  model TEXT NOT NULL,
  input_tokens INTEGER NOT NULL,
  output_tokens INTEGER NOT NULL,
  cache_read_tokens INTEGER NOT NULL,
  cache_write_tokens INTEGER NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS usage_check ON usage(check_id);
CREATE TABLE IF NOT EXISTS cache (
  check_id TEXT NOT NULL REFERENCES checks(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  value TEXT NOT NULL,
  PRIMARY KEY (check_id, key)
);
`;

type Row = Record<string, string | number | null>;

const str = (value: unknown) => (value === null || value === undefined ? null : String(value));

function toCheck(row: Row): CheckRecord {
  return {
    id: String(row.id),
    name: str(row.name),
    createdAt: String(row.created_at),
    expiresAt: String(row.expires_at),
    tolerance: String(row.tolerance),
  };
}

function toDocument(row: Row): DocumentRecord {
  return {
    id: String(row.id),
    checkId: String(row.check_id),
    fileName: String(row.file_name),
    mimeType: String(row.mime_type) as SupportedMimeType,
    size: Number(row.size),
    pageCount: row.page_count === null ? null : Number(row.page_count),
    createdAt: String(row.created_at),
    status: String(row.status) as DocumentStatus,
    errorCode: str(row.error_code),
    documentType: str(row.document_type) as DocumentType | null,
    documentLanguage: str(row.document_language),
    extraction: row.extraction === null ? null : (JSON.parse(String(row.extraction)) as Extraction),
    extractedAt: str(row.extracted_at),
  };
}

export class SqliteStorage implements Storage {
  private readonly db: DatabaseSync;
  private readonly filesDir: string;

  constructor(
    dataDir: string,
    private readonly retentionHours: number,
  ) {
    const root = resolve(dataDir);
    this.filesDir = join(root, "files");
    mkdirSync(this.filesDir, { recursive: true, mode: 0o700 });
    this.db = new DatabaseSync(join(root, "tradecheck.sqlite"));
    this.db.exec(SCHEMA);
  }

  private filePath(checkId: string, documentId: string) {
    return join(this.filesDir, checkId, documentId);
  }

  async createCheck({ name }: { name: string | null }): Promise<CheckRecord> {
    const now = new Date();
    const record: CheckRecord = {
      id: randomUUID(),
      name,
      createdAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + this.retentionHours * 3_600_000).toISOString(),
      tolerance: "0.01",
    };
    this.db
      .prepare(
        "INSERT INTO checks (id, name, created_at, expires_at, tolerance) VALUES (?, ?, ?, ?, ?)",
      )
      .run(record.id, record.name, record.createdAt, record.expiresAt, record.tolerance);
    return record;
  }

  async listChecks(): Promise<CheckSummary[]> {
    const rows = this.db
      .prepare(
        `SELECT c.*,
           (SELECT COUNT(*) FROM documents d WHERE d.check_id = c.id) AS document_count,
           (SELECT COALESCE(SUM(input_tokens), 0) FROM usage u WHERE u.check_id = c.id) AS input_tokens,
           (SELECT COALESCE(SUM(output_tokens), 0) FROM usage u WHERE u.check_id = c.id) AS output_tokens
         FROM checks c WHERE c.expires_at > ? ORDER BY c.created_at DESC`,
      )
      .all(new Date().toISOString()) as Row[];
    return rows.map((row) => ({
      ...toCheck(row),
      documentCount: Number(row.document_count),
      inputTokens: Number(row.input_tokens),
      outputTokens: Number(row.output_tokens),
    }));
  }

  async getCheck(checkId: string): Promise<CheckRecord | null> {
    const row = this.db
      .prepare("SELECT * FROM checks WHERE id = ? AND expires_at > ?")
      .get(checkId, new Date().toISOString()) as Row | undefined;
    return row ? toCheck(row) : null;
  }

  async updateCheck(checkId: string, patch: { tolerance?: string; name?: string | null }) {
    if (patch.tolerance !== undefined) {
      this.db.prepare("UPDATE checks SET tolerance = ? WHERE id = ?").run(patch.tolerance, checkId);
    }
    if (patch.name !== undefined) {
      this.db.prepare("UPDATE checks SET name = ? WHERE id = ?").run(patch.name, checkId);
    }
  }

  async deleteCheck(checkId: string) {
    this.db.prepare("DELETE FROM checks WHERE id = ?").run(checkId);
    rmSync(join(this.filesDir, checkId), { recursive: true, force: true });
  }

  async addDocument(
    checkId: string,
    meta: { fileName: string; mimeType: SupportedMimeType; pageCount: number | null },
    bytes: Uint8Array,
  ): Promise<DocumentRecord> {
    const id = randomUUID();
    const createdAt = new Date().toISOString();
    mkdirSync(join(this.filesDir, checkId), { recursive: true, mode: 0o700 });
    writeFileSync(this.filePath(checkId, id), bytes, { mode: 0o600 });
    this.db
      .prepare(
        `INSERT INTO documents (id, check_id, file_name, mime_type, size, page_count, created_at, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'uploaded')`,
      )
      .run(id, checkId, meta.fileName, meta.mimeType, bytes.byteLength, meta.pageCount, createdAt);
    return (await this.getDocument(checkId, id))!;
  }

  async listDocuments(checkId: string): Promise<DocumentRecord[]> {
    const rows = this.db
      .prepare("SELECT * FROM documents WHERE check_id = ? ORDER BY created_at, rowid")
      .all(checkId) as Row[];
    return rows.map(toDocument);
  }

  async getDocument(checkId: string, documentId: string): Promise<DocumentRecord | null> {
    const row = this.db
      .prepare("SELECT * FROM documents WHERE id = ? AND check_id = ?")
      .get(documentId, checkId) as Row | undefined;
    return row ? toDocument(row) : null;
  }

  async readDocumentFile(document: DocumentRecord): Promise<Uint8Array> {
    return new Uint8Array(readFileSync(this.filePath(document.checkId, document.id)));
  }

  async updateDocument(documentId: string, patch: Parameters<Storage["updateDocument"]>[1]) {
    const columns: Record<string, string> = {
      status: "status",
      errorCode: "error_code",
      documentType: "document_type",
      documentLanguage: "document_language",
      extraction: "extraction",
      extractedAt: "extracted_at",
    };
    for (const [key, value] of Object.entries(patch)) {
      const column = columns[key];
      if (!column) continue;
      const stored =
        key === "extraction" && value !== null ? JSON.stringify(value) : (value ?? null);
      this.db
        .prepare(`UPDATE documents SET ${column} = ? WHERE id = ?`)
        .run(stored as string | null, documentId);
    }
  }

  async deleteDocument(checkId: string, documentId: string) {
    this.db.prepare("DELETE FROM documents WHERE id = ? AND check_id = ?").run(documentId, checkId);
    rmSync(this.filePath(checkId, documentId), { force: true });
  }

  async setCorrection(documentId: string, path: string, normalized: string | null) {
    this.db
      .prepare(
        `INSERT INTO corrections (document_id, path, normalized, corrected_at) VALUES (?, ?, ?, ?)
         ON CONFLICT (document_id, path) DO UPDATE SET normalized = excluded.normalized, corrected_at = excluded.corrected_at`,
      )
      .run(documentId, path, normalized, new Date().toISOString());
  }

  async removeCorrection(documentId: string, path: string) {
    this.db
      .prepare("DELETE FROM corrections WHERE document_id = ? AND path = ?")
      .run(documentId, path);
  }

  async listCorrections(checkId: string): Promise<CorrectionRecord[]> {
    const rows = this.db
      .prepare(
        `SELECT c.* FROM corrections c JOIN documents d ON d.id = c.document_id WHERE d.check_id = ?`,
      )
      .all(checkId) as Row[];
    return rows.map((row) => ({
      documentId: String(row.document_id),
      path: String(row.path),
      normalized: str(row.normalized),
      correctedAt: String(row.corrected_at),
    }));
  }

  async recordUsage(usage: Omit<UsageRecord, "createdAt">) {
    this.db
      .prepare(
        `INSERT INTO usage (check_id, document_id, kind, model, input_tokens, output_tokens, cache_read_tokens, cache_write_tokens, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        usage.checkId,
        usage.documentId,
        usage.kind,
        usage.model,
        usage.inputTokens,
        usage.outputTokens,
        usage.cacheReadTokens,
        usage.cacheWriteTokens,
        new Date().toISOString(),
      );
  }

  async listUsage(checkId: string): Promise<UsageRecord[]> {
    const rows = this.db
      .prepare("SELECT * FROM usage WHERE check_id = ? ORDER BY id")
      .all(checkId) as Row[];
    return rows.map((row) => ({
      checkId: String(row.check_id),
      documentId: str(row.document_id),
      kind: String(row.kind) as UsageKind,
      model: String(row.model),
      inputTokens: Number(row.input_tokens),
      outputTokens: Number(row.output_tokens),
      cacheReadTokens: Number(row.cache_read_tokens),
      cacheWriteTokens: Number(row.cache_write_tokens),
      createdAt: String(row.created_at),
    }));
  }

  async getCached<T>(checkId: string, key: string): Promise<T | null> {
    const row = this.db
      .prepare("SELECT value FROM cache WHERE check_id = ? AND key = ?")
      .get(checkId, key) as Row | undefined;
    return row ? (JSON.parse(String(row.value)) as T) : null;
  }

  async setCached(checkId: string, key: string, value: unknown) {
    this.db
      .prepare(
        `INSERT INTO cache (check_id, key, value) VALUES (?, ?, ?)
         ON CONFLICT (check_id, key) DO UPDATE SET value = excluded.value`,
      )
      .run(checkId, key, JSON.stringify(value));
  }

  async clearCached(checkId: string, keyPrefix: string) {
    this.db
      .prepare("DELETE FROM cache WHERE check_id = ? AND substr(key, 1, ?) = ?")
      .run(checkId, keyPrefix.length, keyPrefix);
  }

  async purgeExpired(now = new Date()): Promise<number> {
    const expired = this.db
      .prepare("SELECT id FROM checks WHERE expires_at <= ?")
      .all(now.toISOString()) as Row[];
    for (const row of expired) await this.deleteCheck(String(row.id));
    return expired.length;
  }
}
