import fs from "node:fs";
import path from "node:path";

import type {
  FullResult,
  Reporter,
  TestCase,
  TestResult,
} from "@playwright/test/reporter";

import type {
  FailureArtifact,
  FailureEvidence,
} from "../models/FailureEvidence";
import { sanitizePath, sanitizeText } from "../utils/failureEvidenceSanitizer";

export default class FailureEvidenceReporter implements Reporter {
  onTestEnd(test: TestCase, result: TestResult): void {
    if (result.status !== "failed") {
      return;
    }

    const failure = result.errors[0];

    const artifacts: FailureArtifact[] = result.attachments
      .filter(
        (attachment) =>
          attachment.path &&
          ["trace", "screenshot", "video"].includes(attachment.name),
      )
      .map((attachment) => ({
        type: attachment.name as FailureArtifact["type"],
        path: sanitizePath(attachment.path!),
      }));

    const evidence: FailureEvidence = {
      test: {
        title: test.title,
        file: sanitizePath(test.location.file),
        project: test.parent.project()?.name ?? "unknown",
      },
      execution: {
        environment: process.env.TEST_ENV ?? "unknown",
        retry: result.retry,
      },
      failure: {
        message: sanitizeText(failure?.message ?? "Unknown test failure"),
        stack: failure?.stack ? sanitizeText(failure.stack) : undefined,
      },
      artifacts,
    };

    const outputDir = path.resolve("test-results", "ai-failure-evidence");

    fs.mkdirSync(outputDir, { recursive: true });

    const safeTitle = test.title
      .replace(/[^a-zA-Z0-9-_]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .toLowerCase();

    const outputPath = path.join(
      outputDir,
      `${safeTitle || "failed-test"}-${result.retry}.json`,
    );

    fs.writeFileSync(outputPath, JSON.stringify(evidence, null, 2), "utf8");
  }

  onEnd(_result: FullResult): void {
    // Intentionally no run-level behavior yet.
  }
}
