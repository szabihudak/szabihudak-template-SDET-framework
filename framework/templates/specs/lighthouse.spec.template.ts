// @template lighthouse-spec: Authenticated browser performance measured by Lighthouse after deterministic setup.
// @template Canonical source: tests/performance/lighthouse-dashboard.spec.ts. Rules: framework/docs/TESTING_STANDARDS.md#browser-performance-standard
// @template Replace the tokens described in framework/templates/index.json. Fields, locators and test data are illustrative.
import { LighthouseRunner } from "@framework/performance/lighthouse/LighthouseRunner";
import { expectLighthousePolicy } from "@framework/performance/lighthouse/lighthousePolicy";
import { attachLighthouseReport } from "@framework/performance/lighthouse/lighthouseReporter";
import { test, expect } from "@app/fixtures/test-fixtures";
import { requireUrl } from "@framework/utils/env";

const AUTHENTICATED_LIGHTHOUSE_RUNS = 3;

test.describe("Authenticated dashboard performance", () => {
  test("meets the Lighthouse browser performance baseline", async ({
    __page__Page,
    created__Domain__,
  }, testInfo) => {
    const webBaseUrl = requireUrl("webBaseUrl");
    await __page__Page.goto();
    await expect(
      __page__Page.__domain__CardByTitle(created__Domain__.request.title),
    ).toBeVisible();
    const authCookies = (await __page__Page.page.context().storageState())
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
