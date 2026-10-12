import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * The Hebrew interface text follows the humanizer skill (github.com/blader/humanizer, based on
 * Wikipedia's "Signs of AI writing"): plain statements, no dashes as connectors, no staged
 * contrasts or sales words, and one gender-neutral way of addressing the reader. These are the
 * checks a machine can make; DESIGN.md §19 has the rest.
 */
type Messages = { [key: string]: string | Messages };

function flatten(messages: Messages, prefix = ""): [string, string][] {
  return Object.entries(messages).flatMap(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return typeof value === "string" ? [[path, value] as [string, string]] : flatten(value, path);
  });
}

const hebrew = flatten(
  JSON.parse(readFileSync(new URL("../messages/he.json", import.meta.url), "utf8")) as Messages,
);

describe("Hebrew interface text", () => {
  it("uses no dash as a connector (a numeric range such as 65–80% is fine)", () => {
    const dashed = hebrew.filter(([, text]) => /—|--|\s–\s|[^\d]–|–[^\d]/.test(text));
    expect(dashed).toEqual([]);
  });

  it("has no exclamation marks, emoji or decorative arrows", () => {
    const loud = hebrew.filter(([, text]) => /[!→✓]|\p{Emoji_Presentation}/u.test(text));
    expect(loud).toEqual([]);
  });

  it("avoids staged contrasts, stock openers and sales words", () => {
    const tells = [
      "לא רק",
      "אלא גם",
      "חשוב לציין",
      "חשוב לדעת",
      "בואו",
      "חדשני",
      "מהפכני",
      "עוצמתי",
      "בקלות",
      "מושלם",
      "ללא מאמץ",
      "בלחיצת כפתור",
    ];
    const found = hebrew.filter(([, text]) => tells.some((tell) => text.includes(tell)));
    expect(found).toEqual([]);
  });

  it("addresses the reader in the plural, never in the singular masculine or feminine", () => {
    // Singular imperatives that would pick a gender; the text uses plural forms (הוסיפו, בדקו).
    const singular =
      /(^|\s)(הוסף|הוסיפי|בדוק|בדקי|לחץ|לחצי|העלה|העלי|בחר|בחרי|נסה|נסי|שים|שימי)(\s|$|[.,:])/;
    const gendered = hebrew.filter(([, text]) => singular.test(text));
    expect(gendered).toEqual([]);
  });

  it("writes abbreviations with geresh and gershayim, not ASCII quotes", () => {
    const ascii = hebrew.filter(([, text]) => /[א-ת]"[א-ת]|[א-ת]'/.test(text));
    expect(ascii).toEqual([]);
  });
});
