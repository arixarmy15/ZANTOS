#!/usr/bin/env node
// Renders the social preview image (Open Graph / Twitter card, 1200×630) for the overview
// page: the wordmark, the headline and a miniature of the evidence ledger, in the brand's
// own type and colours. Output: src/app/[locale]/opengraph-image.png and twitter-image.png.
// Uses Playwright's Chromium; set PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH to use an installed
// browser. The documents shown are the same synthetic example as on the page.
import { copyFileSync, readdirSync, readFileSync } from "node:fs";
import { chromium } from "@playwright/test";

const root = new URL("../", import.meta.url);
const mark = readFileSync(new URL("design/brand/mark.svg", root), "utf8");
// Fonts are embedded as data URLs: a page set from a string cannot load file:// URLs.
const font = (path) =>
  `data:font/woff2;base64,${readFileSync(new URL(`node_modules/${path}`, root)).toString("base64")}`;

// Figures from the product itself, so the image cannot drift from it.
const english = JSON.parse(readFileSync(new URL("messages/en.json", root), "utf8"));
const ruleCount = Object.keys(english.findings.rules).length;
const languageCount = readdirSync(new URL("messages/", root)).filter((f) =>
  f.endsWith(".json"),
).length;

const OUT = "src/app/[locale]/opengraph-image.png";
const TWITTER = "src/app/[locale]/twitter-image.png";

const row = (label, value, tag) => `
  <div class="row${tag ? " on" : ""}">
    <span class="label">${label}</span><span class="value">${value}</span>
    ${tag ? `<span class="bracket"></span><span class="tag">${tag}</span>` : ""}
  </div>`;

const sheet = (title, number, rows) => `
  <div class="sheet">
    <div class="head"><b>${title}</b><span class="mono">${number}</span></div>
    ${rows.join("")}
  </div>`;

