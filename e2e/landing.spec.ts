import { expect, test } from "@playwright/test";

/**
 * The overview page: what TradeCheck is, a working example of the evidence ledger, the real
 * rule list, honest sources, and the search-engine signals (structured data, robots).
 */

test("the overview explains the product and leads into a check", async ({ page }, testInfo) => {
  await page.goto("/en");
  await expect(page).toHaveTitle("TradeCheck: check invoice, packing list and PO before shipment");
  await expect(
    page.getByRole("heading", {
      level: 1,
      name: "Catch document mismatches before the goods leave",
    }),
  ).toBeVisible();
  if (testInfo.project.name === "desktop") {
    await expect(
      page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Overview" }),
    ).toHaveAttribute("aria-current", "page");
  }

  // The rule list is the engine's own: 30 rules in four categories, named as in the report.
  await expect(page.getByText("30 checks on every run")).toBeVisible();
  const checks = page.locator("#checks");
  await expect(checks.getByRole("heading", { level: 3 })).toHaveText([
    "Arithmetic",
    "Across documents",
    "Formats and codes",
    "Completeness",
  ]);
  await expect(checks.getByRole("listitem")).toHaveCount(30);
  await expect(checks.getByText("IBAN check digits")).toBeVisible();

  // Figures carry their sources.
  await expect(
    page.getByRole("link", { name: "ICC Technical Advisory Briefing No. 3 (2022)" }),
  ).toHaveAttribute("href", /iccwbo\.org/);

  // Configured limits are shown, not hard-coded copy.
  await expect(
    page.getByText(/up to 10 files per check, 20 MB per file and 20 pages/),
  ).toBeVisible();

  // FAQ answers open in place.
  await page.getByText("How long are my files kept?").click();
  await expect(page.getByText(/deleted automatically after 24 hours/).last()).toBeVisible();

  await page.getByRole("link", { name: "Start a check" }).first().click();
  await expect(page).toHaveURL(/\/en\/checks\/new$/);
});

test("the example marks each finding's evidence in both documents", async ({ page }) => {
  await page.goto("/en");
  const example = page.getByRole("figure", { name: /Example with synthetic documents/ });
  const findings = example.getByRole("list", { name: "Findings in the example" });
  const f1 = findings.getByRole("button", { name: /^F1 Error Number of packages differs/ });
  const f2 = findings.getByRole("button", { name: /^F2 Error Gross weight differs/ });

  await expect(f1).toHaveAttribute("aria-pressed", "true");
  await expect(example.getByText("Evidence for F1")).toHaveCount(2);

  await f2.click();
  await expect(f2).toHaveAttribute("aria-pressed", "true");
  await expect(f1).toHaveAttribute("aria-pressed", "false");
  await expect(example.getByText("Evidence for F1")).toHaveCount(0);
  await expect(example.getByText("Evidence for F2")).toHaveCount(2);

  // Keyboard: the findings are ordinary buttons.
  await f2.press("Shift+Tab");
  await page.keyboard.press("Enter");
  await expect(f1).toHaveAttribute("aria-pressed", "true");
});

test("structured data matches the page and checks stay out of search engines", async ({
  page,
  request,
}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "Same markup everywhere");
  await page.goto("/en");
  const blocks = await page
    .locator('script[type="application/ld+json"]')
    .evaluateAll((nodes) => nodes.map((node) => JSON.parse(node.textContent ?? "")));
  const [app, faq] = blocks[0] as [
    { "@type": string; name: string },
    { "@type": string; mainEntity: { name: string }[] },
  ];
  expect(app).toMatchObject({ "@type": "SoftwareApplication", name: "TradeCheck" });
  expect(faq["@type"]).toBe("FAQPage");
  const questions = await page.locator("#faq summary").allTextContents();
  expect(faq.mainEntity.map((question) => question.name)).toEqual(
    questions.map((question) => question.replace(/[+−]/g, "").trim()),
  );

  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute(
    "content",
    /opengraph-image/,
  );
  await expect(page.locator('meta[name="description"]')).toHaveAttribute(
    "content",
    /compares them field by field/,
  );
  await expect(page.locator('meta[name="robots"]')).toHaveCount(0);

  const robots = await (await request.get("/robots.txt")).text();
  expect(robots).toContain("Disallow: /api/");
  expect(robots).toContain("Disallow: /*/checks");

  for (const path of ["/en/checks", "/en/checks/new"]) {
    await page.goto(path);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
      "content",
      "noindex, nofollow",
    );
  }
});

test("the overview reads right to left in Arabic", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === "tablet", "Covered at phone and desktop width");
  await page.goto("/ar");
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(
    page.getByRole("heading", { level: 1, name: "اكتشف اختلافات المستندات قبل أن تغادر البضاعة" }),
  ).toBeVisible();
  // Values stay in Latin digits, like the paper documents.
  await expect(page.getByRole("figure").first().getByText("1,240 kg").first()).toBeVisible();
});
