import { readdirSync, readFileSync } from "node:fs";
import { parse, TYPE, type MessageFormatElement } from "@formatjs/icu-messageformat-parser";
import { describe, expect, it } from "vitest";

const messagesDir = new URL("../messages/", import.meta.url);
const locales = readdirSync(messagesDir)
  .filter((file) => file.endsWith(".json"))
  .map((file) => file.slice(0, -".json".length));

type Messages = { [key: string]: string | Messages };

function load(locale: string): Messages {
  return JSON.parse(readFileSync(new URL(`${locale}.json`, messagesDir), "utf8")) as Messages;
}

function flatten(messages: Messages, prefix = ""): Map<string, string> {
  const result = new Map<string, string>();
  for (const [key, value] of Object.entries(messages)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === "string") result.set(path, value);
    else for (const [k, v] of flatten(value, path)) result.set(k, v);
  }
  return result;
}

function argumentNames(elements: MessageFormatElement[], names = new Set<string>()): Set<string> {
  for (const element of elements) {
    if (element.type === TYPE.literal || element.type === TYPE.pound) continue;
    names.add(element.value);
    if (element.type === TYPE.plural || element.type === TYPE.select) {
      for (const option of Object.values(element.options)) argumentNames(option.value, names);
    }
    if (element.type === TYPE.tag) argumentNames(element.children, names);
  }
  return names;
}

const english = flatten(load("en"));

describe("interface translations", () => {
  it("include English and at least the six launch languages", () => {
    expect(locales).toEqual(expect.arrayContaining(["en", "tr", "de", "es", "fr", "ar"]));
  });

  describe.each(locales)("%s", (locale) => {
    const messages = flatten(load(locale));

    it("has exactly the same keys as English", () => {
      const missing = [...english.keys()].filter((key) => !messages.has(key));
      const extra = [...messages.keys()].filter((key) => !english.has(key));
      expect({ missing, extra }).toEqual({ missing: [], extra: [] });
    });

    it("declares its own name and text direction", () => {
      expect(messages.get("meta.name")).toBeTruthy();
      expect(["ltr", "rtl"]).toContain(messages.get("meta.direction"));
    });

    it("uses valid ICU syntax with the same arguments as English", () => {
      for (const [key, value] of messages) {
        const source = english.get(key);
        if (source === undefined) continue;
        let ast: MessageFormatElement[];
        try {
          ast = parse(value);
        } catch (error) {
          throw new Error(`${locale}:${key} is not valid ICU: ${String(error)}`);
        }
        expect([...argumentNames(ast)].sort(), `${locale}:${key}`).toEqual(
          [...argumentNames(parse(source))].sort(),
        );
      }
    });

    it("has no empty strings", () => {
      for (const [key, value] of messages) expect(value.trim(), `${locale}:${key}`).not.toBe("");
    });
  });
});
