import { devices, type PlaywrightTestConfig } from "@playwright/test";

import type { Browser, FrameworkConfig } from "./frameworkConfigSchema";

type Project = NonNullable<PlaywrightTestConfig["projects"]>[number];

const BROWSER_DEVICES: Record<Browser, string> = {
  chromium: "Desktop Chrome",
  firefox: "Desktop Firefox",
  webkit: "Desktop Safari",
};

const specsIn = (directory: string) =>
  new RegExp(`tests/${directory}/.*\\.spec\\.ts`);

export function buildProjects({
  modules,
  browsers,
}: FrameworkConfig): Project[] {
  const chromium = { ...devices[BROWSER_DEVICES.chromium] };
  const projects: Project[] = [];

  if (modules.api) {
    projects.push({ name: "api", testMatch: specsIn("api") });
  }

  // Database runs keep failed state for investigation instead of retrying.
  if (modules.database) {
    projects.push({
      name: "database",
      testMatch: specsIn("database"),
      retries: 0,
    });
  }

  if (modules.accessibility) {
    projects.push({
      name: "accessibility",
      testMatch: specsIn("accessibility"),
      use: chromium,
    });
  }

  if (modules.visual) {
    projects.push({
      name: "visual",
      testMatch: specsIn("visual"),
      use: chromium,
    });
  }

  // Lighthouse repeats measurements itself; a retry would hide a policy failure.
  if (modules.performance) {
    projects.push({
      name: "performance",
      testMatch: specsIn("performance"),
      retries: 0,
      timeout: 90_000,
      use: chromium,
    });
  }

  const browserSpecs = [
    ...(modules.ui ? [specsIn("ui")] : []),
    ...(modules.smoke ? [specsIn("smoke")] : []),
  ];

  if (browserSpecs.length > 0) {
    for (const browser of browsers) {
      projects.push({
        name: browser,
        testMatch: browserSpecs,
        use: { ...devices[BROWSER_DEVICES[browser]] },
      });
    }
  }

  return projects;
}
