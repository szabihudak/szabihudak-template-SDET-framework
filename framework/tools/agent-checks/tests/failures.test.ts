import assert from "node:assert/strict";
import path from "node:path";
import { test } from "node:test";

import {
  firstLine,
  locate,
  summarizeFailures,
  type PlaywrightReport,
} from "../failures.ts";

const RUNNER = "/home/runner/work/app/app/test-results";
const report: PlaywrightReport = {
  stats: {
    startTime: "2026-11-05T12:00:00.000Z",
    expected: 5,
    unexpected: 1,
    flaky: 1,
    skipped: 0,
  },
  suites: [
    {
      title: "api/login.spec.ts",
      file: "api/login.spec.ts",
      specs: [],
      suites: [
        {
          title: "Login API",
          specs: [
            {
              title: "T001_Login_API: accepts valid credentials",
              line: 12,
              tests: [
                {
                  projectName: "api",
                  status: "expected",
                  results: [{ status: "passed", retry: 0 }],
                },
              ],
            },
            {
              title: "T003_Login_API: rejects a wrong password",
              line: 30,
              tests: [
                {
                  projectName: "api",
                  status: "unexpected",
                  results: [
                    {
                      status: "failed",
                      retry: 0,
                      error: {
                        message:
                          '\u001b[31mError: expect(received).toBe(expected)\u001b[39m\n\nExpected: "Invalid credentials"',
                      },
                      attachments: [
                        {
                          name: "error-context",
                          contentType: "text/markdown",
                          path: `${RUNNER}/login-T003/error-context.md`,
                        },
                      ],
                    },
                    {
                      status: "failed",
                      retry: 1,
                      error: {
                        message: "Error: expect(received).toBe(expected)",
                      },
                      attachments: [
                        {
                          name: "trace",
                          contentType: "application/zip",
                          path: `${RUNNER}/login-T003-retry1/trace.zip`,
                        },
                        {
                          name: "screenshot",
                          contentType: "image/png",
                          path: `${RUNNER}/login-T003-retry1/test-failed-1.png`,
                        },
                      ],
                    },
                  ],
                },
              ],
            },
            {
              title: "checks the health endpoint",
              line: 50,
              tests: [
                {
                  projectName: "api",
                  status: "flaky",
                  results: [
                    {
                      status: "timedOut",
                      retry: 0,
                      errors: [
                        { message: "Test timeout of 30000ms exceeded." },
                      ],
                    },
                    { status: "passed", retry: 1 },
                  ],
                },
              ],
            },
          ],
        },
      ],
    },
  ],
};

test("takes the first non-empty line of an error, without colors", () => {
  assert.equal(
    firstLine("\u001b[31m\n  Error: boom\u001b[39m\nmore"),
    "Error: boom",
  );
  assert.equal(firstLine(undefined), "");
});

test("finds a CI attachment next to the downloaded results file", () => {
  const results =
    "/tmp/ci-analysis/1/attempt-2/artifacts/test-results-api/results.json";
  const expected = path.join(
    path.dirname(results),
    "login-T003-retry1/trace.zip",
  );
  assert.deepEqual(
    locate(
      `${RUNNER}/login-T003-retry1/trace.zip`,
      results,
      (file) => file === expected,
    ),
    { path: expected, exists: true },
  );
  assert.deepEqual(
    locate(`${RUNNER}/missing/trace.zip`, results, () => false),
    { path: `${RUNNER}/missing/trace.zip`, exists: false },
  );
});

test("lists failed and flaky tests with case IDs, retries and attachments", () => {
  const summary = summarizeFailures(
    report,
    "test-results/results.json",
    () => false,
  );

  assert.equal(summary.failed, 1);
  assert.equal(summary.flaky, 1);
  assert.equal(summary.passed, 5);
  assert.equal(summary.failures.length, 2);

  const [failed, flaky] = summary.failures;
  assert.equal(failed.caseId, "T003_Login_API");
  assert.equal(failed.file, "api/login.spec.ts");
  assert.equal(failed.line, 30);
  assert.equal(failed.outcome, "failed");
  assert.equal(failed.attempts, 2);
  assert.equal(failed.error, "Error: expect(received).toBe(expected)");
  assert.deepEqual(
    failed.attachments.map(({ kind, exists }) => [kind, exists]),
    [
      ["error-context", false],
      ["trace", false],
      ["screenshot", false],
    ],
  );

  assert.equal(flaky.caseId, null);
  assert.equal(flaky.outcome, "flaky");
  assert.equal(flaky.error, "Test timeout of 30000ms exceeded.");
});
