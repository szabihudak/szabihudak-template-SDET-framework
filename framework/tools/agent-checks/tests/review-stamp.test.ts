import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";

import {
  checkHandoff,
  DELETED,
  EXAMPLES_FILE,
  evaluateHandoff,
  parsePlannedFiles,
  parseReviewedFiles,
  stampReview,
  type HandoffInput,
} from "../handoff.ts";
import { stampFor } from "../review-stamp.ts";

const PLAN = `# Login test plan

## Files

| Layer  | Path                             | Decision | Golden example or template |
| ------ | -------------------------------- | -------- | -------------------------- |
| Client | src/api/clients/AuthApiClient.ts | create   | api-client                 |
| Spec   | tests/api/login.spec.ts          | create   | api-spec                   |
`;

const REVIEW = `# Login test review

Plan: \`test-plans/login.md\` · Commit: abc1234 · Base: main · Date: 2026-11-06
Verdict: PASS

## Findings

None.
`;

const HASH_A = "a".repeat(64);
const HASH_B = "b".repeat(64);
const HASH_C = "c".repeat(64);

const STAMP = {
  "src/api/clients/AuthApiClient.ts": HASH_A,
  "test-plans/login.md": HASH_B,
  "tests/api/login.spec.ts": HASH_C,
};

function input(overrides: Partial<HandoffInput> = {}): HandoffInput {
  const changed = [
    "src/api/clients/AuthApiClient.ts",
    "test-plans/login.md",
    "test-reviews/login.md",
    "tests/api/login.spec.ts",
  ];
  return {
    plan: "test-plans/login.md",
    review: "test-reviews/login.md",
    reviewExists: true,
    verdict: "PASS",
    planned: parsePlannedFiles(PLAN),
    changed,
    // Times that the modification-time check would reject: with a stamp,
    // only the content counts.
    modified: Object.fromEntries(
      changed.map((file) => [
        file,
        file === "test-reviews/login.md" ? 1000 : 9000,
      ]),
    ),
    reviewed: { ...STAMP },
    hashes: { ...STAMP },
    ...overrides,
  };
}

