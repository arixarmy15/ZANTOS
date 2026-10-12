import { beforeEach, describe, expect, it, vi } from "vitest";
import { parseServerEnv, type ServerEnv } from "@/lib/config/env";

let env: ServerEnv;
vi.mock("@/lib/config/env", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/config/env")>();
  return { ...actual, getServerEnv: () => env };
});
vi.mock("@/i18n/routing", () => ({
  routing: { locales: ["en", "tr", "ar"], defaultLocale: "en" },
}));

const { default: robots } = await import("./robots");
const { default: sitemap } = await import("./sitemap");

describe("robots.txt and sitemap", () => {
  beforeEach(() => {
    env = parseServerEnv({});
  });

  it("keeps checks and the API out of search engines", () => {
    expect(robots()).toEqual({
      rules: { userAgent: "*", allow: "/", disallow: ["/api/", "/*/checks"] },
    });
  });

  it("lists nothing without a public address, rather than the wrong host", () => {
    expect(sitemap()).toEqual([]);
  });

  it("lists the overview page in every language once SITE_URL is set", () => {
    env = parseServerEnv({ SITE_URL: "https://tradecheck.example.com/" });
    expect(robots().sitemap).toBe("https://tradecheck.example.com/sitemap.xml");
    const entries = sitemap();
    expect(entries.map((entry) => entry.url)).toEqual([
      "https://tradecheck.example.com/en",
      "https://tradecheck.example.com/tr",
      "https://tradecheck.example.com/ar",
    ]);
    expect(entries[0]!.alternates?.languages).toMatchObject({
      ar: "https://tradecheck.example.com/ar",
    });
  });

  it("rejects a SITE_URL that is not http(s)", () => {
    expect(() => parseServerEnv({ SITE_URL: "ftp://example.com" })).toThrow(/SITE_URL/);
  });
});
