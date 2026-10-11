import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  DEFAULT_ANTHROPIC_MODEL,
  isAnthropicConfigured,
  parseServerEnv,
  serverEnvSchema,
} from "./env";

function readEnvExample(): Map<string, string> {
  const text = readFileSync(new URL("../../../.env.example", import.meta.url), "utf8");
  const entries = new Map<string, string>();
  for (const line of text.split(/\r?\n/)) {
    const match = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
    if (match) entries.set(match[1]!, match[2]!);
  }
  return entries;
}

describe("parseServerEnv", () => {
  it("applies defaults when nothing is set", () => {
    const env = parseServerEnv({});
    expect(env.ANTHROPIC_MODEL).toBe(DEFAULT_ANTHROPIC_MODEL);
    expect(env.UPLOAD_MAX_FILE_MB).toBe(20);
    expect(env.DATA_DIR).toBe("./data");
    expect(isAnthropicConfigured(env)).toBe(false);
  });

  it("treats empty values copied from .env.example as unset", () => {
    const env = parseServerEnv({
      ANTHROPIC_API_KEY: "",
      ANTHROPIC_MODEL: "  ",
      RETENTION_HOURS: "",
    });
    expect(env.ANTHROPIC_API_KEY).toBeUndefined();
    expect(env.ANTHROPIC_MODEL).toBe(DEFAULT_ANTHROPIC_MODEL);
    expect(env.RETENTION_HOURS).toBe(24);
  });

  it("reads the model name from ANTHROPIC_MODEL", () => {
    expect(parseServerEnv({ ANTHROPIC_MODEL: "claude-haiku-5-5" }).ANTHROPIC_MODEL).toBe(
      "claude-haiku-5-5",
    );
  });

  it("coerces numeric settings", () => {
    const env = parseServerEnv({ UPLOAD_MAX_FILE_MB: "5", UPLOAD_MAX_PAGES: "12" });
    expect(env.UPLOAD_MAX_FILE_MB).toBe(5);
    expect(env.UPLOAD_MAX_PAGES).toBe(12);
  });

  it("never allows the per-file upload limit above 20 MB", () => {
    expect(() => parseServerEnv({ UPLOAD_MAX_FILE_MB: "21" })).toThrow(/UPLOAD_MAX_FILE_MB/);
  });

  it("does not echo secret values in configuration errors", () => {
    const secret = "secret-value-that-must-not-leak";
    let message = "";
    try {
      parseServerEnv({ ANTHROPIC_API_KEY: secret, RETENTION_HOURS: "not-a-number" });
    } catch (error) {
      message = String(error);
    }
    expect(message).toContain("RETENTION_HOURS");
    expect(message).not.toContain(secret);
  });
});

describe(".env.example", () => {
  const example = readEnvExample();

  it("documents exactly the variables the server reads", () => {
    expect([...example.keys()].sort()).toEqual(Object.keys(serverEnvSchema.shape).sort());
  });

  it("ships without an API key value", () => {
    expect(example.get("ANTHROPIC_API_KEY")).toBe("");
  });

  it("never exposes Anthropic settings to the browser bundle", () => {
    expect([...example.keys()].filter((key) => key.startsWith("NEXT_PUBLIC_"))).toEqual([]);
  });
});
