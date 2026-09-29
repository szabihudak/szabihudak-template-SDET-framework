import fs from "node:fs";
import path from "node:path";

import type {
  FullResult,
  Reporter,
  Suite,
  TestCase,
  TestResult,
} from "@playwright/test/reporter";

type TestOutcome = "passed" | "failed" | "flaky" | "skipped";

interface TestSummary {
  title: string;
  file: string;
  outcome: TestOutcome;
}

interface FailedTestSummary {
  title: string;
  file: string;
  line: number;
  retry: number;
  errorMessage: string;
  hasScreenshot: boolean;
  hasTrace: boolean;
  hasVideo: boolean;
}

interface FileSummary {
  file: string;
  outcome: TestOutcome;
  tests: TestSummary[];
}

export default class GitHubSummaryReporter implements Reporter {
  private startedAt = Date.now();
  private projectName = "unknown";
  private readonly tests = new Map<string, TestCase>();
  private readonly latestResults = new Map<string, TestResult>();

  onBegin(_config: unknown, suite: Suite): void {
    this.startedAt = Date.now();

    const firstTest = suite.allTests()[0];

    if (firstTest) {
      this.projectName = firstTest.parent.project()?.name ?? "unknown";
    }
  }

  onTestEnd(test: TestCase, result: TestResult): void {
    this.tests.set(test.id, test);
    this.latestResults.set(test.id, result);
  }

