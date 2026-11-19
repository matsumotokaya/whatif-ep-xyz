import { defineConfig, devices } from "@playwright/test";

const externalBaseUrl = process.env.GALLERY_TEST_BASE_URL;
// Keep the E2E production server separate from the fixed development port 3710.
// Reusing a stale dev server would make performance and hydration results invalid.
const baseURL = externalBaseUrl ?? "http://127.0.0.1:3711";

const DESKTOP_ONLY_SPECS = /editor-(studio|member)\.spec\.ts$/;

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 120_000,
  expect: {
    timeout: 15_000,
  },
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  webServer: externalBaseUrl
    ? undefined
    : {
        command: "npm run start -- -p 3711",
        url: baseURL,
        reuseExistingServer: false,
        timeout: 120_000,
      },
  projects: [
    {
      name: "chromium-mobile",
      // The Studio editor specs need a mouse and a desktop-sized window.
      testIgnore: DESKTOP_ONLY_SPECS,
      use: {
        ...devices["Pixel 7"],
      },
    },
    {
      name: "chromium-desktop",
      testMatch: DESKTOP_ONLY_SPECS,
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 900 },
      },
    },
  ],
});
