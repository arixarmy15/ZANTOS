import { describe, expect, it } from "vitest";
import {
  dataLocale,
  formatDecimal,
  formatFileSize,
  formatIsoDate,
  formatNormalized,
  formatTimestamp,
  languageName,
} from "./format";

describe("format helpers (Intl only)", () => {
  it("uses Latin digits for data in Arabic", () => {
    expect(dataLocale("ar")).toBe("ar-u-nu-latn");
    expect(dataLocale("de")).toBe("de");
    expect(formatDecimal("1250.5", "ar")).toMatch(/1[^\d]?250[^\d]5/);
  });

  it("keeps the decimals that were printed", () => {
    expect(formatDecimal("1250.50", "en")).toBe("1,250.50");
    expect(formatDecimal("1250.50", "de")).toBe("1.250,50");
    expect(formatDecimal("7", "fr")).toBe("7");
  });

  it("formats ISO dates and timestamps in every launch language", () => {
    for (const locale of ["en", "tr", "de", "es", "fr", "ar"]) {
      expect(formatIsoDate("2026-03-14", locale)).toMatch(/2026/);
      expect(formatTimestamp("2026-03-14T09:30:00Z", locale)).toMatch(/2026/);
    }
    expect(formatIsoDate("not-a-date", "en")).toBe("not-a-date");
  });

  it("names currencies, countries and languages", () => {
    expect(formatNormalized("currency", "EUR", "en")).toBe("EUR · Euro");
    expect(formatNormalized("country", "DE", "en")).toBe("DE · Germany");
    expect(formatNormalized("hsCode", "850440", "en")).toBe("850440");
    expect(languageName("tr", "en")).toBe("Turkish");
  });

  it("formats file sizes with units", () => {
    expect(formatFileSize(2 * 1024 * 1024, "en")).toBe("2 MB");
    expect(formatFileSize(512, "en")).toBe("0.5 kB");
  });
});
