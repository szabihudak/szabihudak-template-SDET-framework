import fs from "node:fs";
import path from "node:path";

import type {
  FullResult,
  Reporter,
  Suite,
  TestCase,
  TestResult,
} from "@playwright/test/reporter";

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

    const failedTests: FailedTestSummary[] = [];

    for (const test of this.tests.values()) {
      const outcome = test.outcome();

      if (outcome === "expected") {
        const latestResult = this.latestResults.get(test.id);

        if (latestResult?.status === "skipped") {
          counts.skipped += 1;
        } else {
          counts.passed += 1;
        }

        continue;
      }

      if (outcome === "flaky") {
        counts.flaky += 1;
        continue;
      }

      if (outcome === "skipped") {
        counts.skipped += 1;
        continue;
      }

      if (outcome === "unexpected") {
        counts.failed += 1;

        const latestResult = this.latestResults.get(test.id);

        if (latestResult) {
          failedTests.push(this.toFailedTestSummary(test, latestResult));
        }
      }
    }

    const durationMs = Date.now() - this.startedAt;
    const markdown = this.buildMarkdown(
      result,
      counts,
      failedTests,
      durationMs,
    );

    const outputPath = path.resolve("test-results", "github-summary.md");

    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, markdown, "utf8");
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

  private buildMarkdown(
    result: FullResult,
    counts: {
      passed: number;
      failed: number;
      flaky: number;
      skipped: number;
    },
    failedTests: FailedTestSummary[],
    durationMs: number,
  ): string {
    const statusIcon = result.status === "passed" ? "✅" : "❌";
    const durationSeconds = (durationMs / 1000).toFixed(1);

    const lines = [
      `## 🧪 Playwright Test Summary — ${this.projectName}`,
      "",
      `${statusIcon} **Run status:** ${result.status}`,
      "",
      "| Result | Count |",
      "| --- | ---: |",
      `| ✅ Passed | ${counts.passed} |`,
      `| ❌ Failed | ${counts.failed} |`,
      `| ⚠️ Flaky | ${counts.flaky} |`,
      `| ⏭ Skipped | ${counts.skipped} |`,
      "",
      `**Duration:** ${durationSeconds}s`,
    ];

    if (failedTests.length > 0) {
      lines.push("", "### ❌ Failed Tests", "");

      for (const failedTest of failedTests) {
        lines.push(
          `<details>`,
          `<summary>${this.escapeMarkdown(failedTest.title)}</summary>`,
          "",
          `**Location:** \`${failedTest.file}:${failedTest.line}\`  `,
          `**Retry:** ${failedTest.retry}`,
          "",
          "```text",
          this.escapeCodeBlock(failedTest.errorMessage),
          "```",
          "",
          "**Diagnostics**",
          "",
          `- ${failedTest.hasScreenshot ? "✅" : "➖"} Screenshot`,
          `- ${failedTest.hasTrace ? "✅" : "➖"} Trace`,
          `- ${failedTest.hasVideo ? "✅" : "➖"} Video`,
          "",
          "</details>",
          "",
        );
      }
    }

    lines.push(
      "",
      "> Full Playwright HTML reports and diagnostic artifacts remain separate CI evidence when artifact upload is available.",
      "",
    );

    return lines.join("\n");
  }

  private toRepositoryRelativePath(filePath: string): string {
    const relative = path.relative(process.cwd(), filePath);

    if (!relative.startsWith("..") && !path.isAbsolute(relative)) {
      return relative.split(path.sep).join("/");
    }

    return path.basename(filePath);
  }

  private escapeMarkdown(value: string): string {
    return value
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;");
  }

  private escapeCodeBlock(value: string): string {
    return value.replaceAll("```", "'''");
  }
}
