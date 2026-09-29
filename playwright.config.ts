import { defineConfig, devices } from "@playwright/test";
import { getCurrentEnvironment } from "./src/utils/env";

const environment = getCurrentEnvironment();

export default defineConfig({
  testDir: "./tests",

  fullyParallel: true,

  forbidOnly: !!process.env.CI,

  retries: process.env.CI ? 2 : 0,

  workers: process.env.CI ? 1 : undefined,

  reporter: [
    ["list"],
    ["html", { outputFolder: "playwright-report", open: "never" }],
    ["json", { outputFile: "test-results/results.json" }],
    ["./src/ai/reporters/FailureEvidenceReporter.ts"],
    ["./src/reporting/GitHubSummaryReporter.ts"],
  ],

  use: {
    baseURL: environment.webBaseUrl,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },

  projects: [
    {
      name: "api",
      testMatch: /tests\/api\/.*\.spec\.ts/,
    },
    {
      name: "database",
      testMatch: /tests\/database\/.*\.spec\.ts/,
      retries: 0,
    },
    {
      name: "ai",
      testMatch: /tests\/ai\/.*\.spec\.ts/,
      retries: 0,
    },
    {
      name: "accessibility",
      testMatch: /tests\/accessibility\/.*\.spec\.ts/,
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "visual",
      testMatch: /tests\/visual\/.*\.spec\.ts/,
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "performance",
      testMatch: /tests\/performance\/.*\.spec\.ts/,
      retries: 0,
      timeout: 90_000,
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "chromium",
      testMatch: [/tests\/ui\/.*\.spec\.ts/, /tests\/smoke\/.*\.spec\.ts/],
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "firefox",
      testMatch: [/tests\/ui\/.*\.spec\.ts/, /tests\/smoke\/.*\.spec\.ts/],
      use: { ...devices["Desktop Firefox"] },
    },
    {
      name: "webkit",
      testMatch: [/tests\/ui\/.*\.spec\.ts/, /tests\/smoke\/.*\.spec\.ts/],
      use: { ...devices["Desktop Safari"] },
    },
  ],
});
