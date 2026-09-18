import type { TestInfo } from "@playwright/test";

import type { LighthouseAuditResult } from "./LighthouseRunner";
import { evaluateLighthousePolicy } from "./lighthousePolicy";

export async function attachLighthouseReport(
  testInfo: TestInfo,
  result: LighthouseAuditResult,
): Promise<void> {
  const { metrics, runs } = result;
  const policyResult = evaluateLighthousePolicy(metrics);

  await testInfo.attach("Lighthouse aggregate metrics", {
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

  await testInfo.attach("Lighthouse run metrics", {
    body: JSON.stringify(
      runs.map((run, index) => ({
        run: index + 1,
        performanceScore: Math.round(run.metrics.performanceScore * 100),
        lcpMs: Math.round(run.metrics.lcp),
        cls: run.metrics.cls,
        tbtMs: Math.round(run.metrics.tbt),
        speedIndexMs: Math.round(run.metrics.speedIndex),
      })),
      null,
      2,
    ),
    contentType: "application/json",
  });

  await testInfo.attach("Lighthouse policy result", {
    body: JSON.stringify(policyResult, null, 2),
    contentType: "application/json",
  });

  for (const [index, run] of runs.entries()) {
    const runNumber = index + 1;

    await testInfo.attach(`Lighthouse HTML report - run ${runNumber}`, {
      path: run.htmlReportPath,
      contentType: "text/html",
    });

    await testInfo.attach(`Lighthouse JSON report - run ${runNumber}`, {
      path: run.jsonReportPath,
      contentType: "application/json",
    });
  }

  for (const warning of policyResult.warnings) {
    testInfo.annotations.push({
      type: "warning",
      description: warning.message,
    });
  }
}
