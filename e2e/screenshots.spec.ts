import { mkdirSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { seedConflicts } from "./helpers/conflicts";

/**
 * Review screenshots at the three design widths and in Arabic (RTL). Not part of the
 * regular run: `SCREENSHOTS=1 npm run test:e2e -- e2e/screenshots.spec.ts`. Output goes to
 * `screenshots/` (git-ignored) and uses synthetic, labelled test data only.
 */
test.skip(!process.env.SCREENSHOTS, "Set SCREENSHOTS=1 to capture review screenshots");

const DIR = "screenshots";

test("capture check, findings and report", async ({ page }, testInfo) => {
  mkdirSync(DIR, { recursive: true });
  const width = testInfo.project.name;
  const { checkId } = await seedConflicts(`Screenshot ${width}`);

  for (const locale of ["en", "ar"]) {
    await page.goto(`/${locale}`);
    await page.screenshot({ path: `${DIR}/${width}-${locale}-home.png`, fullPage: true });

    await page.goto(`/${locale}/checks/${checkId}`);
    await expect(page.locator("article[data-finding]").first()).toBeVisible();
    await page.screenshot({ path: `${DIR}/${width}-${locale}-check.png`, fullPage: true });

    // Select the packages finding to show the evidence ledger at work.
    const entry = page.locator("article[data-finding]").nth(0);
    await entry.locator("button").first().click();
    await page.waitForTimeout(600);
    await page.screenshot({
      path: `${DIR}/${width}-${locale}-evidence.png`,
      fullPage: width !== "mobile",
    });
    await page.keyboard.press("Escape");

    await page.goto(`/${locale}/checks/${checkId}/report`);
    await page.screenshot({ path: `${DIR}/${width}-${locale}-report.png`, fullPage: true });
  }
});
