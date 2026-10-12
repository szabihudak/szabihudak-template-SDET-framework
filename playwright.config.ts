import { defineConfig, type ReporterDescription } from "@playwright/test";

import { getFrameworkConfig } from "./framework/core/config/frameworkConfig";
import { buildProjects } from "./framework/core/config/playwrightProjects";
import { loadDotEnv } from "./framework/core/utils/dotenv";
import { getCurrentEnvironment } from "./framework/core/utils/env";

loadDotEnv();

const frameworkConfig = getFrameworkConfig();
const isCI = !!process.env.CI;

// Without TEST_ENV the config still loads for --list and offline projects;
// environment-dependent tests fail fast through getCurrentEnvironment().
const baseURL = process.env.TEST_ENV
  ? getCurrentEnvironment().webBaseUrl
  : undefined;

const reporter: ReporterDescription[] = [
  ["list"],
  ["html", { outputFolder: "playwright-report", open: "never" }],
  ["json", { outputFile: "test-results/results.json" }],
  ["./framework/core/reporting/GitHubSummaryReporter.ts"],
];

export default defineConfig({
  testDir: "./tests",

  fullyParallel: true,

  forbidOnly: isCI,

  retries: isCI ? frameworkConfig.execution.ciRetries : 0,

  workers: isCI ? frameworkConfig.execution.ciWorkers : undefined,

  reporter,

  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },

  projects: buildProjects(frameworkConfig),
});
