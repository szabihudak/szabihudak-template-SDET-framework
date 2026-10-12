import { LighthouseRunner } from "@framework/performance/lighthouse/LighthouseRunner";
import { expectLighthousePolicy } from "@framework/performance/lighthouse/lighthousePolicy";
import { attachLighthouseReport } from "@framework/performance/lighthouse/lighthouseReporter";
import { test, expect } from "@app/fixtures/test-fixtures";
import { getCurrentEnvironment } from "@framework/utils/env";

const AUTHENTICATED_LIGHTHOUSE_RUNS = 3;

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
      numberOfRuns: AUTHENTICATED_LIGHTHOUSE_RUNS,
    });

    await attachLighthouseReport(testInfo, result);
    expectLighthousePolicy(result.metrics);
  });
});
