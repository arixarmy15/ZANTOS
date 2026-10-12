/** A run of text on a rendered page with its box in page (viewport) pixels. */
export type TextRun = { text: string; x: number; y: number; width: number; height: number };
export type Box = { x: number; y: number; width: number; height: number };

/** Case-, width- and whitespace-insensitive form used for matching. */
function fold(value: string): string {
  return value.normalize("NFKC").toLocaleLowerCase("und");
}

/**
 * Finds `query` in the page's text runs and returns one box per line it covers, or null.
 * Whitespace differences (line breaks, double spaces) are ignored, because extraction
 * excerpts and PDF text layers break lines differently. Runs are matched whole, so the box
 * can be slightly wider than the excerpt; it never points at the wrong place.
 */
export function locateText(runs: TextRun[], query: string): Box[] | null {
  const needle = fold(query).replace(/\s+/g, "");
  if (needle.length < 2) return null;

  // Concatenate the page without whitespace, remembering which run each character came from.
  let haystack = "";
  const owner: number[] = [];
  runs.forEach((run, index) => {
    for (const character of fold(run.text).replace(/\s+/g, "")) {
      haystack += character;
      for (let i = 0; i < character.length; i++) owner.push(index);
    }
  });

  const start = haystack.indexOf(needle);
  if (start === -1) return null;
  const covered = [...new Set(owner.slice(start, start + needle.length))].map(
    (index) => runs[index]!,
  );

  // Merge runs on the same line into one box.
  const lines: Box[] = [];
  for (const run of covered) {
    const line = lines.find(
      (box) => Math.abs(box.y - run.y) < Math.max(box.height, run.height) / 2,
    );
    if (!line) {
      lines.push({ x: run.x, y: run.y, width: run.width, height: run.height });
      continue;
    }
    const right = Math.max(line.x + line.width, run.x + run.width);
    const bottom = Math.max(line.y + line.height, run.y + run.height);
    line.x = Math.min(line.x, run.x);
    line.y = Math.min(line.y, run.y);
    line.width = right - line.x;
    line.height = bottom - line.y;
  }
  return lines;
}

/** Tries the verbatim excerpt first, then the printed value alone. */
export function locateEvidence(
  runs: TextRun[],
  evidence: { text: string | null; printed: string | null },
): Box[] | null {
  return (
    (evidence.text ? locateText(runs, evidence.text) : null) ??
    (evidence.printed ? locateText(runs, evidence.printed) : null)
  );
}
