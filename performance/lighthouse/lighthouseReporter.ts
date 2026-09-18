import type { TestInfo } from "@playwright/test";

import type { LighthouseAuditResult } from "./LighthouseRunner";
import { evaluateLighthousePolicy } from "./lighthousePolicy";

export async function attachLighthouseReport(
  testInfo: TestInfo,
  result: LighthouseAuditResult,
): Promise<void> {
  const { metrics } = result;
  const policyResult = evaluateLighthousePolicy(metrics);

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

  await testInfo.attach("Lighthouse policy result", {
    body: JSON.stringify(policyResult, null, 2),
    contentType: "application/json",
  });

  await testInfo.attach("Lighthouse HTML report", {
    path: result.htmlReportPath,
    contentType: "text/html",
  });

  await testInfo.attach("Lighthouse JSON report", {
    path: result.jsonReportPath,
    contentType: "application/json",
  });

  for (const warning of policyResult.warnings) {
    testInfo.annotations.push({
      type: "warning",
      description: warning.message,
    });
  }
}
