import { test, expect } from "../../src/fixtures/test-fixtures";
import {
  LighthouseRunner,
  type LighthouseMetrics,
} from "../../performance/lighthouse/LightHouseRunner";
import lighthouseThresholds from "../../performance/lighthouse/lighthouseThresholds.json";
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
    const storageState = await tasksDashboardPage.page.context().storageState();
    const lighthouse = new LighthouseRunner();
    const result = await lighthouse.audit({
      url: `${webBaseUrl}/dashboard`,
      storageState,
      reportName: "authenticated-dashboard",
    });

    const metrics: LighthouseMetrics = result.metrics;

    await testInfo.attach("Lighthouse metrics", {
      body: JSON.stringify(
        {
          performanceScore: Math.round(metrics.performanceScore * 100),
          lcpMs: Math.round(metrics.lcp),
          cls: metrics.cls,
          tbtMs: Math.round(metrics.tbt),
          speedIndexMs: Math.round(metrics.speedIndex),
        },
        null,
        2,
      ),
      contentType: "application/json",
    });

    await testInfo.attach("Lighthouse HTML report", {
      path: result.htmlReportPath,
      contentType: "text/html",
    });

    expect(metrics.performanceScore).toBeGreaterThanOrEqual(
      lighthouseThresholds.performanceScore,
    );
    expect(metrics.cls).toBeLessThanOrEqual(lighthouseThresholds.cls);
    expect(metrics.tbt).toBeLessThanOrEqual(lighthouseThresholds.tbtMs);
  });
});
