import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

type Tokens = {
  color: Record<string, unknown>;
  contrastPairs: { fg: string; bg: string; min: number; note?: string }[];
};

const tokens = JSON.parse(
  readFileSync(new URL("../design/tokens.json", import.meta.url), "utf8"),
) as Tokens;

function resolveColor(path: string): string {
  let node: unknown = tokens;
  for (const key of path.split(".")) {
    node = (node as Record<string, unknown>)[key];
    if (node === undefined) throw new Error(`Unknown token: ${path}`);
  }
  const value =
    typeof node === "object" && node !== null ? (node as { value: unknown }).value : node;
  if (typeof value !== "string" || !/^#[0-9a-f]{6}$/i.test(value)) {
    throw new Error(`Token ${path} is not an opaque hex colour`);
  }
  return value;
}

// WCAG 2.x relative luminance and contrast ratio.
function luminance(hex: string): number {
  const channels = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const [r, g, b] = channels.map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
}

describe("design tokens", () => {
  it.each(tokens.contrastPairs)("$fg on $bg reaches $min:1", ({ fg, bg, min }) => {
    expect(contrast(resolveColor(fg), resolveColor(bg))).toBeGreaterThanOrEqual(min);
  });

  it("gives every status an icon so colour never carries meaning alone", () => {
    const status = tokens.color.status as Record<string, { icon?: string }>;
    for (const [name, spec] of Object.entries(status)) {
      expect(spec.icon, name).toMatch(/^[a-z-]+$/);
    }
    const icons = Object.values(status).map((spec) => spec.icon);
    expect(new Set(icons).size).toBe(icons.length);
  });
});
