import { describe, expect, it } from "vitest";
import { localeSettings } from "./edition";

const files = ["ar", "de", "en", "es", "fr", "he", "tr"];

describe("edition", () => {
  it("defaults to the Hebrew edition: Hebrew first, always the starting language", () => {
    expect(localeSettings(undefined, files)).toEqual({
      edition: "hebrew",
      locales: ["he", "ar", "de", "en", "es", "fr", "tr"],
      defaultLocale: "he",
      localeDetection: false,
    });
  });

  it("keeps the earlier multilingual edition: English first, language from the browser", () => {
    expect(localeSettings("multilingual", files)).toEqual({
      edition: "multilingual",
      locales: ["en", "ar", "de", "es", "fr", "he", "tr"],
      defaultLocale: "en",
      localeDetection: true,
    });
  });

  it("rejects an unknown edition instead of guessing", () => {
    expect(() => localeSettings("hebrew-only", files)).toThrow(/TICKLINE_EDITION/);
  });

  it("needs the default language's message file", () => {
    expect(() => localeSettings("hebrew", ["en", "tr"])).toThrow(/messages\/he\.json/);
  });
});
