import { defineConfig, devices } from "@playwright/test";

const port = Number(process.env.PORT ?? 3000);
const baseURL = `http://localhost:${port}`;

// Environments with a preinstalled Chromium (e.g. some cloud sandboxes) can point to it
// instead of downloading browsers with `npx playwright install`.
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined;
const chromium = { ...devices["Desktop Chrome"], launchOptions: { executablePath } };

export default defineConfig({
  testDir: "./e2e",
  outputDir: "./test-results",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL,
    trace: "retain-on-failure",
  },
  // Three reference widths used for layout and RTL screenshots.
  projects: [
    { name: "mobile", use: { ...chromium, viewport: { width: 390, height: 844 } } },
    { name: "tablet", use: { ...chromium, viewport: { width: 834, height: 1112 } } },
    { name: "desktop", use: { ...chromium, viewport: { width: 1440, height: 900 } } },
  ],
  webServer: {
    command: `npm run build && npm run start -- --port ${port}`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
