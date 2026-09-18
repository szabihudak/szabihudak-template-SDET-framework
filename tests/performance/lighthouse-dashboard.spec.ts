import { LighthouseRunner } from "../../performance/lighthouse/LighthouseRunner";
import { evaluateLighthousePolicy } from "../../performance/lighthouse/lighthousePolicy";
import { attachLighthouseReport } from "../../performance/lighthouse/lighthouseReporter";
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
    const policyResult = evaluateLighthousePolicy(result.metrics);

    await attachLighthouseReport(testInfo, result, policyResult);

    expect(
      policyResult.errors,
      policyResult.errors.map((violation) => violation.message).join("\n"),
    ).toEqual([]);
  });
});
