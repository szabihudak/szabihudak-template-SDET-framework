import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";

import {
  buildView,
  categorize,
  causeKey,
} from "../../core/reporting/run-report/analyze.ts";
import type {
  ReportMeta,
  RunData,
  TestRecord,
} from "../../core/reporting/run-report/model.ts";
import { renderPage } from "../../core/reporting/run-report/render.ts";
import { readRuns } from "../run-report.ts";

const meta: ReportMeta = {
  title: "Acme Web",
  subtitle: "Regression",
  commit: "abc1234",
  branch: "main",
  runUrl: null,
};

const record = (overrides: Partial<TestRecord>): TestRecord => ({
  project: "chromium",
  file: "tests/ui/checkout.spec.ts",
  line: 10,
  title: "T001_Checkout_UI: pays",
  caseId: "T001_Checkout_UI",
  outcome: "passed",
  durationMs: 1000,
  attempts: 1,
  startedAt: 1_000,
  lane: 0,
  error: null,
  attachments: [],
  ...overrides,
});

const run = (name: string, tests: TestRecord[], startedAt = 0): RunData => ({
  version: 1,
  name,
  environment: "staging",
  startedAt,
  durationMs: 10_000,
  workers: 2,
  tests,
});

const timeout = (ms: number) =>
  `Timed out ${ms}ms waiting for expect(locator).toBeVisible()\nLocator: getByRole('heading')`;

test("guesses the analyst's category from the error", () => {
  assert.equal(categorize("Error: connect ECONNREFUSED 127.0.0.1:3000"), "env");
  assert.equal(categorize("page.goto: net::ERR_NAME_NOT_RESOLVED"), "env");
  assert.equal(
    categorize("TypeError: Cannot read properties of undefined"),
    "test",
  );
  assert.equal(
    categorize("strict mode violation: locator resolved to 2 elements"),
    "test",
  );
  assert.equal(categorize(timeout(5000)), "app");
  assert.equal(categorize("Test timeout of 30000ms exceeded."), "unknown");
});

test("counts the same error in several browsers, with other numbers, as one cause", () => {
  assert.equal(
    causeKey("a.spec.ts", timeout(5000)),
    causeKey("a.spec.ts", timeout(10000)),
  );
  assert.notEqual(
    causeKey("a.spec.ts", timeout(5000)),
    causeKey("b.spec.ts", timeout(5000)),
  );

  const view = buildView(
    [
      run("chromium", [
        record({ outcome: "failed", error: timeout(5000) }),
        record({
          title: "T002_Checkout_UI: ships",
          caseId: "T002_Checkout_UI",
        }),
      ]),
      run("firefox", [
        record({ project: "firefox", outcome: "failed", error: timeout(7000) }),
        record({
          project: "firefox",
          file: "tests/ui/search.spec.ts",
          outcome: "failed",
          error: "TypeError: x is not a function",
        }),
      ]),
    ],
    meta,
  );

  assert.equal(view.causes.length, 2);
  assert.deepEqual(view.causes[0].projects, ["chromium", "firefox"]);
  assert.equal(view.causes[0].tests.length, 2);
  assert.equal(view.causes[0].category, "app");
  assert.deepEqual(view.categories, { app: 2, test: 1, env: 0, unknown: 0 });
});

test("counts outcomes, the pass rate without skipped tests, and the wall time of all runs", () => {
  const view = buildView(
    [
      run(
        "api",
        [
          record({ project: "api" }),
          record({ project: "api", outcome: "flaky", attempts: 2 }),
          record({ project: "api", outcome: "skipped" }),
          record({ project: "api", outcome: "failed", error: "boom" }),
        ],
        1_000,
      ),
      run("ui", [record({ durationMs: 9_000 })], 4_000),
    ],
    meta,
  );

  assert.deepEqual(view.counts, {
    passed: 2,
    failed: 1,
    flaky: 1,
    skipped: 1,
  });
  assert.equal(view.passRate, 0.75);
  assert.equal(view.durationMs, 13_000);
  assert.equal(view.workers, 4);
  assert.deepEqual(
    view.projects.map((project) => project.name),
    ["api", "chromium"],
  );
  assert.equal(view.slowest[0], 4);
  assert.deepEqual(
    view.lanes.map((lane) => lane.name),
    ["api / 1", "ui / 1"],
  );
  assert.match(view.summary, /^## ❌ Acme Web — 1 failed \(75\.0% passed\)/);
  assert.match(view.summary, /\| 2 \| 1 \| 1 \| 1 \|/);
});

test("names a single run's lanes by worker and passes a run without failures", () => {
  const view = buildView(
    [run("local", [record({}), record({ lane: 1 })])],
    meta,
  );

  assert.deepEqual(
    view.lanes.map((lane) => lane.name),
    ["worker 1", "worker 2"],
  );
  assert.equal(view.causes.length, 0);
  assert.match(view.summary, /^## ✅ Acme Web — all passed \(2 tests\)/);
});

test("embeds the data so that no title or error can end the script", () => {
  const view = buildView(
    [
      run("x", [
        record({
          title: "</script><script>alert(1)</script>",
          outcome: "failed",
          error: "<img src=x onerror=alert(1)>",
        }),
      ]),
    ],
    { ...meta, title: "<b>Acme</b>" },
  );
  const page = renderPage(view);

  assert.doesNotMatch(page, /<\/script><script>alert/);
  assert.doesNotMatch(page, /<img src=x/);
  assert.match(page, /<title>&lt;b&gt;Acme&lt;\/b&gt; · Run report<\/title>/);
  assert.doesNotMatch(page, /__RUN_REPORT_DATA__/);
});

test("reads the data files of several jobs and skips other JSON", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "run-report-"));
  fs.mkdirSync(path.join(dir, "nested"));
  fs.writeFileSync(path.join(dir, "api.json"), JSON.stringify(run("api", [])));
  fs.writeFileSync(
    path.join(dir, "nested", "ui.json"),
    JSON.stringify(run("ui", [record({})])),
  );
  fs.writeFileSync(path.join(dir, "other.json"), JSON.stringify({ a: 1 }));

  const warn = console.warn;
  console.warn = () => undefined;
  try {
    assert.deepEqual(
      readRuns(dir).map((data) => data.name),
      ["api", "ui"],
    );
  } finally {
    console.warn = warn;
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
