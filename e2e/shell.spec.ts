import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const locales = [
  { code: "en", dir: "ltr" },
  { code: "tr", dir: "ltr" },
  { code: "de", dir: "ltr" },
  { code: "es", dir: "ltr" },
  { code: "fr", dir: "ltr" },
  { code: "ar", dir: "rtl" },
] as const;

const pages = ["", "/checks", "/checks/new", "/does-not-exist"];

async function expectNoAxeViolations(page: import("@playwright/test").Page) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(
    results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(", ")}`),
  ).toEqual([]);
}

for (const { code, dir } of locales) {
  for (const path of pages) {
    test(`${code}${path || "/"} has language, direction, one h1 and no axe violations`, async ({
      page,
    }) => {
      await page.goto(`/${code}${path}`);
      await expect(page.locator("html")).toHaveAttribute("lang", code);
      await expect(page.locator("html")).toHaveAttribute("dir", dir);
      await expect(page.locator("h1")).toHaveCount(1);
      await expect(page.getByRole("contentinfo")).toBeVisible();
      await expectNoAxeViolations(page);
    });
  }
}

test("the root redirects to the browser's language", async ({ browser }) => {
  const context = await browser.newContext({ locale: "tr-TR" });
  const page = await context.newPage();
  await page.goto("/");
  await expect(page).toHaveURL(/\/tr$/);
  await context.close();
});

test("the language switcher keeps the current page", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === "mobile", "Covered by the menu test on phones");
  await page.goto("/en/checks/new");
  await page.getByLabel("Language").selectOption("de");
  await expect(page).toHaveURL(/\/de\/checks\/new$/);
  await expect(page.locator("html")).toHaveAttribute("lang", "de");
});

test("phones get a menu with navigation and the language switcher", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile", "Phone layout only");
  await page.goto("/en");
  await page.getByRole("button", { name: "Menu" }).click();
  const dialog = page.getByRole("dialog", { name: "Menu" });
  await expect(dialog.getByRole("link", { name: "New check" })).toBeVisible();
  await expectNoAxeViolations(page);
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
});
