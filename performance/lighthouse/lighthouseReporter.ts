import fs from "node:fs";
import path from "node:path";

import type { TestInfo } from "@playwright/test";

import type { LighthouseAuditResult } from "./LighthouseRunner";
import {
  evaluateLighthousePolicy,
  type LighthousePolicyResult,
} from "./lighthousePolicy";
import lighthouseThresholds from "./lighthouseThresholds.json";

function formatMilliseconds(value: number): string {
  return `${Math.round(value)} ms`;
}

function formatScore(value: number): string {
  return `${Math.round(value * 100)}`;
}

function metricStatus(
  hasError: boolean,
  hasWarning: boolean,
): "✅" | "⚠️" | "❌" {
  if (hasError) {
    return "❌";
  }

  if (hasWarning) {
    return "⚠️";
  }

  return "✅";
}

function hasViolation(
  policyResult: LighthousePolicyResult,
  metric: string,
  severity: "error" | "warn",
): boolean {
  const violations =
    severity === "error" ? policyResult.errors : policyResult.warnings;

  return violations.some((violation) => violation.metric === metric);
}

function buildGitHubSummary(
  result: LighthouseAuditResult,
  policyResult: LighthousePolicyResult,
): string {
  const { metrics } = result;

  const hasErrors = policyResult.errors.length > 0;
  const hasWarnings = policyResult.warnings.length > 0;

  const overallIcon = hasErrors ? "❌" : hasWarnings ? "⚠️" : "✅";

  const performanceStatus = metricStatus(
    hasViolation(policyResult, "performanceScore", "error"),
    hasViolation(policyResult, "performanceScore", "warn"),
  );

  const lcpStatus = metricStatus(
    hasViolation(policyResult, "lcpMs", "error"),
    hasViolation(policyResult, "lcpMs", "warn"),
  );

  const clsStatus = metricStatus(
    hasViolation(policyResult, "cls", "error"),
    hasViolation(policyResult, "cls", "warn"),
  );

  const tbtStatus = metricStatus(
    hasViolation(policyResult, "tbtMs", "error"),
    hasViolation(policyResult, "tbtMs", "warn"),
  );

  const lines = [
    "<details>",
    `<summary><strong>Lighthouse - Performance Summary ${overallIcon}</strong></summary>`,
    "",
    `**Run status:** ${hasErrors ? "failed" : hasWarnings ? "passed with warnings" : "passed"}`,
    "",
    "| Metric | Result | Threshold | Status |",
    "| --- | ---: | ---: | :---: |",
    `| Performance score | ${formatScore(metrics.performanceScore)} | >= ${Math.round(
      lighthouseThresholds.performanceScore.value * 100,
    )} | ${performanceStatus} |`,
    `| LCP | ${formatMilliseconds(metrics.lcp)} | <= ${lighthouseThresholds.lcpMs.value} ms | ${lcpStatus} |`,
    `| CLS | ${metrics.cls.toFixed(3)} | <= ${lighthouseThresholds.cls.value} | ${clsStatus} |`,
    `| TBT | ${formatMilliseconds(metrics.tbt)} | <= ${lighthouseThresholds.tbtMs.value} ms | ${tbtStatus} |`,
    `| Speed Index | ${formatMilliseconds(metrics.speedIndex)} | — | ℹ️ |`,
    "",
  ];

  if (policyResult.errors.length > 0) {
    lines.push("### Failed Policy Checks", "");

    for (const violation of policyResult.errors) {
      lines.push(
        "<details>",
        `<summary>❌ ${violation.metric}</summary>`,
        "",
        violation.message,
        "",
        "</details>",
        "",
      );
    }
  }

  if (policyResult.warnings.length > 0) {
    lines.push("### Policy Warnings", "");

    for (const violation of policyResult.warnings) {
      lines.push(
        "<details>",
        `<summary>⚠️ ${violation.metric}</summary>`,
        "",
        violation.message,
        "",
        "</details>",
        "",
      );
    }
  }

  lines.push(
    "> Full Lighthouse HTML and JSON reports remain separate CI evidence when artifact upload is available.",
    "",
    "</details>",
    "",
  );

  return lines.join("\n");
}

function writeGitHubSummary(
  result: LighthouseAuditResult,
  policyResult: LighthousePolicyResult,
): void {
  const outputDirectory = path.resolve(
    process.cwd(),
    "performance-results/lighthouse",
  );

  fs.mkdirSync(outputDirectory, {
    recursive: true,
  });

  fs.writeFileSync(
    path.join(outputDirectory, "github-summary.md"),
    buildGitHubSummary(result, policyResult),
    "utf8",
  );
}

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

  writeGitHubSummary(result, policyResult);
}
