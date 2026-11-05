import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";

import {
  describeAttempt,
  parseRunReference,
  type ApiArtifact,
  type ApiJob,
  type ApiRun,
} from "../run-attempt.ts";

// A rerun of failed jobs: attempt 1 failed in quality (TEST_ENV not set),
// attempt 2 ran the tests and failed in tests (api).
const run = (attempt: number, started: string): ApiRun => ({
  id: 42020140791,
  run_number: 1,
  run_attempt: attempt,
  name: "Playwright CI",
  event: "push",
  head_sha: "ca52045f00000000000000000000000000000000",
  head_branch: "main",
  status: "completed",
  conclusion: "failure",
  html_url: `https://github.com/owner/repo/actions/runs/42020140791/attempts/${attempt}`,
  run_started_at: started,
});

const jobs: ApiJob[] = [
  {
    id: 2,
    name: "quality",
    status: "completed",
    conclusion: "success",
    html_url: "https://github.com/owner/repo/actions/runs/42020140791/job/2",
  },
  {
    id: 3,
    name: "tests (api)",
    status: "completed",
    conclusion: "failure",
    html_url: "https://github.com/owner/repo/actions/runs/42020140791/job/3",
    steps: [
      { name: "Run tests", number: 9, conclusion: "failure" },
      { name: "Upload report", number: 10, conclusion: "success" },
    ],
  },
  {
    id: 4,
    name: "summary",
    status: "completed",
    conclusion: "skipped",
    html_url: "https://github.com/owner/repo/actions/runs/42020140791/job/4",
  },
];

const artifacts: ApiArtifact[] = [
  {
    id: 10,
    name: "quality-log",
    created_at: "2026-11-05T11:00:30Z",
    expired: false,
    size_in_bytes: 100,
  },
  {
    id: 11,
    name: "test-results-api",
    created_at: "2026-11-05T12:05:00Z",
    expired: false,
    size_in_bytes: 2000,
  },
  {
    id: 12,
    name: "old-report",
    created_at: "2026-11-05T10:59:00Z",
    expired: true,
    size_in_bytes: 10,
  },
];

test("reads a run ID, a run URL and an attempt URL", () => {
  assert.deepEqual(parseRunReference("42020140791"), { run: 42020140791 });
  assert.deepEqual(
    parseRunReference("https://github.com/owner/repo/actions/runs/42020140791"),
    { run: 42020140791 },
  );
  assert.deepEqual(
    parseRunReference(
      "https://github.com/owner/repo/actions/runs/42020140791/attempts/2",
    ),
    { run: 42020140791, attempt: 2 },
  );
  assert.throws(() => parseRunReference("latest"), /Not a GitHub Actions run/);
});

test("describes attempt 2 with its own report folder and only its own artifacts", () => {
  const facts = describeAttempt(
    run(2, "2026-11-05T12:00:00Z"),
    run(2, "2026-11-05T12:00:00Z"),
    jobs,
    artifacts,
    [
      "ci-analysis/42020140791/analysis.md",
      "ci-analysis/42020140791/attempt-1/analysis.md",
    ],
  );

  assert.equal(facts.attempt, 2);
  assert.equal(facts.latestAttempt, 2);
  assert.equal(facts.commit, "ca52045");
  assert.equal(facts.reportDir, "ci-analysis/42020140791/attempt-2");
  assert.deepEqual(facts.failedJobs, [
    {
      id: 3,
      name: "tests (api)",
      url: "https://github.com/owner/repo/actions/runs/42020140791/job/3",
      failedSteps: ["9: Run tests"],
    },
  ]);
  assert.deepEqual(facts.skippedJobs, ["summary"]);
  assert.deepEqual(facts.artifacts, {
    thisAttempt: ["test-results-api"],
    earlierAttempts: ["quality-log"],
    expired: ["old-report"],
  });
  assert.deepEqual(facts.earlierReports, [
    "ci-analysis/42020140791/attempt-1/analysis.md",
  ]);
  assert.equal(facts.legacyReport, "ci-analysis/42020140791/analysis.md");
});

test("an earlier attempt does not list later reports as earlier", () => {
  const facts = describeAttempt(
    run(2, "2026-11-05T12:00:00Z"),
    run(1, "2026-11-05T11:00:00Z"),
    jobs,
    artifacts,
    ["ci-analysis/42020140791/attempt-2/analysis.md"],
  );

  assert.equal(facts.attempt, 1);
  assert.equal(facts.latestAttempt, 2);
  assert.equal(facts.reportDir, "ci-analysis/42020140791/attempt-1");
  assert.deepEqual(facts.earlierReports, []);
  assert.deepEqual(facts.artifacts.thisAttempt, [
    "quality-log",
    "test-results-api",
  ]);
});

test("the analysis template names the run and the attempt the analyst verifies", () => {
  const template = fs.readFileSync(
    path.resolve(
      __dirname,
      "../../../skills/playwright-failure-triage/failure-analysis.template.md",
    ),
    "utf8",
  );
  assert.match(
    template,
    /^# CI failure analysis: <workflow> run #<number>, attempt <n>$/m,
  );
  assert.match(template, /^Run: <run URL> · Attempt: <n> of <attempts>/m);
});
