import { expect, test, type Browser, type Page } from "@playwright/test";
import { seedConflicts } from "./helpers/conflicts";
import { syntheticPdf } from "./helpers/seed";

/**
 * Phone ergonomics on real touch emulation, down to the narrowest common phone (320 px):
 * no sideways scrolling, 44 px touch targets, 16 px form text (iOS zooms into anything
 * smaller), phone metadata, and the phone-specific layouts.
 */
test.describe.configure({ mode: "parallel" });

const WIDTHS = [320, 390];

async function phone(browser: Browser, width: number) {
  const context = await browser.newContext({
    viewport: { width, height: 740 },
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 3,
    // Smooth scrolling would move targets while the test taps them; the site jumps instead
    // when reduced motion is requested.
    reducedMotion: "reduce",
  });
  return { context, page: await context.newPage() };
}

/** Problems a phone user would hit on the current screen. */
async function ergonomics(page: Page) {
  return page.evaluate(() => {
    // The layout viewport is the phone's width; when content is wider, mobile browsers zoom
    // the page out (innerWidth grows) or scroll it sideways (scrollWidth grows).
    const width = document.documentElement.clientWidth;
    const problems: string[] = [];
    const widest = Math.max(document.documentElement.scrollWidth, window.innerWidth);
    if (widest > width) problems.push(`page is wider than the phone: ${widest} > ${width}`);
    const controls = document.querySelectorAll<HTMLElement>(
      "main a[href], main button, main input:not([type=hidden]), main select, main textarea, main summary, [role=dialog] button, [role=dialog] input, [role=dialog] select, [role=dialog] textarea, header button, header select",
    );
    for (const element of controls) {
      const rect = element.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) continue;
      // Exempt: links inside running text, and the evidence tags positioned beside page lines.
      if (
        element.tagName === "A" &&
        element.closest("p, li q, td, th") &&
        !element.className.includes("h-")
      )
        continue;
      if (element.closest("[data-evidence-margin]")) continue;
      // A ::after overlay extends the hit area: around the element itself, or over a whole
      // row when the element is a stretched link inside a positioned container.
      const after = getComputedStyle(element, "::after");
      const extend = (value: string) => Math.max(0, -parseFloat(value) || 0);
      let hitHeight = rect.height;
      if (after.content !== "none" && after.position === "absolute") {
        hitHeight =
          getComputedStyle(element).position === "static" && element.offsetParent
            ? element.offsetParent.getBoundingClientRect().height
            : rect.height + extend(after.top) + extend(after.bottom);
      }
      if (hitHeight < 44 || rect.width < 24) {
        const name = (element.getAttribute("aria-label") ?? element.textContent ?? "")
          .trim()
          .slice(0, 30);
        problems.push(
          `small target: ${element.tagName.toLowerCase()} "${name}" ${Math.round(rect.width)}×${Math.round(hitHeight)}`,
        );
      }
    }
    for (const field of document.querySelectorAll<HTMLElement>(
      "input:not([type=hidden]):not([type=file]), select, textarea",
    )) {
      if (field.getBoundingClientRect().width === 0) continue;
      const size = parseFloat(getComputedStyle(field).fontSize);
      if (size < 16)
        problems.push(`field text ${size}px would make iOS zoom: ${field.id || field.tagName}`);
    }
    return problems;
  });
}

for (const width of WIDTHS) {
  test(`every screen fits and is touch-sized at ${width} px`, async ({ browser }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "Uses its own phone contexts");
    test.setTimeout(120_000);
    const { checkId } = await seedConflicts(`Phone ${width}`);
    const { context, page } = await phone(browser, width);

    for (const path of [
      "/en",
      "/ar",
      "/en/checks",
      "/en/checks/new",
      `/en/checks/${checkId}`,
      `/ar/checks/${checkId}`,
      `/en/checks/${checkId}/report`,
      "/en/no-such-page",
    ]) {
      await page.goto(path);
      expect(await ergonomics(page), path).toEqual([]);
    }

    // A selected file with a long name and a rejected one.
    await page.goto("/en/checks/new");
    const chooser = page.waitForEvent("filechooser");
    await page.getByRole("button", { name: "Browse files" }).click();
    await (
      await chooser
    ).setFiles([
      {
        name: "a-very-long-synthetic-commercial-invoice-file-name-2026-final-version.pdf",
        mimeType: "application/pdf",
        buffer: Buffer.from(await syntheticPdf(["Synthetic"])),
      },
      { name: "not-a-pdf.pdf", mimeType: "application/pdf", buffer: Buffer.from("<html></html>") },
    ]);
    await page.getByRole("button", { name: "Create check" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "none of them" })).toBeVisible();
    expect(await ergonomics(page), "files selected").toEqual([]);

    // The phone menu.
    await page.getByRole("button", { name: "Menu" }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    expect(await ergonomics(page), "menu").toEqual([]);
    await page.keyboard.press("Escape");

    // The evidence sheet, an open field editor and the delete dialog on the check page.
    await page.goto(`/en/checks/${checkId}`);
    await page
      .locator("article[data-finding]")
      .first()
      .getByRole("button", { name: "Show in document" })
      .click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(page.getByRole("img", { name: /Page 1 of/ })).toBeVisible();
    expect(await ergonomics(page), "evidence sheet").toEqual([]);
    await page.keyboard.press("Escape");
    await page
      .getByRole("button", { name: /^Edit / })
      .first()
      .click();
    expect(await ergonomics(page), "field editor").toEqual([]);
    await page.getByRole("button", { name: "Cancel" }).click();
    await page.getByRole("button", { name: "Delete check" }).click();
    expect(await ergonomics(page), "delete dialog").toEqual([]);
    await context.close();
  });
}

