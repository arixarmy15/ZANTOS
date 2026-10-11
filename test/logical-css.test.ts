import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// DESIGN.md §11: layouts must mirror for right-to-left languages, so only logical
// properties and utilities are allowed (ms/me/ps/pe/start/end, inline/block).
const PHYSICAL_UTILITIES =
  /(?<![\w-])-?(?:ml|mr|pl|pr|left|right|border-l|border-r|rounded-l|rounded-r|rounded-tl|rounded-tr|rounded-bl|rounded-br|scroll-ml|scroll-mr|text-left|text-right|float-left|float-right)(?:-[\w./[\]%()-]+)?(?![\w-])/;
const PHYSICAL_CSS =
  /\b(?:margin|padding|border)-(?:left|right)\b|(?<![\w-])(?:left|right)\s*:|text-align\s*:\s*(?:left|right)/;

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.(tsx?|css)$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : [];
  });
}

describe("logical CSS only", () => {
  const files = sourceFiles(join(process.cwd(), "src"));

  it("finds source files to check", () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it.each(files)("%s uses no physical left/right styling", (file) => {
    const offending = readFileSync(file, "utf8")
      .split("\n")
      .map((line, index) => ({ line: line.trim(), number: index + 1 }))
      .filter(({ line }) => {
        if (file.endsWith(".css")) return PHYSICAL_CSS.test(line);
        const classNames = [
          ...line.matchAll(/className=(?:"([^"]*)"|\{`([^`]*)`\})|cn\(([^)]*)\)|"([^"]*)"/g),
        ]
          .map((match) => match.slice(1).find(Boolean) ?? "")
          .join(" ");
        return classNames.split(/\s+/).some((token) => PHYSICAL_UTILITIES.test(token));
      });
    expect(offending).toEqual([]);
  });
});
