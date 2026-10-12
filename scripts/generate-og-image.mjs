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
  `data:font/woff2;base64,${readFileSync(new URL(`node_modules/@fontsource/${path}`, root)).toString("base64")}`;

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
  @font-face { font-family: Plex; font-weight: 400; src: url("${font("ibm-plex-sans/files/ibm-plex-sans-latin-400-normal.woff2")}"); }
  @font-face { font-family: Plex; font-weight: 600; src: url("${font("ibm-plex-sans/files/ibm-plex-sans-latin-600-normal.woff2")}"); }
  @font-face { font-family: PlexMono; font-weight: 500; src: url("${font("ibm-plex-mono/files/ibm-plex-mono-latin-500-normal.woff2")}"); }
  * { box-sizing: border-box; margin: 0; }
  body { width: 1200px; height: 630px; font-family: Plex; color: #17212B; background: #F2F4F3;
    display: grid; grid-template-columns: 560px 1fr; gap: 48px; padding: 64px 64px 56px; }
  .brand { display: flex; align-items: center; gap: 14px; font-weight: 600; font-size: 30px; }
  .brand svg { width: 44px; height: 44px; }
  .left { display: grid; align-content: space-between; }
  h1 { font-weight: 600; font-size: 54px; line-height: 62px; letter-spacing: 0; margin-top: 44px; }
  p.lead { font-size: 24px; line-height: 34px; color: #55616C; margin-top: 20px; }
  .facts { display: flex; gap: 22px; font-size: 19px; color: #55616C; border-top: 2px solid #D5DCE0; padding-top: 18px; }
  .facts b { color: #0E5E6D; font-weight: 600; }
  .right { align-self: center; display: grid; gap: 14px; }
  .docs { display: grid; grid-template-columns: 1fr 1fr; background: #fff; border: 2px solid #D5DCE0; }
  .sheet + .sheet { border-left: 2px solid #D5DCE0; }
  .head { display: grid; gap: 2px; padding: 12px 16px; border-bottom: 2px solid #D5DCE0; font-size: 17px; }
  .head span { font-size: 14px; color: #55616C; }
  .mono, .value { font-family: PlexMono; font-weight: 500; }
  .row { position: relative; display: grid; gap: 2px; padding: 9px 66px 9px 16px; border-bottom: 1px solid #D5DCE0; }
  .row.on { background: #DDE8EB; }
  .label { font-size: 13px; color: #55616C; }
  .value { font-size: 18px; }
  .bracket { position: absolute; right: 52px; top: 6px; bottom: 6px; width: 3px; background: #0E5E6D; }
  .tag { position: absolute; right: 10px; top: 50%; transform: translateY(-50%); font-family: PlexMono; font-weight: 500;
    font-size: 14px; padding: 1px 6px; border: 1.5px solid #0E5E6D; background: #E2EEF0; border-radius: 2px; }
  .finding { display: flex; gap: 12px; align-items: center; background: #fff; border: 2px solid #D5DCE0;
    border-left: 5px solid #0E5E6D; padding: 14px 16px; font-size: 18px; }
  .finding .tag { position: static; transform: none; }
  .err { color: #B42318; background: #FDECEA; border: 1.5px solid #F0B4AE; border-radius: 2px; padding: 1px 8px; font-size: 15px; font-weight: 600; }
</style></head><body>
  <div class="left">
    <div>
      <div class="brand">${mark.replace(/ width="24" height="24"/, "")}TradeCheck</div>
      <h1>Catch document mismatches before the goods leave</h1>
      <p class="lead">Invoice, packing list and purchase order, compared field by field — with the evidence on the page.</p>
    </div>
    <div class="facts"><span><b>${ruleCount}</b> checks per run</span><span><b>${languageCount}</b> languages</span><span>Evidence for every finding</span></div>
  </div>
  <div class="right">
    <div class="docs">
      ${sheet("Commercial invoice", "INV-2026-0147", [row("Order ref.", "PO-88213"), row("Packages", "12", "F1"), row("Gross weight", "1,240 kg"), row("Net weight", "1,180 kg")])}
      ${sheet("Packing list", "PL-2026-0147", [row("Order ref.", "PO-88213"), row("Packages", "14", "F1"), row("Gross weight", "1,265 kg"), row("Net weight", "1,180 kg")])}
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