test("writes a Reviewed files table that reads back, and replaces it on a second run", () => {
  const stamped = stampReview(REVIEW, STAMP);
  assert.ok(stamped.startsWith(REVIEW.trimEnd()));
  assert.match(stamped, /\n## Reviewed files\n/);
  assert.match(
    stamped,
    /^\| `src\/api\/clients\/AuthApiClient\.ts` \| a{64} \|$/m,
  );
  assert.deepEqual(parseReviewedFiles(stamped), STAMP);

  const again = stampReview(stamped, { "test-plans/login.md": HASH_A });
  assert.equal(again.match(/## Reviewed files/g)?.length, 1);
  assert.deepEqual(parseReviewedFiles(again), {
    "test-plans/login.md": HASH_A,
  });
  assert.equal(parseReviewedFiles(REVIEW), undefined);
});

test("keeps a section that follows the stamp", () => {
  const stamped = stampReview(REVIEW, STAMP);
  const withNotes = `${stamped}\n## Notes\n\nKeep me.\n`;
  const restamped = stampReview(withNotes, STAMP);
  assert.match(restamped, /## Notes\n\nKeep me\.\n$/);
  assert.equal(restamped.match(/## Reviewed files/g)?.length, 1);
});

test("aligns the table the way Prettier does", () => {
  const lines = stampReview(REVIEW, {
    "a.ts": HASH_A,
    "src/longer/path.ts": HASH_B,
  })
    .split("\n")
    .filter((line) => line.startsWith("|"));
  assert.equal(new Set(lines.map((line) => line.length)).size, 1);
  assert.match(lines[1], /^\| -+ \| -{64} \|$/);
});

test("hands off when every file still has its stamped content, whatever its time", () => {
  const result = evaluateHandoff(input());
  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.warnings, []);
  assert.equal(result.ok, true);
});

test("stops on a file whose content changed, was deleted or was never reviewed", () => {
  const changed = evaluateHandoff(
    input({ hashes: { ...STAMP, "tests/api/login.spec.ts": HASH_A } }),
  );
  assert.equal(changed.ok, false);
  assert.match(
    changed.errors.join("\n"),
    /login\.spec\.ts changed after the review/,
  );

  const deleted = evaluateHandoff(
    input({
      hashes: { ...STAMP, "src/api/clients/AuthApiClient.ts": DELETED },
    }),
  );
  assert.match(
    deleted.errors.join("\n"),
    /AuthApiClient\.ts was deleted after the review/,
  );

  const withoutPlan = Object.fromEntries(
    Object.entries(STAMP).filter(([file]) => file !== "test-plans/login.md"),
  );
  const unreviewed = evaluateHandoff(input({ reviewed: withoutPlan }));
  assert.match(
    unreviewed.errors.join("\n"),
    /test-plans\/login\.md is not in the review's Reviewed files/,
  );
});

test("stops on a review whose Reviewed files section was never stamped", () => {
  const result = evaluateHandoff(input({ reviewed: {} }));
  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), /empty Reviewed files section/);
});

test("ignores the review itself and the approved examples", () => {
  const result = evaluateHandoff(
    input({
      changed: [...input().changed, EXAMPLES_FILE],
      examples: { base: [], current: [] },
    }),
  );
  assert.deepEqual(result.errors, []);
});

test("falls back to modification times, with a warning, for a review without a stamp", () => {
  const result = evaluateHandoff(input({ reviewed: undefined }));
  assert.equal(result.ok, false);
  assert.match(result.warnings.join("\n"), /no Reviewed files stamp/);
  assert.match(result.errors.join("\n"), /changed after the review \(/);
});

test("stamps a real repository and catches a change that keeps the file's time", () => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), "qa-review-stamp-"));
  const git = (...args: string[]) =>
    execFileSync("git", args, { cwd: repo, encoding: "utf8" });
  const write = (file: string, content: string) => {
    fs.mkdirSync(path.dirname(path.join(repo, file)), { recursive: true });
    fs.writeFileSync(path.join(repo, file), content);
  };

  try {
    git("init", "-q", "-b", "main");
    git("config", "user.email", "selftest@example.com");
    git("config", "user.name", "Self-test");
    write("README.md", "# Project\n");
    git("add", "-A");
    git("commit", "-q", "-m", "initial");

    write("test-plans/login.md", PLAN);
    write("src/api/clients/AuthApiClient.ts", "export {};\n");
    write("tests/api/login.spec.ts", "export {};\n");
    write("test-reviews/login.md", REVIEW);

    const stamp = stampFor("test-plans/login.md", repo, "main");
    assert.deepEqual(stamp.errors, []);
    assert.deepEqual(Object.keys(stamp.hashes), [
      "src/api/clients/AuthApiClient.ts",
      "test-plans/login.md",
      "tests/api/login.spec.ts",
    ]);
    const reviewFile = path.join(repo, "test-reviews/login.md");
    fs.writeFileSync(
      reviewFile,
      stampReview(fs.readFileSync(reviewFile, "utf8"), stamp.hashes),
    );
    // An older review would fail the modification-time check.
    const past = new Date(Date.now() - 60_000);
    fs.utimesSync(reviewFile, past, past);

    const ready = checkHandoff("test-plans/login.md", repo, "main");
    assert.deepEqual(ready.errors, []);
    assert.deepEqual(ready.warnings, []);

    const spec = path.join(repo, "tests/api/login.spec.ts");
    const { mtime } = fs.statSync(spec);
    fs.writeFileSync(spec, "export const edited = true;\n");
    fs.utimesSync(spec, mtime, mtime);
    const blocked = checkHandoff("test-plans/login.md", repo, "main");
    assert.equal(blocked.ok, false);
    assert.match(
      blocked.errors.join("\n"),
      /login\.spec\.ts changed after the review/,
    );
  } finally {
    fs.rmSync(repo, { recursive: true, force: true });
  }
});

test("refuses to stamp without a plan or a review", () => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), "qa-review-stamp-"));
  try {
    const result = stampFor("test-plans/login.md", repo, "HEAD");
    assert.match(result.errors.join("\n"), /no plan at test-plans\/login\.md/);
    assert.match(result.errors.join("\n"), /no review report/);
  } finally {
    fs.rmSync(repo, { recursive: true, force: true });
  }
});
