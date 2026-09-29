function formatMilliseconds(value) {
  return typeof value === "number" ? `${value.toFixed(1)} ms` : "N/A";
}

function formatPercentage(value) {
  return typeof value === "number" ? `${(value * 100).toFixed(2)}%` : "N/A";
}

function thresholdPassed(metric, threshold) {
  return metric?.thresholds?.[threshold]?.ok ?? false;
}

function buildMarkdown(data) {
  const durationMetric = data.metrics.task_read_duration;
  const failureMetric = data.metrics.task_read_failures;
  const iterationsMetric = data.metrics.iterations;
  const checksMetric = data.metrics.checks;

  const p95 = durationMetric?.values?.["p(95)"];
  const failureRate = failureMetric?.values?.rate;
  const iterations = iterationsMetric?.values?.count;
  const checkRate = checksMetric?.values?.rate;

  const durationThresholdPassed = thresholdPassed(durationMetric, "p(95)<500");

  const failureThresholdPassed = thresholdPassed(failureMetric, "rate<0.01");

  const overallPassed = durationThresholdPassed && failureThresholdPassed;
  const checksPassed = checkRate === 1;

  const statusIcon = overallPassed ? "✅" : "❌";

  const lines = [
    "<details>",
    `<summary><strong>K6 API Performance - Summary ${statusIcon}</strong></summary>`,
    "",
    `**Run status:** ${overallPassed ? "passed" : "failed"}`,
    "",
    "| Metric | Result | Threshold | Status |",
    "| --- | ---: | ---: | :---: |",
    `| Task read p95 | ${formatMilliseconds(p95)} | < 500 ms | ${durationThresholdPassed ? "✅" : "❌"} |`,
    `| Task read failure rate | ${formatPercentage(failureRate)} | < 1% | ${failureThresholdPassed ? "✅" : "❌"} |`,
    `| Iterations | ${iterations ?? "N/A"} | — | — |`,
    `| Checks passed | ${formatPercentage(checkRate)} | — | ${checksPassed ? "✅" : "⚠️"} |`,
    "",
  ];

  if (!overallPassed) {
    lines.push("### Failed Thresholds", "");

    if (!durationThresholdPassed) {
      lines.push(
        "<details>",
        "<summary>❌ Task read p95 threshold failed</summary>",
        "",
        `**Actual:** ${formatMilliseconds(p95)}  `,
        "**Expected:** < 500 ms",
        "",
        "</details>",
        "",
      );
    }

    if (!failureThresholdPassed) {
      lines.push(
        "<details>",
        "<summary>❌ Task read failure-rate threshold failed</summary>",
        "",
        `**Actual:** ${formatPercentage(failureRate)}  `,
        "**Expected:** < 1%",
        "",
        "</details>",
        "",
      );
    }
  }

  lines.push(
    "> Full k6 HTML performance reports remain separate CI evidence when artifact upload is available.",
    "",
    "</details>",
    "",
  );

  return lines.join("\n");
}

export function handleSummary(data) {
  return {
    "/reports/github-summary.md": buildMarkdown(data),
    "/reports/summary.json": JSON.stringify(data, null, 2),
  };
}
