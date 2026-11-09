import fs from "node:fs";
import path from "node:path";

import type {
  FullConfig,
  FullResult,
  Reporter,
  Suite,
  TestCase,
  TestResult,
} from "@playwright/test/reporter";

import { getFrameworkConfig } from "../config/frameworkConfig";
import type { RunData, TestOutcome, TestRecord } from "./run-report/model";
import { reportMeta, writeReport } from "./run-report/render";

// The run report (ADR-020). Writes this run's tests to run-report/data and
// the report of this run to run-report/index.html. In CI every test job
// uploads its data file, and the run-report job draws one report of all of
// them with npm run qa:run-report.

const OUT_DIR = "run-report";
const CASE_ID = /^([A-Z]\d{3,}_[A-Za-z0-9]+_[A-Za-z0-9]+):\s/;
const ANSI = /\u001b\[[0-9;]*m/g;
const ERROR_LINES = 12;
const ATTACHMENTS = new Set(["screenshot", "video", "trace"]);

export default class RunReportReporter implements Reporter {
  private startedAt = Date.now();
  private workers = 1;
  private name = "run";
  private readonly results = new Map<string, TestResult[]>();
  private readonly tests = new Map<string, TestCase>();

  onBegin(config: FullConfig, suite: Suite): void {
    this.startedAt = Date.now();
    this.workers = config.workers;
    const projects = [
      ...new Set(
        suite.allTests().map((test) => test.parent.project()?.name ?? ""),
      ),
    ].filter(Boolean);
    const shard = config.shard ? `-${config.shard.current}` : "";
    this.name = `${projects.join("+") || "run"}${shard}`;
  }

  onTestEnd(test: TestCase, result: TestResult): void {
    this.tests.set(test.id, test);
    this.results.set(test.id, [...(this.results.get(test.id) ?? []), result]);
  }

  onEnd(result: FullResult): void {
    try {
      const run: RunData = {
        version: 1,
        name: this.name,
        environment: process.env.TEST_ENV ?? null,
        startedAt: this.startedAt,
        durationMs: Math.round(result.duration),
        workers: this.workers,
        tests: [...this.tests.values()].map((test) =>
          this.toRecord(test, this.results.get(test.id) ?? []),
        ),
      };

      const dataFile = path.join(
        OUT_DIR,
        "data",
        `${this.name.replace(/[^\w.+-]/g, "_")}.json`,
      );
      fs.rmSync(path.join(OUT_DIR, "data"), { recursive: true, force: true });
      fs.mkdirSync(path.dirname(dataFile), { recursive: true });
      fs.writeFileSync(dataFile, JSON.stringify(run));

      writeReport(OUT_DIR, [run], reportMeta(getFrameworkConfig()));
    } catch (error) {
      // The report never fails a run; its absence is the signal.
      console.warn(
        `Run report not written: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  private toRecord(test: TestCase, results: TestResult[]): TestRecord {
    const last = results.at(-1);
    const failedAttempt = [...results]
      .reverse()
      .find((attempt) => attempt.errors.length > 0);
    const error = failedAttempt?.errors[0];
    const message = (error?.message ?? error?.value ?? "")
      .replace(ANSI, "")
      .split("\n")
      .slice(0, ERROR_LINES)
      .join("\n")
      .trim();

    return {
      project: test.parent.project()?.name ?? "",
      file: this.relative(test.location.file),
      line: test.location.line,
      title: test.title,
      caseId: CASE_ID.exec(test.title)?.[1] ?? null,
      outcome: this.outcome(test, last),
      durationMs: last?.duration ?? 0,
      attempts: results.length,
      startedAt: (last?.startTime ?? new Date(this.startedAt)).getTime(),
      lane: last?.parallelIndex ?? 0,
      error: failedAttempt ? message || "No error message was recorded." : null,
      attachments: (failedAttempt?.attachments ?? [])
        .filter((attachment) => ATTACHMENTS.has(attachment.name))
        .flatMap((attachment) =>
          attachment.path
            ? [{ name: attachment.name, path: this.relative(attachment.path) }]
            : [],
        ),
    };
  }

  private outcome(test: TestCase, last: TestResult | undefined): TestOutcome {
    const outcome = test.outcome();
    if (outcome === "flaky") {
      return "flaky";
    }
    if (outcome === "skipped" || last?.status === "skipped") {
      return "skipped";
    }
    return outcome === "unexpected" ? "failed" : "passed";
  }

  private relative(file: string): string {
    return path.relative(process.cwd(), file).split(path.sep).join("/");
  }
}
