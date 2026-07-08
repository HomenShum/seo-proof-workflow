import { defineConfig, devices } from "@playwright/test";

const recordVideo = process.env.PLAYWRIGHT_RECORD_VIDEO === "1";

export default defineConfig({
  testDir: "./tests",
  timeout: 60_000,
  retries: 0,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? process.env.SEO_BASE_URL ?? "https://example.com",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: recordVideo ? "on" : "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 920 } },
    },
  ],
});
