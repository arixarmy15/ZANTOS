import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { extraction, field, seedCheck, syntheticPdf } from "./helpers/seed";

async function expectAccessible(page: import("@playwright/test").Page) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(
    results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(", ")}`),
  ).toEqual([]);
}

test("upload creates a check; rejected files are explained; the check can be deleted", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "Flow test runs once");
  await page.goto("/en/checks/new");
  await page.getByLabel("Shipment reference (optional)").fill("E2E upload");
  const chooser = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "Browse files" }).click();
  await (
    await chooser
  ).setFiles([
    {
      name: "synthetic-invoice.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from(await syntheticPdf(["Line"])),
    },
    { name: "not-a-pdf.pdf", mimeType: "application/pdf", buffer: Buffer.from("<html>no</html>") },
  ]);
  await page.getByRole("button", { name: "Create check" }).click();

  // Next.js adds its own route announcer with role="alert"; match ours by text.
  await expect(
    page.getByRole("alert").filter({ hasText: "this file's content is none of them" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Continue to the check" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("E2E upload");
  await expect(page.getByText("synthetic-invoice.pdf")).toBeVisible();
  await expect(page.getByText("Not read yet")).toBeVisible();
  // No API key in tests: reading is disabled and the reason is shown.
  await expect(page.getByText("Document reading is not set up")).toBeVisible();
  await expectAccessible(page);

  await page.getByRole("button", { name: "Delete check" }).click();
  await expect(page.getByRole("dialog")).toContainText("cannot be undone");
  await page.getByRole("button", { name: "Delete permanently" }).click();
  await expect(page).toHaveURL(/\/en\/checks$/);
  await expect(page.getByText("E2E upload")).toHaveCount(0);
});

test("extracted fields can be corrected and are labelled", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "Flow test runs once");
  const { checkId } = await seedCheck({
    name: "E2E fields",
    documents: [
      {
        fileName: "synthetic-invoice.pdf",
        lines: ["Total 100.00 EUR"],
        extraction: extraction({
          header: {
            currency: field("EUR", { confidence: 0.4, value: "€" }),
            totalAmount: field("100.00", { value: "100,00" }),
          },
          lines: [{ description: field("Synthetic item"), quantity: field("2") }],
        }),
      },
    ],
  });

  await page.goto(`/en/checks/${checkId}`);
  const currencyRow = page.getByRole("row", { name: /Currency/ });
  await expect(currencyRow.getByText("Low confidence — please verify")).toBeVisible();

  await page.getByRole("button", { name: "Edit Currency" }).click();
  const input = page.getByRole("textbox", { name: "Currency, value used for checks" });
  await input.fill("euro");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "This value does not have the expected format." }),
  ).toBeVisible();
  await input.fill("USD");
  await page.getByRole("button", { name: "Save" }).click();

  await expect(currencyRow.getByText("Corrected by you")).toBeVisible();
  await expect(currencyRow.getByText("Extracted: EUR")).toBeVisible();
  await expect(currencyRow.getByText("Low confidence — please verify")).toHaveCount(0);
  await expectAccessible(page);
});

for (const locale of ["tr", "ar", "he"]) {
  test(`check page in ${locale} has no axe violations`, async ({ page }) => {
    const { checkId } = await seedCheck({
      name: `E2E ${locale}`,
      documents: [
        {
          fileName: "synthetic.pdf",
          lines: ["x"],
          extraction: extraction({ header: { currency: field("EUR") } }),
        },
      ],
    });
    await page.goto(`/${locale}/checks/${checkId}`);
    await expect(page.locator("h1")).toHaveText(`E2E ${locale}`);
    await expectAccessible(page);
  });
}
