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
  @font-face { font-family: Archivo; font-weight: 100 900; font-stretch: 62% 125%; src: url("${font("@fontsource-variable/archivo/files/archivo-latin-wdth-normal.woff2")}"); }
  @font-face { font-family: GeistMono; font-weight: 500; src: url("${font("@fontsource/geist-mono/files/geist-mono-latin-500-normal.woff2")}"); }
  * { box-sizing: border-box; margin: 0; }
  body { width: 1200px; height: 630px; font-family: Archivo; color: #EAF1F8; background: #0E2A47;
    display: grid; grid-template-columns: 540px 1fr; gap: 56px; padding: 60px 64px 54px; position: relative; overflow: hidden;
    background-image:
      radial-gradient(45% 60% at 78% 50%, rgb(94 234 212 / 0.22), transparent 70%),
      linear-gradient(rgb(42 74 112 / 0.5) 1px, transparent 1px),
      linear-gradient(90deg, rgb(42 74 112 / 0.5) 1px, transparent 1px);
    background-size: 100% 100%, 56px 56px, 56px 56px; }
  .brand { display: flex; align-items: center; gap: 14px; font-weight: 600; font-size: 30px; font-stretch: 112%; color: #fff; }
  .brand .mark { width: 48px; height: 48px; border-radius: 12px; background: #fff; display: grid; place-items: center; }
  .brand svg { width: 32px; height: 32px; }
  .left { display: grid; align-content: space-between; }
  h1 { font-weight: 600; font-size: 54px; line-height: 58px; font-stretch: 112%; letter-spacing: -0.015em; margin-top: 40px; color: #fff; }
  p.lead { font-size: 23px; line-height: 33px; color: #A9BBD0; margin-top: 20px; }
  .facts { display: flex; gap: 22px; font-size: 19px; color: #A9BBD0; border-top: 1px solid #2A4A70; padding-top: 18px; }
  .facts b { color: #5EEAD4; font-weight: 600; }
  .right { align-self: center; display: grid; gap: 16px; position: relative; }
  .stack { position: relative; }
  .copy { position: absolute; inset: 0; border-radius: 20px; background: rgb(255 255 255 / 0.12); box-shadow: inset 0 0 0 1px rgb(234 241 248 / 0.18); }
  .copy.a { transform: translateY(12px) rotate(2deg); } .copy.b { transform: translateY(6px) rotate(-1.25deg); }
  .docs { position: relative; display: grid; grid-template-columns: 1fr 1fr; background: #fff; color: #0E2A47; border-radius: 20px; overflow: hidden;
    box-shadow: 0 30px 60px -20px rgb(0 0 0 / 0.5); }
  .sheet + .sheet { border-left: 1px solid #D9E1EA; }
  .head { display: grid; gap: 2px; padding: 12px 16px; border-bottom: 1px solid #D9E1EA; font-size: 17px; }
  .head span { font-size: 14px; color: #4A5B70; }
  .mono, .value { font-family: GeistMono; font-weight: 500; }
  .row { position: relative; display: grid; gap: 2px; padding: 9px 66px 9px 16px; border-bottom: 1px solid #D9E1EA; }
  .row.on { background: #CFEDE7; }
  .label { font-size: 13px; color: #4A5B70; }
  .value { font-size: 18px; }
  .bracket { position: absolute; right: 52px; top: 6px; bottom: 6px; width: 3px; border-radius: 2px; background: #0F766E; }
  .tag { position: absolute; right: 10px; top: 50%; transform: translateY(-50%); font-family: GeistMono; font-weight: 500;
    font-size: 14px; padding: 1px 6px; border: 1.5px solid #0F766E; background: #E3F4F1; border-radius: 4px; color: #0E2A47; }
  .finding { display: flex; gap: 12px; align-items: center; background: #fff; color: #0E2A47; border-radius: 14px;
    border-left: 5px solid #0F766E; padding: 14px 16px; font-size: 18px; }
  .finding .tag { position: static; transform: none; }
  .err { color: #B42318; background: #FDECEA; border: 1.5px solid #F0B4AE; border-radius: 4px; padding: 1px 8px; font-size: 15px; font-weight: 600; }
</style></head><body>
  <div class="left">
    <div>
      <div class="brand"><span class="mark">${mark.replace(/ width="24" height="24"/, "")}</span>Tickline</div>
      <h1>Catch document mismatches before the goods leave</h1>
      <p class="lead">Invoice, packing list and purchase order, compared field by field — with the evidence on the page.</p>
    </div>
    <div class="facts"><span><b>${ruleCount}</b> checks per run</span><span><b>${languageCount}</b> languages</span><span>Evidence for every finding</span></div>
  </div>
  <div class="right">
    <div class="stack"><div class="copy a"></div><div class="copy b"></div>
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
