#!/usr/bin/env node
// Renders the social preview image (Open Graph / Twitter card, 1200×630) for the overview
// page in every interface language: the wordmark, the headline and a miniature of the
// evidence ledger, in the language's own type and direction. Output: public/social/<locale>.png,
// served by src/app/[locale]/opengraph-image.tsx and twitter-image.tsx.
// Uses Playwright's Chromium; set PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH to use an installed
// browser. The documents shown are the same synthetic example as on the page, and every
// label and sentence comes from the language's message file.
import { mkdirSync, readdirSync, readFileSync } from "node:fs";
import { chromium } from "@playwright/test";
import { createTranslator } from "next-intl";

const root = new URL("../", import.meta.url);
const mark = readFileSync(new URL("design/brand/mark.svg", root), "utf8");

// Fontsource style sheets with their font files inlined as data URLs (a page set from a
// string cannot load file:// URLs). Keeping the sheets keeps their unicode ranges, so
// Turkish, Hebrew and Arabic letters each come from the right file.
const fontCss = (sheet) => {
  const base = new URL(`node_modules/${sheet}`, root);
  return readFileSync(base, "utf8").replace(/url\(\.\/files\/([^)]+)\)/g, (_, file) => {
    const data = readFileSync(new URL(`files/${file}`, base)).toString("base64");
    return `url(data:font/woff2;base64,${data})`;
  });
};
const fonts = [
  "@fontsource-variable/bodoni-moda/opsz.css",
  "@fontsource-variable/dm-sans/opsz.css",
  "@fontsource/dm-mono/500.css",
  "@fontsource-variable/frank-ruhl-libre/wght.css",
  "@fontsource/ibm-plex-sans-hebrew/hebrew-400.css",
  "@fontsource/ibm-plex-sans-hebrew/hebrew-600.css",
  "@fontsource/ibm-plex-sans-arabic/400.css",
  "@fontsource/ibm-plex-sans-arabic/600.css",
]
  .map(fontCss)
  .join("\n");

// Per script: the headline face and the text face, as on the site (globals.css).
const faces = {
  he: {
    display: '"Frank Ruhl Libre Variable"',
    text: '"IBM Plex Sans Hebrew", "DM Sans Variable"',
  },
  ar: { display: '"IBM Plex Sans Arabic"', text: '"IBM Plex Sans Arabic", "DM Sans Variable"' },
  default: { display: '"Bodoni Moda Variable"', text: '"DM Sans Variable"' },
};

const locales = readdirSync(new URL("messages/", root))
  .filter((file) => file.endsWith(".json"))
  .map((file) => file.slice(0, -".json".length));
const ruleCount = Object.keys(
  JSON.parse(readFileSync(new URL("messages/en.json", root), "utf8")).findings.rules,
).length;

