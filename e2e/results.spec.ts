import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { seedConflicts } from "./helpers/conflicts";

async function expectAccessible(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(
    results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(", ")}`),
  ).toEqual([]);
}

/**
 * Messages wrap values in Unicode directional isolates (U+2068/U+2069) so they read correctly
 * in right-to-left languages; this matches the visible text with or without them.
 */
function text(value: string): RegExp {
  return new RegExp(
    [...value].map((char) => char.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("[\u2068\u2069]*"),
  );
}

test("findings are summarized, filterable and linked to the evidence in the document", async ({
  page,
}, testInfo) => {
  const { checkId } = await seedConflicts(`E2E results ${testInfo.project.name}`);
  await page.goto(`/en/checks/${checkId}`);

  await expect(page.getByRole("heading", { name: "Findings", level: 2 })).toBeVisible();
  await expect(
    page.getByText("For information only — not official customs or legal advice.").first(),
  ).toBeVisible();
  await expect(
    page.getByText(
      text(
        "Number of packages differs: 12 in synthetic-invoice.pdf, 14 in synthetic-packing-list.pdf.",
      ),
    ),
  ).toBeVisible();
  await expect(
    page.getByText(text("the net weight (120 kg) is greater than the gross weight (110 kg)")),
  ).toBeVisible();
  // No API key: the exporter names stay "could not be verified" and AI actions are disabled.
  await expect(page.getByText(/comparison is waiting for AI/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Draft correction e-mail" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Explain in plain language" })).toHaveCount(0);

  // Filters: errors only.
  await page.getByRole("button", { name: /^Error/ }).click();
  await expect(
    page.getByRole("status").filter({ hasText: /^Showing \d+ of \d+ findings$/ }),
  ).toBeVisible();
  const entries = page.locator("article[data-finding]");
  const count = await entries.count();
  expect(count).toBeGreaterThan(0);
  for (let i = 0; i < count; i++)
    await expect(entries.nth(i).getByText("Error", { exact: true })).toBeVisible();

  // Selecting a finding shows its evidence in the document.
  const packages = page
    .locator("article[data-finding]")
    .filter({ hasText: "Number of packages differs" });
  const ref = (await packages.locator(".code").first().textContent())!.trim();
  await packages.getByRole("button", { name: "Show in document" }).click();

  if (testInfo.project.name === "mobile") {
    const sheet = page.getByRole("dialog");
    await expect(sheet).toContainText("Number of packages differs");
    await expect(sheet.getByRole("button", { name: new RegExp(`^${ref} · Error`) })).toBeVisible();
    await expectAccessible(page);
    await page.keyboard.press("Escape");
  } else {
    if (testInfo.project.name === "tablet") {
      await expect(page.getByRole("tab", { name: "Documents" })).toHaveAttribute(
        "aria-selected",
        "true",
      );
    }
    const mark = page.getByRole("button", { name: new RegExp(`^${ref} · Error`) });
    await expect(mark).toBeVisible();
    await expect(mark).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByRole("img", { name: /Page 1 of synthetic-invoice\.pdf/ })).toBeVisible();
  }

  if (testInfo.project.name === "tablet") await page.getByRole("tab", { name: "Findings" }).click();
  await page.getByRole("button", { name: "Clear filters" }).click();
  await expectAccessible(page);
});

test("the report shows the disclaimer, findings and checks that ran", async ({
  page,
}, testInfo) => {
  const { checkId } = await seedConflicts(`E2E report ${testInfo.project.name}`);
  await page.goto(`/en/checks/${checkId}`);
  await page.getByRole("link", { name: "Open report" }).click();
  await expect(page).toHaveURL(new RegExp(`/en/checks/${checkId}/report$`));
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    `E2E report ${testInfo.project.name}`,
  );
  await expect(page.getByRole("heading", { name: "Please note" })).toBeVisible();
  await expect(page.getByText("Number of packages differs").first()).toBeVisible();
  await expect(page.getByRole("heading", { name: "Checks that ran" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Print or save as PDF" })).toBeVisible();
  await expectAccessible(page);

  await page.emulateMedia({ media: "print" });
  await expect(page.getByRole("button", { name: "Print or save as PDF" })).toBeHidden();
  await expect(page.locator("header").first()).toBeHidden();
});

test("results and report are translated and accessible in Arabic (RTL) and Turkish", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name === "tablet", "Covered at phone and desktop width");
  const { checkId } = await seedConflicts(`E2E i18n ${testInfo.project.name}`);

  await page.goto(`/ar/checks/${checkId}`);
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(page.getByRole("heading", { name: "النتائج", level: 2 })).toBeVisible();
  await expect(page.getByText(/عدد الطرود مختلف/)).toBeVisible();
  await expectAccessible(page);
  await page.goto(`/ar/checks/${checkId}/report`);
  await expect(page.getByRole("heading", { name: "يُرجى الانتباه" })).toBeVisible();
  await expectAccessible(page);

  await page.goto(`/tr/checks/${checkId}`);
  await expect(page.getByText(/Koli\/paket sayısı farklı/)).toBeVisible();
  await expectAccessible(page);
});

test("the rounding tolerance re-runs the checks", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "Flow test runs once");
  const { checkId } = await seedConflicts("E2E tolerance");
  await page.goto(`/en/checks/${checkId}`);
  // 10 × 9.00 = 90.00 but the line says 95.00: outside the default tolerance.
  await expect(page.getByText(text("Line 1 of synthetic-invoice.pdf"))).toBeVisible();
  const input = page.getByLabel("Rounding tolerance for amounts");
  await input.fill("abc");
  await page.getByRole("button", { name: "Apply" }).click();
  await expect(page.getByText("Enter a number such as 0.01.")).toBeVisible();
  await input.fill("5");
  await page.getByRole("button", { name: "Apply" }).click();
  await expect(page.getByText(text("Line 1 of synthetic-invoice.pdf"))).toHaveCount(0);
  await expect(page.getByText(text("Currently 5."))).toBeVisible();
});
