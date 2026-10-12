#!/usr/bin/env node
// Renders the Tickline mark (design/brand/mark.svg) into the PNG icons phones need: the web
// app manifest icons (192, 512, maskable 512) and the Apple touch icon (180). Uses Playwright's
// Chromium; set PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH to use an installed browser.
import { readFileSync } from "node:fs";
import { chromium } from "@playwright/test";

const mark = readFileSync(new URL("../design/brand/mark.svg", import.meta.url), "utf8");
const PAPER = "#FFFFFF";

// [file, size, share of the canvas the mark may use]. Maskable icons keep the mark inside the
// central safe zone (a circle of 80% of the width), so platform masks never cut it.
const ICONS = [
  ["public/icons/icon-192.png", 192, 0.72],
  ["public/icons/icon-512.png", 512, 0.72],
  ["public/icons/icon-maskable-512.png", 512, 0.56],
  ["src/app/apple-icon.png", 180, 0.7],
];

const browser = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined,
});
try {
  for (const [file, size, share] of ICONS) {
    const page = await browser.newPage({ viewport: { width: size, height: size } });
    const markSize = Math.round(size * share);
    await page.setContent(
      `<html><body style="margin:0;width:${size}px;height:${size}px;display:grid;place-items:center;background:${PAPER}">` +
        mark.replace("<svg ", `<svg style="width:${markSize}px;height:${markSize}px" `) +
        "</body></html>",
    );
    await page.screenshot({ path: file, omitBackground: false });
    await page.close();
    console.log(`${file} (${size}×${size})`);
  }
} finally {
  await browser.close();
}