  onEnd(result: FullResult): void {
    const counts = {
      passed: 0,
      failed: 0,
      flaky: 0,
      skipped: 0,
    };

    const testSummaries: TestSummary[] = [];
    const failedTests: FailedTestSummary[] = [];

    for (const test of this.tests.values()) {
      const latestResult = this.latestResults.get(test.id);
      const outcome = this.toTestOutcome(test, latestResult);

      counts[outcome] += 1;

      testSummaries.push({
        title: test.title,
        file: this.toRepositoryRelativePath(test.location.file),
        outcome,
      });

      if (outcome === "failed" && latestResult) {
        failedTests.push(this.toFailedTestSummary(test, latestResult));
      }
    }

    const durationMs = Date.now() - this.startedAt;

    const summary = this.buildSummary(
      result,
      counts,
      this.toFileSummaries(testSummaries),
      failedTests,
      durationMs,
    );

    const outputPath = path.resolve("test-results", "github-summary.md");

    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, summary, "utf8");
  }

  private toTestOutcome(
    test: TestCase,
    latestResult: TestResult | undefined,
  ): TestOutcome {
    const outcome = test.outcome();

    if (outcome === "flaky") {
      return "flaky";
    }

    if (outcome === "skipped" || latestResult?.status === "skipped") {
      return "skipped";
    }

    if (outcome === "unexpected") {
      return "failed";
    }

    return "passed";
  }

  private toFileSummaries(tests: TestSummary[]): FileSummary[] {
    const grouped = new Map<string, TestSummary[]>();

    for (const test of tests) {
      const existing = grouped.get(test.file) ?? [];
      existing.push(test);
      grouped.set(test.file, existing);
    }

    return [...grouped.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([file, fileTests]) => ({
        file,
        outcome: this.aggregateOutcome(fileTests.map((test) => test.outcome)),
        tests: fileTests,
      }));
  }

  private aggregateOutcome(outcomes: TestOutcome[]): TestOutcome {
    if (outcomes.includes("failed")) {
      return "failed";
    }

    if (outcomes.includes("flaky")) {
      return "flaky";
    }

    if (outcomes.every((outcome) => outcome === "skipped")) {
      return "skipped";
    }

    return "passed";
  }

  private toFailedTestSummary(
    test: TestCase,
    result: TestResult,
  ): FailedTestSummary {
    const attachmentNames = new Set(
      result.attachments.map((attachment) => attachment.name),
    );

    return {
      title: test.titlePath().join(" › "),
      file: this.toRepositoryRelativePath(test.location.file),
      line: test.location.line,
      retry: result.retry,
      errorMessage: result.errors[0]?.message ?? "Unknown test failure",
      hasScreenshot: attachmentNames.has("screenshot"),
      hasTrace: attachmentNames.has("trace"),
      hasVideo: attachmentNames.has("video"),
    };
  }

  private buildSummary(
    result: FullResult,
    counts: {
      passed: number;
      failed: number;
      flaky: number;
      skipped: number;
    },
    files: FileSummary[],
    failedTests: FailedTestSummary[],
    durationMs: number,
  ): string {
    const runOutcome: TestOutcome =
      result.status === "passed" ? "passed" : "failed";

    const runIcon = this.outcomeIcon(runOutcome);
    const durationSeconds = (durationMs / 1000).toFixed(1);
    const displayProjectName = this.escapeHtml(
      this.formatProjectName(this.projectName),
    );

    const lines = [
      "<details>",
      `<summary><strong>${displayProjectName} - Test Summary ${runIcon}</strong></summary>`,
      "",
      "<br>",
      "",
      `<p><strong>Run status:</strong> ${this.escapeHtml(result.status)}</p>`,
      "",
      "<table>",
      "<thead>",
      "<tr>",
      "<th>Result</th>",
      '<th align="right">Count</th>',
      "</tr>",
      "</thead>",
      "<tbody>",
      `<tr><td>✅ Passed</td><td align="right">${counts.passed}</td></tr>`,
      `<tr><td>❌ Failed</td><td align="right">${counts.failed}</td></tr>`,
      `<tr><td>⚠️ Flaky</td><td align="right">${counts.flaky}</td></tr>`,
      `<tr><td>⏭ Skipped</td><td align="right">${counts.skipped}</td></tr>`,
      "</tbody>",
      "</table>",
      "",
      `<p><strong>Duration:</strong> ${durationSeconds}s</p>`,
      "",
      "<h3>Files and Tests</h3>",
      "",
    ];

    if (files.length === 0) {
      lines.push("<p>No test results were recorded.</p>", "");
    }

    for (const file of files) {
      lines.push(
        `<h4>${this.outcomeIcon(file.outcome)} <code>${this.escapeHtml(file.file)}</code></h4>`,
        "<ul>",
      );

      for (const test of file.tests) {
        lines.push(
          `<li>${this.outcomeIcon(test.outcome)} ${this.escapeHtml(test.title)}</li>`,
        );
      }

      lines.push("</ul>", "");
    }

    if (failedTests.length > 0) {
      lines.push("<h3>Failed Test Details</h3>", "");

      for (const failedTest of failedTests) {
        lines.push(
          "<details>",
          `<summary>❌ ${this.escapeHtml(failedTest.title)}</summary>`,
          "",
          "<br>",
          "",
          `<p><strong>Location:</strong> <code>${this.escapeHtml(
            `${failedTest.file}:${failedTest.line}`,
          )}</code><br>`,
          `<strong>Retry:</strong> ${failedTest.retry}</p>`,
          "",
          `<pre><code>${this.escapeHtml(failedTest.errorMessage)}</code></pre>`,
          "",
          "<p><strong>Diagnostics</strong></p>",
          "<ul>",
          `<li>${failedTest.hasScreenshot ? "✅" : "➖"} Screenshot</li>`,
          `<li>${failedTest.hasTrace ? "✅" : "➖"} Trace</li>`,
          `<li>${failedTest.hasVideo ? "✅" : "➖"} Video</li>`,
          "</ul>",
          "",
          "</details>",
          "",
        );
      }
    }

    lines.push(
      "<blockquote>Full Playwright HTML reports and diagnostic artifacts remain separate CI evidence when artifact upload is available.</blockquote>",
      "",
      "</details>",
      "",
    );

    return lines.join("\n");
  }

  private outcomeIcon(outcome: TestOutcome): string {
    if (outcome === "failed") {
      return "❌";
    }

    if (outcome === "flaky") {
      return "⚠️";
    }

    if (outcome === "skipped") {
      return "⏭";
    }

    return "✅";
  }

  private formatProjectName(projectName: string): string {
    return projectName
      .split(/[-_\s]+/)
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ");
  }

  private toRepositoryRelativePath(filePath: string): string {
    const relative = path.relative(process.cwd(), filePath);

    if (!relative.startsWith("..") && !path.isAbsolute(relative)) {
      return relative.split(path.sep).join("/");
    }

    return path.basename(filePath);
  }

  private escapeHtml(value: string): string {
    return value
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;");
  }
}
