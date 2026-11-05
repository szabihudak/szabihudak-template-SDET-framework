import fs from "node:fs";
import path from "node:path";

// npm run qa:failures -- [<results.json>] [--json]
//
// The failed and flaky tests of one Playwright run from its JSON report
// (test-results/results.json locally, the same file in a CI run's
// test-results-<job> artifact), with their case IDs, errors, retries and
// which attachments exist on this machine. Used by ci-failure-analyst and
// test-runner (ADR-016). It reads only and decides no cause.

interface ReportAttachment {
  name: string;
  contentType?: string;
  path?: string;
}

interface ReportResult {
  status: string;
  retry: number;
  duration?: number;
  error?: { message?: string };
  errors?: { message?: string }[];
  attachments?: ReportAttachment[];
}

interface ReportTest {
  projectName: string;
  status: string;
  results: ReportResult[];
}

interface ReportSpec {
  title: string;
  file?: string;
  line?: number;
  tests: ReportTest[];
}

interface ReportSuite {
  title: string;
  file?: string;
  specs?: ReportSpec[];
  suites?: ReportSuite[];
}

export interface PlaywrightReport {
  suites?: ReportSuite[];
  stats?: {
    startTime?: string;
    duration?: number;
    expected?: number;
    unexpected?: number;
    flaky?: number;
    skipped?: number;
  };
}

export interface Attachment {
  kind: string;
  path: string;
  exists: boolean;
}

export interface Failure {
  caseId: string | null;
  title: string;
  file: string;
  line: number | null;
  project: string;
  outcome: "failed" | "flaky";
  attempts: number;
  error: string;
  attachments: Attachment[];
}

export interface FailureSummary {
  results: string;
  startTime: string | null;
  passed: number;
  failed: number;
  flaky: number;
  skipped: number;
  failures: Failure[];
}

const CASE_ID = /^([A-Z]\d{3,}_[A-Za-z0-9]+_[A-Za-z0-9]+):\s/;
const ANSI = new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*m`, "g");

export function firstLine(message: string | undefined): string {
  return (
    (message ?? "")
      .replace(ANSI, "")
      .split("\n")
      .map((line) => line.trim())
      .find(Boolean) ?? ""
  );
}

function attachmentKind(attachment: ReportAttachment): string {
  if (attachment.name === "trace") return "trace";
  if (attachment.name === "video") return "video";
  if (attachment.name === "error-context") return "error-context";
  if (attachment.contentType?.startsWith("image/")) return "screenshot";
  return attachment.name;
}

// Attachment paths are absolute on the machine that ran the tests. A CI
// artifact keeps the folder below test-results/, so a path is looked up
// there, next to the results file, when it does not exist as written.
export function locate(
  attachmentPath: string,
  resultsFile: string,
  exists: (file: string) => boolean = fs.existsSync,
): { path: string; exists: boolean } {
  if (exists(attachmentPath)) return { path: attachmentPath, exists: true };

  const marker = "/test-results/";
  const normalized = attachmentPath.split(path.sep).join("/");
  const index = normalized.lastIndexOf(marker);
  if (index >= 0) {
    const candidate = path.join(
      path.dirname(resultsFile),
      normalized.slice(index + marker.length),
    );
    if (exists(candidate)) return { path: candidate, exists: true };
  }
  return { path: attachmentPath, exists: false };
}

function specsOf(
  suite: ReportSuite,
  file: string | undefined,
): {
  spec: ReportSpec;
  file: string;
}[] {
  const here = suite.file ?? file ?? "";
  return [
    ...(suite.specs ?? []).map((spec) => ({ spec, file: spec.file ?? here })),
    ...(suite.suites ?? []).flatMap((child) => specsOf(child, here)),
  ];
}

export function summarizeFailures(
  report: PlaywrightReport,
  resultsFile: string,
  exists: (file: string) => boolean = fs.existsSync,
): FailureSummary {
  const failures: Failure[] = [];

  for (const { spec, file } of (report.suites ?? []).flatMap((suite) =>
    specsOf(suite, undefined),
  )) {
    for (const test of spec.tests) {
      if (test.status !== "unexpected" && test.status !== "flaky") continue;

      const failed = test.results.filter(
        (result) => result.status !== "passed" && result.status !== "skipped",
      );
      const last = failed[failed.length - 1] ?? test.results[0];
      const message =
        last?.error?.message ?? last?.errors?.[0]?.message ?? undefined;

      const attachments = test.results
        .flatMap((result) => result.attachments ?? [])
        .filter(
          (attachment): attachment is ReportAttachment & { path: string } =>
            Boolean(attachment.path),
        )
        .map((attachment) => ({
          kind: attachmentKind(attachment),
          ...locate(attachment.path, resultsFile, exists),
        }));

      failures.push({
        caseId: CASE_ID.exec(spec.title)?.[1] ?? null,
        title: spec.title,
        file,
        line: spec.line ?? null,
        project: test.projectName,
        outcome: test.status === "flaky" ? "flaky" : "failed",
        attempts: test.results.length,
        error: firstLine(message),
        attachments,
      });
    }
  }

  return {
    results: resultsFile,
    startTime: report.stats?.startTime ?? null,
    passed: report.stats?.expected ?? 0,
    failed: report.stats?.unexpected ?? 0,
    flaky: report.stats?.flaky ?? 0,
    skipped: report.stats?.skipped ?? 0,
    failures,
  };
}

function main(): void {
  const args = process.argv.slice(2);
  const json = args.includes("--json");
  const resultsFile = path.resolve(
    args.find((arg) => !arg.startsWith("--")) ?? "test-results/results.json",
  );

  if (!fs.existsSync(resultsFile)) {
    console.error(
      `No Playwright results at ${path.relative(process.cwd(), resultsFile)}: there is no run to analyze.`,
    );
    process.exit(1);
  }

  const summary = summarizeFailures(
    JSON.parse(fs.readFileSync(resultsFile, "utf8")) as PlaywrightReport,
    path.relative(process.cwd(), resultsFile),
  );

  if (json) {
    console.log(JSON.stringify(summary, null, 2));
    return;
  }

  console.log(
    `Results: ${summary.results} · Started: ${summary.startTime ?? "unknown"} · Passed ${summary.passed} · Failed ${summary.failed} · Flaky ${summary.flaky} · Skipped ${summary.skipped}`,
  );
  if (summary.failures.length === 0) {
    console.log("No failed or flaky tests.");
    return;
  }
  for (const failure of summary.failures) {
    console.log(
      `\n${failure.outcome === "flaky" ? "~" : "✘"} ${failure.caseId ?? "(no case ID)"} · ${failure.project} · ${failure.file}${failure.line ? `:${failure.line}` : ""}`,
    );
    console.log(`  ${failure.title}`);
    console.log(
      `  ${failure.outcome}, ${failure.attempts} attempt(s): ${failure.error || "no error message"}`,
    );
    for (const attachment of failure.attachments) {
      console.log(
        `  ${attachment.exists ? "✔" : "✘"} ${attachment.kind}: ${attachment.path}`,
      );
    }
    if (
      !failure.attachments.some((attachment) => attachment.kind === "trace")
    ) {
      console.log(
        "  no trace recorded (traces are kept on the first retry only)",
      );
    }
  }
}

if (require.main === module) main();
