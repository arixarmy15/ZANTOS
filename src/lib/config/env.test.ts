import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  DEFAULT_ANTHROPIC_MODEL,
  isTaskConfigured,
  parseServerEnv,
  resolveRoute,
  serverEnvSchema,
} from "./env";
import { BUILD_ENV } from "@/i18n/edition";

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
    expect(env.AI_PROVIDER).toBe("anthropic");
    expect(isTaskConfigured(env, "extract")).toBe(false);
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

  it("documents exactly the variables the server and the build read", () => {
    expect([...example.keys()].sort()).toEqual(
      [...Object.keys(serverEnvSchema.shape), ...BUILD_ENV].sort(),
    );
  });

  it("ships without an API key value", () => {
    expect(example.get("ANTHROPIC_API_KEY")).toBe("");
  });

  it("never exposes Anthropic settings to the browser bundle", () => {
    expect([...example.keys()].filter((key) => key.startsWith("NEXT_PUBLIC_"))).toEqual([]);
  });
});

describe("AI routing", () => {
  it("sends every task to the default provider and its model", () => {
    const env = parseServerEnv({ ANTHROPIC_API_KEY: "test-anthropic-key" });
    expect(resolveRoute(env, "extract")).toEqual({
      task: "extract",
      provider: "anthropic",
      model: DEFAULT_ANTHROPIC_MODEL,
    });
    expect(isTaskConfigured(env, "email")).toBe(true);
  });

  it("uses an OpenAI-compatible endpoint when it is the default provider", () => {
    const env = parseServerEnv({
      AI_PROVIDER: "openai-compatible",
      OPENAI_COMPATIBLE_BASE_URL: "https://llm.example.org/v1/",
      OPENAI_COMPATIBLE_MODEL: "deepseek-v4.1-flash",
    });
    expect(env.OPENAI_COMPATIBLE_BASE_URL).toBe("https://llm.example.org/v1");
    expect(resolveRoute(env, "compare")).toMatchObject({
      provider: "openai-compatible",
      model: "deepseek-v4.1-flash",
    });
    // A key is optional: local servers often run without one.
    expect(isTaskConfigured(env, "compare")).toBe(true);
  });

  it("routes single tasks to another provider or model", () => {
    const env = parseServerEnv({
      ANTHROPIC_API_KEY: "test-anthropic-key",
      OPENAI_COMPATIBLE_BASE_URL: "http://localhost:11434/v1",
      AI_COMPARE_MODEL: "openai-compatible:qwen3:8b",
      AI_EXPLAIN_MODEL: "claude-opus-5-5",
    });
    expect(resolveRoute(env, "extract")).toMatchObject({
      provider: "anthropic",
      model: DEFAULT_ANTHROPIC_MODEL,
    });
    expect(resolveRoute(env, "compare")).toMatchObject({
      provider: "openai-compatible",
      model: "qwen3:8b",
    });
    expect(resolveRoute(env, "explain")).toMatchObject({
      provider: "anthropic",
      model: "claude-opus-5-5",
    });
  });

  it("is not configured without a model or without the provider's endpoint", () => {
    const noModel = parseServerEnv({
      AI_PROVIDER: "openai-compatible",
      OPENAI_COMPATIBLE_BASE_URL: "https://llm.example.org/v1",
    });
    expect(resolveRoute(noModel, "extract").model).toBeNull();
    expect(isTaskConfigured(noModel, "extract")).toBe(false);
    const noEndpoint = parseServerEnv({ AI_EMAIL_MODEL: "openai-compatible:some-model" });
    expect(isTaskConfigured(noEndpoint, "email")).toBe(false);
  });

  it("rejects malformed provider settings without echoing them", () => {
    expect(() => parseServerEnv({ AI_PROVIDER: "gemini" })).toThrow(/AI_PROVIDER/);
    expect(() => parseServerEnv({ OPENAI_COMPATIBLE_BASE_URL: "ftp://example.org" })).toThrow(
      /OPENAI_COMPATIBLE_BASE_URL/,
    );
    expect(() => parseServerEnv({ AI_EXTRACT_MODEL: "has space" })).toThrow(/AI_EXTRACT_MODEL/);
  });
});