test("phones get theme colour, a manifest with icons and no auto-linked numbers", async ({
  page,
  request,
}, testInfo) => {
  test.skip(testInfo.project.name !== "mobile", "Metadata is the same everywhere");
  await page.goto("/en");
  await expect(page.locator('meta[name="viewport"]')).toHaveAttribute(
    "content",
    /viewport-fit=cover/,
  );
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute("content", "#FFFFFF");
  await expect(page.locator('meta[name="format-detection"]').first()).toHaveAttribute(
    "content",
    /telephone=no/,
  );
  await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveCount(1);
  const href = await page.locator('link[rel="manifest"]').getAttribute("href");
  const manifest = await (await request.get(href!)).json();
  expect(manifest).toMatchObject({ name: "TradeCheck", display: "standalone", start_url: "/" });
  for (const icon of manifest.icons as { src: string }[]) {
    expect((await request.get(icon.src)).status(), icon.src).toBe(200);
  }
});

test("phone layouts: card list, folded filters, jump links, bottom sheet, zoomable page", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "mobile", "Phone layout");
  const { checkId } = await seedConflicts("Phone layouts");

  // The check list is a list of rows, not a wide table.
  await page.goto("/en/checks");
  await expect(page.getByRole("list", { name: "Your checks" })).toBeVisible();
  await expect(page.getByRole("table")).toBeHidden();

  await page.goto(`/en/checks/${checkId}`);
  // Jump links to the page's sections.
  const jump = page.getByRole("navigation", { name: "On this page" });
  await jump.getByRole("link", { name: "Checks" }).click();
  await expect(page).toHaveURL(/#rules-heading$/);

  // Category and document filters are folded away until asked for.
  await expect(page.getByLabel("Category", { exact: true })).toBeHidden();
  await page.getByRole("button", { name: "More filters" }).click();
  await expect(page.getByLabel("Category", { exact: true })).toBeVisible();
  await page.getByLabel("Category", { exact: true }).selectOption("crossDocument");
  await expect(page.getByRole("button", { name: /More filters.*1 active/ })).toBeVisible();

  // Dialogs dock to the bottom of the screen.
  await page.getByRole("button", { name: "Delete check" }).click();
  // Polled, because the sheet slides up when it opens.
  const bottom = async () => {
    const box = (await page.getByRole("dialog").boundingBox())!;
    return Math.round(box.y + box.height);
  };
  await expect.poll(bottom).toBe(page.viewportSize()!.height);
  await page.keyboard.press("Escape");

  // The page is drawn at the width it is shown at, so evidence stays on its text when zoomed.
  await page.getByLabel("Category", { exact: true }).selectOption("");
  await page
    .locator("article[data-finding]")
    .first()
    .getByRole("button", { name: "Show in document" })
    .click();
  const canvas = page.getByRole("img", { name: /Page 1 of/ });
  await expect(canvas).toBeVisible();
  const markAt = () =>
    page.evaluate(() => {
      const art = document.querySelector<HTMLCanvasElement>("canvas")!;
      const mark = document.querySelector<HTMLElement>(".outline-harbor")!;
      const c = art.getBoundingClientRect();
      const m = mark.getBoundingClientRect();
      return {
        x: (m.left - c.left) / c.width,
        y: (m.top - c.top) / c.height,
        drawnAtShownSize: Math.abs(art.width / window.devicePixelRatio - c.width) < 2,
      };
    });
  const before = await markAt();
  expect(before.drawnAtShownSize).toBe(true);
  await page.getByRole("button", { name: "Zoom in" }).click();
  await expect(page.getByText("150%")).toBeVisible();
  await expect.poll(async () => (await canvas.boundingBox())!.width).toBeGreaterThan(400);
  const after = await markAt();
  expect(after.drawnAtShownSize).toBe(true);
  expect(Math.abs(after.x - before.x)).toBeLessThan(0.01);
  expect(Math.abs(after.y - before.y)).toBeLessThan(0.01);
});