const html = `<!doctype html><html><head><style>
  @font-face { font-family: Bodoni; font-weight: 400 900; src: url("${font("@fontsource-variable/bodoni-moda/files/bodoni-moda-latin-opsz-normal.woff2")}"); }
  @font-face { font-family: DMSans; font-weight: 100 1000; src: url("${font("@fontsource-variable/dm-sans/files/dm-sans-latin-opsz-normal.woff2")}"); }
  @font-face { font-family: DMMono; font-weight: 500; src: url("${font("@fontsource/dm-mono/files/dm-mono-latin-500-normal.woff2")}"); }
  * { box-sizing: border-box; margin: 0; }
  body { width: 1200px; height: 630px; font-family: DMSans; color: #23252B; background: #ECE8E0;
    display: grid; grid-template-columns: 560px 1fr; }
  .left { display: grid; align-content: space-between; padding: 56px 52px 50px 64px; background: #23252B; color: #F6F2EA;
    background-image: repeating-linear-gradient(to bottom, transparent 0 31px, rgb(246 242 234 / 0.06) 31px 32px); }
  .brand { display: flex; align-items: center; gap: 14px; font-weight: 600; font-size: 28px; }
  .brand .mark { width: 46px; height: 46px; border-radius: 10px; background: #FFFDF8; display: grid; place-items: center; }
  .brand svg { width: 30px; height: 30px; }
  h1 { font-family: Bodoni; font-weight: 600; font-size: 54px; line-height: 58px; letter-spacing: -0.01em; margin-top: 34px; color: #FFFDF8; }
  p.lead { font-size: 21px; line-height: 31px; color: #BDB6A8; margin-top: 18px; }
  .facts { display: flex; gap: 22px; white-space: nowrap; font-size: 17px; color: #BDB6A8; border-top: 1px solid #464A54; padding-top: 16px; }
  .facts b { color: #F6E3A1; font-weight: 600; }
  .right { align-self: center; display: grid; gap: 14px; padding: 0 44px; }
  .stack { position: relative; }
  .holes { position: absolute; z-index: 1; inset: 0 auto 0 0; width: 28px; display: grid; align-content: space-evenly; justify-items: center;
    border-right: 1px dashed #DDD6C8; }
  .holes i { width: 12px; height: 12px; border-radius: 50%; background: #ECE8E0; box-shadow: inset 0 1px 2px rgba(35,37,43,.35); }
  .docs { position: relative; display: grid; grid-template-columns: 1fr 1fr; background: #FFFDF8; border-radius: 6px; overflow: hidden;
    margin-inline-start: 0; box-shadow: 0 1px 2px rgba(35,37,43,.08), 0 24px 40px -18px rgba(20,16,10,.45); border-left: 28px solid #FFFDF8;
    outline: 1px solid rgba(35,37,43,.1); }
  .sheet + .sheet { border-left: 1px solid #DDD6C8; }
  .sheet:first-child .head { background: #F6E3A1; } .sheet + .sheet .head { background: #BFE3CF; }
  .head { display: grid; gap: 2px; padding: 11px 14px; border-bottom: 1px solid rgba(35,37,43,.1); font-size: 16px; }
  .head span { font-size: 13px; color: rgba(35,37,43,.8); }
  .mono, .value { font-family: DMMono; font-weight: 500; }
  .row { position: relative; display: grid; gap: 2px; padding: 8px 60px 8px 14px; border-bottom: 1px solid #DDD6C8; }
  .row.on { background: #DCE3FB; }
  .label { font-size: 12px; color: #5A5D66; }
  .value { font-size: 17px; }
  .bracket { position: absolute; right: 48px; top: 6px; bottom: 6px; width: 3px; border-radius: 2px; background: #2B45C4; }
  .tag { position: absolute; right: 9px; top: 50%; transform: translateY(-50%); font-family: DMMono; font-weight: 500;
    font-size: 13px; padding: 1px 6px; border: 1.5px solid #2B45C4; background: #E7EBFB; border-radius: 3px; color: #23252B; }
  .finding { display: flex; gap: 10px; align-items: center; background: #FFFDF8; border-radius: 6px; border-left: 4px solid #2B45C4;
    padding: 12px 14px; font-size: 17px; box-shadow: 0 3px 10px -4px rgba(60,48,30,.25); }
  .finding .tag { position: static; transform: none; }
  .err { color: #B42318; background: #FDECEA; border: 1.5px solid #F0B4AE; border-radius: 3px; padding: 1px 8px; font-size: 14px; font-weight: 600; }
</style></head><body>
  <div class="left">
    <div>
      <div class="brand"><span class="mark">${mark.replace(/ width="24" height="24"/, "")}</span>Tickline</div>
      <h1>Catch document mismatches before the goods leave</h1>
      <p class="lead">Invoice, packing list and purchase order, compared field by field — with the evidence on the page.</p>
    </div>
    <div class="facts"><span><b>${ruleCount}</b> checks per run</span><span><b>${languageCount}</b> languages</span><span>Evidence per finding</span></div>
  </div>
  <div class="right">
    <div class="stack"><div class="holes"><i></i><i></i><i></i></div>
    <div class="docs">
      ${sheet("Commercial invoice", "INV-2026-0147", [row("Order ref.", "PO-88213"), row("Packages", "12", "F1"), row("Gross weight", "1,240 kg"), row("Net weight", "1,180 kg")])}
      ${sheet("Packing list", "PL-2026-0147", [row("Order ref.", "PO-88213"), row("Packages", "14", "F1"), row("Gross weight", "1,265 kg"), row("Net weight", "1,180 kg")])}
    </div>
    </div>
    <div class="finding"><span class="tag">F1</span><span class="err">Error</span><span>Number of packages differs: 12 and 14</span></div>
  </div>
</body></html>`;

const browser = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined,
});
try {
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
  await page.setContent(html, { waitUntil: "load" });
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: OUT });
  copyFileSync(OUT, TWITTER);
  console.log(`${OUT}, ${TWITTER} (1200×630)`);
} finally {
  await browser.close();
}
