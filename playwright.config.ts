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
  // Three reference widths used for layout and RTL screenshots. Phone and tablet are touch
  // devices, so pointer: coarse styles (44 px targets, 16 px form text) are what they test.
  projects: [
    {
      name: "mobile",
      use: {
        ...chromium,
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
        deviceScaleFactor: 3,
      },
    },
    {
      name: "tablet",
      use: {
        ...chromium,
        viewport: { width: 834, height: 1112 },
        isMobile: true,
        hasTouch: true,
        deviceScaleFactor: 2,
      },
    },
    { name: "desktop", use: { ...chromium, viewport: { width: 1440, height: 900 } } },
  ],
  webServer: {
    command: `node -e "require('fs').rmSync('.e2e-data',{recursive:true,force:true})" && npm run build && npm run start -- --port ${port}`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    // Isolated storage; no API key, so nothing is sent to Anthropic during tests.
    env: { DATA_DIR: ".e2e-data", ANTHROPIC_API_KEY: "", CONTACT_EMAIL: "founder@example.com" },
  },
});
