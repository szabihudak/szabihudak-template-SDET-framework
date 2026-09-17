import type { TestInfo } from "@playwright/test";

import type { LighthouseAuditResult } from "./LighthouseRunner";

export async function attachLighthouseReport(
  testInfo: TestInfo,
  result: LighthouseAuditResult,
): Promise<void> {
  const { metrics } = result;

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
}