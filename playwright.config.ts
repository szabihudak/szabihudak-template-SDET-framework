import { defineConfig, type ReporterDescription } from "@playwright/test";

import { getFrameworkConfig } from "./template-fw/framework/config/frameworkConfig";
import { buildProjects } from "./template-fw/framework/config/playwrightProjects";
import { loadDotEnv } from "./template-fw/framework/utils/dotenv";
import { getCurrentEnvironment } from "./template-fw/framework/utils/env";

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
  ...(frameworkConfig.modules.ai
    ? [
        [
          "./template-fw/framework/ai/reporters/FailureEvidenceReporter.ts",
        ] as const,
      ]
    : []),
  ["./template-fw/framework/reporting/GitHubSummaryReporter.ts"],
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
