import Anthropic from "@anthropic-ai/sdk";
import { describe, expect, it } from "vitest";
import { AiError, fallbackOptions, toAiError, usageFrom } from "./client";

const headers = new Headers();

describe("toAiError", () => {
  it.each([
    [new Anthropic.AuthenticationError(401, {}, "x", headers), "auth"],
    [new Anthropic.PermissionDeniedError(403, {}, "x", headers), "auth"],
    [new Anthropic.RateLimitError(429, {}, "x", headers), "rate_limited"],
    [new Anthropic.APIConnectionError({ message: "x" }), "unreachable"],
    [new Anthropic.APIError(413, {}, "x", headers), "document_too_large"],
    [new Anthropic.InternalServerError(500, {}, "x", headers), "api_error"],
    [new SyntaxError("not json"), "invalid_output"],
  ])("maps %o to %s by class and status", (error, code) => {
    expect(toAiError(error).code).toBe(code);
  });

  it("passes AiErrors through unchanged", () => {
    const error = new AiError("refused");
    expect(toAiError(error)).toBe(error);
  });
});

describe("fallbackOptions", () => {
  it("enables server-side refusal fallback only for models that support it", () => {
    expect(fallbackOptions("claude-sonnet-5-5")).toEqual({
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
    });
    expect(fallbackOptions("claude-haiku-5-5")).toEqual({});
  });
});

describe("usageFrom", () => {
  it("reads token counts, treating missing cache counts as zero", () => {
    expect(
      usageFrom({
        model: "m",
        usage: { input_tokens: 10, output_tokens: 5, cache_read_input_tokens: null },
      }),
    ).toEqual({
      model: "m",
      inputTokens: 10,
      outputTokens: 5,
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
    });
  });
});
