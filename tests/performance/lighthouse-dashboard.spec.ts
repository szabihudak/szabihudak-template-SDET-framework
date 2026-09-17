import { test, expect } from "../../src/fixtures/test-fixtures";
import { getCurrentEnvironment } from "../../src/utils/env";
import { LighthouseRunner } from "../../performance/lighthouse/LighthouseRunner";
import { attachLighthouseReport } from "../../performance/lighthouse/lighthouseReporter";
import lighthouseThresholds from "../../performance/lighthouse/lighthouseThresholds.json";

test.describe("Authenticated dashboard performance", () => {
  test("meets the Lighthouse browser performance baseline", async ({
    tasksDashboardPage,
    createdTask,
  }, testInfo) => {
    const { webBaseUrl } = getCurrentEnvironment();
    await tasksDashboardPage.goto();
    await expect(
      tasksDashboardPage.taskCardByTitle(createdTask.request.title),
    ).toBeVisible();
    const storageState = await tasksDashboardPage.page.context().storageState();
    const lighthouse = new LighthouseRunner();
    const result = await lighthouse.audit({
      url: `${webBaseUrl}/dashboard`,
      storageState,
      reportName: "authenticated-dashboard",
    });

    await attachLighthouseReport(testInfo, result);

    expect(result.metrics.performanceScore).toBeGreaterThanOrEqual(
      lighthouseThresholds.performanceScore,
    );
    expect(result.metrics.cls).toBeLessThanOrEqual(lighthouseThresholds.cls);
    expect(result.metrics.tbt).toBeLessThanOrEqual(lighthouseThresholds.tbtMs);
  });
});