const escape = (text) =>
  String(text).replace(
    /[&<>"]/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c],
  );

function page(locale) {
  const messages = JSON.parse(readFileSync(new URL(`messages/${locale}.json`, root), "utf8"));
  const t = createTranslator({ locale, messages });
  const dir = messages.meta.direction;
  const face = faces[locale] ?? faces.default;
  // Arabic documents keep Latin digits, as on the site (src/lib/format.ts).
  const number = new Intl.NumberFormat(locale === "ar" ? "ar-u-nu-latn" : locale);
  const kg = (value) => `${number.format(value)} kg`;
  const ltr = (value) => `<bdi dir="ltr">${escape(value)}</bdi>`;

  const row = (label, value, tag) => `
    <div class="row${tag ? " on" : ""}">
      <span class="label">${escape(label)}</span><span class="value">${ltr(value)}</span>
      ${tag ? `<span class="bracket"></span><span class="tag">${tag}</span>` : ""}
    </div>`;
  const sheet = (title, docNumber, rows) => `
    <div class="sheet">
      <div class="head"><b>${escape(title)}</b><span class="mono">${ltr(docNumber)}</span></div>
      ${rows.join("")}
    </div>`;
  const f = (key) => t(`landing.demo.fields.${key}`);
  const finding = t("findings.messages.xdoc-packages", {
    valueA: "⁨" + number.format(12) + "⁩",
    docA: "⁨commercial-invoice.pdf⁩",
    valueB: "⁨" + number.format(14) + "⁩",
    docB: "⁨packing-list.pdf⁩",
  });

  return `<!doctype html><html lang="${locale}" dir="${dir}"><head><meta charset="utf-8"><style>
  ${fonts}
  * { box-sizing: border-box; margin: 0; }
  body { width: 1200px; height: 630px; overflow: hidden; font-family: ${face.text}, sans-serif; color: #23252B;
    background: #ECE8E0; display: grid; grid-template-columns: 560px 1fr; }
  .left { display: grid; align-content: space-between; padding-block: 56px 50px; padding-inline: 64px 52px;
    background: #23252B; color: #F6F2EA; overflow: hidden;
    background-image: repeating-linear-gradient(to bottom, transparent 0 31px, rgb(246 242 234 / 0.06) 31px 32px); }
  .brand { display: flex; align-items: center; gap: 14px; font-family: "DM Sans Variable"; font-weight: 600; font-size: 28px; }
  .brand .mark { width: 46px; height: 46px; border-radius: 10px; background: #FFFDF8; display: grid; place-items: center; }
  .brand svg { width: 30px; height: 30px; }
  h1 { font-family: ${face.display}, serif; font-weight: 600; font-size: 54px; line-height: 1.08;
    letter-spacing: ${dir === "rtl" ? "0" : "-0.01em"}; margin-top: 34px; color: #FFFDF8; text-wrap: balance; }
  p.lead { font-size: 21px; line-height: 31px; color: #BDB6A8; margin-top: 18px; text-wrap: pretty; }
  .facts { display: flex; flex-wrap: wrap; gap: 6px 26px; font-size: 18px; color: #BDB6A8;
    border-top: 1px solid #464A54; padding-top: 16px; margin-top: 24px; }
  .facts span { white-space: nowrap; }
  .facts b { color: #F6E3A1; font-weight: 600; }
  .right { align-self: center; display: grid; gap: 14px; padding-inline: 44px; }
  .stack { position: relative; }
  .holes { position: absolute; z-index: 1; inset-block: 0; inset-inline-start: 0; width: 28px; display: grid;
    align-content: space-evenly; justify-items: center; border-inline-end: 1px dashed #DDD6C8; }
  .holes i { width: 12px; height: 12px; border-radius: 50%; background: #ECE8E0; box-shadow: inset 0 1px 2px rgba(35,37,43,.35); }
  .docs { position: relative; display: grid; grid-template-columns: 1fr 1fr; background: #FFFDF8; border-radius: 6px;
    overflow: hidden; box-shadow: 0 1px 2px rgba(35,37,43,.08), 0 24px 40px -18px rgba(20,16,10,.45);
    border-inline-start: 28px solid #FFFDF8; outline: 1px solid rgba(35,37,43,.1); }
  .sheet + .sheet { border-inline-start: 1px solid #DDD6C8; }
  .sheet:first-child .head { background: #F6E3A1; } .sheet + .sheet .head { background: #BFE3CF; }
  .head { display: grid; gap: 2px; padding: 11px 14px; border-bottom: 1px solid rgba(35,37,43,.1); font-size: 16px; }
  .head span { font-size: 13px; color: rgba(35,37,43,.8); }
  .mono, .value { font-family: "DM Mono", monospace; font-weight: 500; }
  .row { position: relative; display: grid; gap: 2px; padding-block: 8px; padding-inline: 14px 60px; border-bottom: 1px solid #DDD6C8; }
  .row.on { background: #DCE3FB; }
  .label { font-size: 12px; color: #5A5D66; }
  .value { font-size: 17px; }
  .bracket { position: absolute; inset-inline-end: 48px; top: 6px; bottom: 6px; width: 3px; border-radius: 2px; background: #2B45C4; }
  .tag { position: absolute; inset-inline-end: 9px; top: 50%; transform: translateY(-50%); font-family: "DM Mono", monospace;
    font-weight: 500; font-size: 13px; padding: 1px 6px; border: 1.5px solid #2B45C4; background: #E7EBFB;
    border-radius: 3px; color: #23252B; }
  .finding { display: flex; gap: 10px; align-items: center; background: #FFFDF8; border-radius: 6px;
    border-inline-start: 4px solid #2B45C4; padding: 12px 14px; font-size: 16px; line-height: 22px;
    box-shadow: 0 3px 10px -4px rgba(60,48,30,.25); }
  .finding .tag { position: static; transform: none; flex: none; }
  .err { flex: none; color: #B42318; background: #FDECEA; border: 1.5px solid #F0B4AE; border-radius: 3px;
    padding: 1px 8px; font-size: 14px; font-weight: 600; }
</style></head><body>
  <div class="left">
    <div>
      <div class="brand" dir="ltr"><span class="mark">${mark.replace(/ width="24" height="24"/, "")}</span>Tickline</div>
      <h1>${escape(t("landing.hero.title"))}</h1>
      <p class="lead">${escape(t("landing.cta.body"))}</p>
    </div>
    <div class="facts">
      <span>${escape(t("landing.hero.rules", { count: "\u0000" })).replace("\u0000", `<b>${number.format(ruleCount)}</b>`)}</span>
      <span>${escape(t("landing.hero.languages", { count: "\u0000" })).replace("\u0000", `<b>${number.format(locales.length)}</b>`)}</span>
    </div>
  </div>
  <div class="right">
    <div class="stack"><div class="holes"><i></i><i></i><i></i></div>
      <div class="docs">
        ${sheet(t("landing.demo.invoice"), "INV-2026-0147", [row(f("order"), "PO-88213"), row(f("packages"), number.format(12), "F1"), row(f("gross"), kg(1240)), row(f("net"), kg(1180))])}
        ${sheet(t("landing.demo.packingList"), "PL-2026-0147", [row(f("order"), "PO-88213"), row(f("packages"), number.format(14), "F1"), row(f("gross"), kg(1265)), row(f("net"), kg(1180))])}
      </div>
    </div>
    <div class="finding"><span class="tag">F1</span><span class="err">${escape(t("status.error"))}</span><span>${escape(finding)}</span></div>
  </div>
</body></html>`;
}

const out = new URL("public/social/", root);
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined,
});
try {
  const tab = await browser.newPage({ viewport: { width: 1200, height: 630 } });
  for (const locale of locales) {
    await tab.setContent(page(locale), { waitUntil: "load" });
    await tab.evaluate(() => document.fonts.ready);
    // A long headline steps down in size until the panel fits and no word overflows.
    await tab.evaluate(() => {
      const left = document.querySelector(".left");
      const h1 = document.querySelector("h1");
      let size = 54;
      while (
        size > 34 &&
        (left.scrollHeight > left.clientHeight || h1.scrollWidth > h1.clientWidth)
      ) {
        size -= 2;
        h1.style.fontSize = `${size}px`;
      }
    });
    const file = new URL(`${locale}.png`, out);
    await tab.screenshot({ path: file.pathname });
    console.log(`public/social/${locale}.png (1200×630)`);
  }
} finally {
  await browser.close();
}
