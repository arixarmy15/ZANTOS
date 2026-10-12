import { mkdirSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { seedConflicts } from "./helpers/conflicts";
import { syntheticPdf } from "./helpers/seed";

/**
 * Review screenshots at the three design widths and in Hebrew and Arabic (RTL), covering every content
 * state. Not part of the regular run:
 *   SCREENSHOTS=1 npm run test:e2e -- e2e/screenshots.spec.ts
 * Output goes to `screenshots/` (git-ignored) and uses synthetic, labelled test data only.
 */
test.skip(!process.env.SCREENSHOTS, "Set SCREENSHOTS=1 to capture review screenshots");

const DIR = "screenshots";

test("capture check, findings and report in Hebrew, English and Arabic", async ({
  page,
}, testInfo) => {
  mkdirSync(DIR, { recursive: true });
  const width = testInfo.project.name;
  const { checkId } = await seedConflicts(`Screenshot ${width}`);

  for (const locale of ["he", "en", "ar"]) {
    await page.goto(`/${locale}/checks/${checkId}`);
    await expect(page.locator("article[data-finding]").first()).toBeVisible();
    await page.screenshot({ path: `${DIR}/${width}-${locale}-check.png`, fullPage: true });

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

test("capture loading, empty, error and permission states", async ({ page }, testInfo) => {
  mkdirSync(DIR, { recursive: true });
  const width = testInfo.project.name;

  // Empty and permission: a new check without documents, on a server without an API key.
  await page.goto("/en/checks/new");
  await page.getByLabel("Shipment reference (optional)").fill(`States ${width}`);
  const chooser = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "Browse files" }).click();
  await (
    await chooser
  ).setFiles([
    {
      name: "synthetic-invoice.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from(await syntheticPdf(["Synthetic"])),
    },
    { name: "not-a-pdf.pdf", mimeType: "application/pdf", buffer: Buffer.from("<html></html>") },
  ]);
  await page.getByRole("button", { name: "Create check" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "none of them" })).toBeVisible();
  await page.screenshot({ path: `${DIR}/${width}-en-state-error.png`, fullPage: true });
  await page.getByRole("link", { name: "Continue to the check" }).click();
  await expect(page.getByText("Document reading is not set up")).toBeVisible();
  await page.screenshot({ path: `${DIR}/${width}-en-state-permission.png`, fullPage: true });

  // Loading: hold the document file back so the viewer shows its loading state.
  const { checkId } = await seedConflicts(`Loading ${width}`);
  await page.route("**/documents/*/file", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 4000));
    await route.continue();
  });
  await page.goto(`/en/checks/${checkId}`);
  await page.locator("article[data-finding]").first().locator("button").first().click();
  await expect(page.getByText("Loading the document…").first()).toBeVisible();
  await page.screenshot({ path: `${DIR}/${width}-en-state-loading.png` });
  await page.unroute("**/documents/*/file");
});
