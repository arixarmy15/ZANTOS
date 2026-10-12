import { describe, expect, it } from "vitest";
import { locateEvidence, locateText, type TextRun } from "./locate";

const run = (text: string, x: number, y: number, width = text.length * 6): TextRun => ({
  text,
  x,
  y,
  width,
  height: 12,
});

const page = [
  run("Invoice no.", 50, 40),
  run("INV-2026-17", 130, 40),
  run("Total amount:", 50, 300),
  run("EUR 12,500.00", 140, 300),
  run("Packages: 14", 50, 320),
];

describe("locateText", () => {
  it("finds an excerpt across runs on one line and merges them into one box", () => {
    expect(locateText(page, "Total amount: EUR 12,500.00")).toEqual([
      { x: 50, y: 300, width: 168, height: 12 },
    ]);
  });

  it("ignores case, line breaks and spacing differences", () => {
    expect(locateText(page, "invoice  no.\nINV-2026-17")).toEqual([
      { x: 50, y: 40, width: 146, height: 12 },
    ]);
  });

  it("returns one box per line for multi-line excerpts", () => {
    expect(locateText(page, "12,500.00 Packages: 14")).toHaveLength(2);
  });

  it("returns null when the text is not on the page", () => {
    expect(locateText(page, "USD 99")).toBeNull();
    expect(locateText(page, " ")).toBeNull();
    expect(locateText([], "Invoice")).toBeNull();
  });

  it("matches full-width and composed characters", () => {
    expect(locateText([run("ＩＮＶ－１", 0, 0)], "INV-1")).not.toBeNull();
    expect(locateText([run("Şirketi", 0, 0)], "ŞİRKETİ".toLocaleLowerCase("tr"))).not.toBeNull();
  });
});

describe("locateEvidence", () => {
  it("falls back to the printed value when the excerpt is not found", () => {
    expect(locateEvidence(page, { text: "Total: EUR 12.500,00", printed: "Packages: 14" })).toEqual(
      [{ x: 50, y: 320, width: 72, height: 12 }],
    );
    expect(locateEvidence(page, { text: null, printed: null })).toBeNull();
  });
});
