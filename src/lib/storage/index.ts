import "server-only";
import { getServerEnv } from "@/lib/config/env";
import { SqliteStorage } from "./sqlite-storage";
import type { Storage } from "./types";

let storage: Storage | undefined;
let lastPurge = 0;

/** Shared storage instance; expired checks are purged at most once a minute on access. */
export async function getStorage(): Promise<Storage> {
  if (!storage) {
    const env = getServerEnv();
    storage = new SqliteStorage(env.DATA_DIR, env.RETENTION_HOURS);
  }
  if (Date.now() - lastPurge > 60_000) {
    lastPurge = Date.now();
    await storage.purgeExpired();
  }
  return storage;
}

export type * from "./types";
