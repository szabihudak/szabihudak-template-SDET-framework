import { LighthouseRunner } from "../../performance/lighthouse/LighthouseRunner";
import { attachLighthouseReport } from "../../performance/lighthouse/lighthouseReporter";
import lighthouseThresholds from "../../performance/lighthouse/lighthouseThresholds.json";
import { test, expect } from "../../src/fixtures/test-fixtures";
import { getCurrentEnvironment } from "../../src/utils/env";

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
    const authCookies = (await tasksDashboardPage.page.context().storageState())
      .cookies;
    const lighthouse = new LighthouseRunner();
    const result = await lighthouse.audit({
      url: `${webBaseUrl}/dashboard`,
      authCookies,
      reportName: "authenticated-dashboard",
    });
    await attachLighthouseReport(testInfo, result);

    expect(result.metrics.performanceScore).toBeGreaterThanOrEqual(
      lighthouseThresholds.performanceScore.value,
    );
    expect(result.metrics.cls).toBeLessThanOrEqual(
      lighthouseThresholds.cls.value,
    );
    expect(result.metrics.tbt).toBeLessThanOrEqual(
      lighthouseThresholds.tbtMs.value,
    );
  });
});
