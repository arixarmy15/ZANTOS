import type { DocumentType } from "@/lib/domain/fields";
import type { Extraction } from "@/lib/extraction/schema";
import type { SupportedMimeType } from "@/lib/upload/file-type";

export type CheckRecord = {
  id: string;
  name: string | null;
  createdAt: string;
  expiresAt: string;
  /** Absolute rounding tolerance for amount checks, as a decimal string. */
  tolerance: string;
};

export type CheckSummary = CheckRecord & {
  documentCount: number;
  inputTokens: number;
  outputTokens: number;
};

export type DocumentStatus = "uploaded" | "extracting" | "extracted" | "failed";

export type DocumentRecord = {
  id: string;
  checkId: string;
  fileName: string;
  mimeType: SupportedMimeType;
  size: number;
  pageCount: number | null;
  createdAt: string;
  status: DocumentStatus;
  errorCode: string | null;
  /** Set by extraction; the user can override it. */
  documentType: DocumentType | null;
  documentLanguage: string | null;
  extraction: Extraction | null;
  extractedAt: string | null;
};

export type CorrectionRecord = {
  documentId: string;
  path: string;
  normalized: string | null;
  correctedAt: string;
};

export type UsageKind = "extract" | "compare" | "explain" | "email";

export type UsageRecord = {
  checkId: string;
  documentId: string | null;
  kind: UsageKind;
  model: string;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  createdAt: string;
};

/**
 * Persistence boundary. The MVP implementation is SQLite plus the local file system;
 * anything else (Postgres + object storage) can implement the same interface.
 */
export interface Storage {
  createCheck(input: { name: string | null }): Promise<CheckRecord>;
  listChecks(): Promise<CheckSummary[]>;
  getCheck(checkId: string): Promise<CheckRecord | null>;
  updateCheck(checkId: string, patch: { tolerance?: string; name?: string | null }): Promise<void>;
  deleteCheck(checkId: string): Promise<void>;

  addDocument(
    checkId: string,
    meta: { fileName: string; mimeType: SupportedMimeType; pageCount: number | null },
    bytes: Uint8Array,
  ): Promise<DocumentRecord>;
  listDocuments(checkId: string): Promise<DocumentRecord[]>;
  getDocument(checkId: string, documentId: string): Promise<DocumentRecord | null>;
  readDocumentFile(document: DocumentRecord): Promise<Uint8Array>;
  updateDocument(
    documentId: string,
    patch: Partial<
      Pick<
        DocumentRecord,
        "status" | "errorCode" | "documentType" | "documentLanguage" | "extraction" | "extractedAt"
      >
    >,
  ): Promise<void>;
  deleteDocument(checkId: string, documentId: string): Promise<void>;

  setCorrection(documentId: string, path: string, normalized: string | null): Promise<void>;
  removeCorrection(documentId: string, path: string): Promise<void>;
  listCorrections(checkId: string): Promise<CorrectionRecord[]>;

  recordUsage(usage: Omit<UsageRecord, "createdAt">): Promise<void>;
  listUsage(checkId: string): Promise<UsageRecord[]>;

  /** Small JSON cache for AI results that should not be paid for twice. */
  getCached<T>(checkId: string, key: string): Promise<T | null>;
  setCached(checkId: string, key: string, value: unknown): Promise<void>;
  clearCached(checkId: string, keyPrefix: string): Promise<void>;

  /** Deletes checks (rows and files) whose retention period has ended. */
  purgeExpired(now?: Date): Promise<number>;
}
