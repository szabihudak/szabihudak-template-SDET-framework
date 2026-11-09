// The run report (ADR-020): one Playwright run's tests as a data file, and
// the view of one or more such files (the jobs of a CI run) that the report
// page draws.

export type TestOutcome = "passed" | "failed" | "flaky" | "skipped";

export type FailureCategory = "app" | "test" | "env" | "unknown";

export interface TestAttachment {
  name: string;
  // A copy in the report folder, relative to it, so the report carries it.
  path: string;
}

export interface TestRecord {
  project: string;
  file: string;
  line: number;
  title: string;
  caseId: string | null;
  outcome: TestOutcome;
  // Of the last attempt; a flaky test's is the one that passed.
  durationMs: number;
  attempts: number;
  // Of the last attempt, where the timeline draws the test.
  startedAt: number;
  // The worker slot of the last attempt, for the timeline.
  lane: number;
  // The first error of the last failed attempt, without colors.
  error: string | null;
  attachments: TestAttachment[];
}

// One Playwright run: a local run, or one job of a CI run.
export interface RunData {
  version: 1;
  // Names the run's lanes in the timeline: its projects, or the CI job.
  name: string;
  environment: string | null;
  startedAt: number;
  durationMs: number;
  workers: number;
  tests: TestRecord[];
}

export interface ReportMeta {
  title: string;
  subtitle: string;
  commit: string | null;
  branch: string | null;
  // The CI run's page, whose artifacts hold the traces, screenshots and videos.
  runUrl: string | null;
}

export interface RootCause {
  file: string;
  category: FailureCategory;
  error: string;
  projects: string[];
  tests: number[];
}

export interface Lane {
  name: string;
  tests: number[];
}

export interface ReportView {
  meta: ReportMeta;
  environment: string | null;
  startedAt: number;
  // Wall time from the first run's start to the last run's end.
  durationMs: number;
  runs: number;
  workers: number;
  counts: Record<TestOutcome, number>;
  passRate: number;
  projects: { name: string; tests: number[] }[];
  causes: RootCause[];
  categories: Record<FailureCategory, number>;
  lanes: Lane[];
  slowest: number[];
  tests: TestRecord[];
  summary: string;
}
