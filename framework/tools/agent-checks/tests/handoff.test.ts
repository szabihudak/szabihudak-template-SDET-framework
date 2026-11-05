import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";

import {
  checkHandoff,
  EXAMPLES_FILE,
  evaluateHandoff,
  parsePlannedFiles,
  parseVerdict,
  type HandoffInput,
} from "../handoff.ts";

const PLAN = `# Login test plan

## Cases

| ID | Level |
| --- | --- |
| T001_Login_API | API |

## Files

| Layer   | Path                                 | Decision                       | Golden example or template |
| ------- | ------------------------------------ | ------------------------------ | -------------------------- |
| Schema  | \`src/api/schemas/LoginSchema.ts\`     | create: no login schema yet    | request-schema             |
| Client  | src/api/clients/AuthApiClient.ts     | extend: adds login             | api-client                 |
| Fixture | src/fixtures/test-fixtures.ts        | reuse: authApi exists          | app-fixtures               |
| Factory | none                                 | not needed: no request data    | factory                    |
| Spec    | tests/api/login.spec.ts              | create                         | api-spec                   |

## Open questions

- none
`;

const REVIEW_PASS = `# Login test review

Plan: \`test-plans/login.md\` · Commit: abc1234 · Base: main · Date: 2026-11-05
Verdict: PASS
`;

function input(overrides: Partial<HandoffInput> = {}): HandoffInput {
  const changed = [
    "src/api/clients/AuthApiClient.ts",
    "src/api/schemas/LoginSchema.ts",
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
    modified: Object.fromEntries(
      changed.map((file) => [
        file,
        file === "test-reviews/login.md" ? 2000 : 1000,
      ]),
    ),
    ...overrides,
  };
}

test("reads the verdict of a review report", () => {
  assert.equal(parseVerdict(REVIEW_PASS), "PASS");
  assert.equal(parseVerdict("Verdict: CHANGES NEEDED\n"), "CHANGES NEEDED");
  assert.equal(parseVerdict("# Review without a verdict\n"), "missing");
});

test("reads the Files table of a plan, without its header and none rows", () => {
  assert.deepEqual(
    parsePlannedFiles(PLAN).map(({ path: file }) => file),
    [
      "src/api/schemas/LoginSchema.ts",
      "src/api/clients/AuthApiClient.ts",
      "src/fixtures/test-fixtures.ts",
      "tests/api/login.spec.ts",
    ],
  );
});

test("hands off a PASS review with only the planned files", () => {
  const result = evaluateHandoff(input());
  assert.deepEqual(result.errors, []);
  assert.equal(result.ok, true);
  assert.equal(result.files.length, 5);
});

test("stops on a review that is not PASS", () => {
  const result = evaluateHandoff(input({ verdict: "CHANGES NEEDED" }));
  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), /CHANGES NEEDED/);
});

test("stops without a review report", () => {
  const result = evaluateHandoff(
    input({ reviewExists: false, verdict: "missing" }),
  );
  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), /no review report/);
});

test("stops on a changed file outside the plan, and on a reused file", () => {
  const result = evaluateHandoff(
    input({
      changed: [
        ...input().changed,
        "README.md",
        "src/fixtures/test-fixtures.ts",
      ],
    }),
  );
  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), /not in the plan.*README\.md/);
  assert.match(result.errors.join("\n"), /test-fixtures\.ts/);
});

test("never hands off .env, run outputs or reports, but allows .env.example in the plan", () => {
  const result = evaluateHandoff(
    input({
      changed: [
        ...input().changed,
        ".env",
        "test-runs/20261105/summary.md",
        "ci-analysis/1/attempt-1/analysis.md",
        "test-results/results.json",
      ],
    }),
  );
  const errors = result.errors.filter((error) => error.startsWith("never"));
  assert.equal(errors.length, 4);
});

test("stops when a file changed after the review", () => {
  const base = input();
  const result = evaluateHandoff({
    ...base,
    modified: { ...base.modified, "tests/api/login.spec.ts": 3000 },
  });
  assert.equal(result.ok, false);
  assert.match(
    result.errors.join("\n"),
    /login\.spec\.ts changed after the review/,
  );
});

test("warns about a planned file that did not change", () => {
  const base = input();
  const result = evaluateHandoff({
    ...base,
    changed: base.changed.filter(
      (file) => file !== "src/api/clients/AuthApiClient.ts",
    ),
  });
  assert.equal(result.ok, true);
  assert.match(result.warnings.join("\n"), /AuthApiClient\.ts/);
});

test("checks a real repository against its default branch", () => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), "qa-handoff-"));
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
    write("src/api/schemas/LoginSchema.ts", "export {};\n");
    write("src/api/clients/AuthApiClient.ts", "export {};\n");
    write("tests/api/login.spec.ts", "export {};\n");
    const past = new Date(Date.now() - 60_000);
    for (const file of [
      "test-plans/login.md",
      "src/api/schemas/LoginSchema.ts",
      "src/api/clients/AuthApiClient.ts",
      "tests/api/login.spec.ts",
    ]) {
      fs.utimesSync(path.join(repo, file), past, past);
    }
    write("test-reviews/login.md", REVIEW_PASS);

    const ready = checkHandoff("test-plans/login.md", repo);
    assert.equal(ready.base, "main");
    assert.deepEqual(ready.errors, []);

    write("README.md", "# Project, edited\n");
    const blocked = checkHandoff("test-plans/login.md", repo);
    assert.equal(blocked.ok, false);
    assert.match(blocked.errors.join("\n"), /README\.md/);
  } finally {
    fs.rmSync(repo, { recursive: true, force: true });
  }
});

// The skills' templates are what planners and reviewers write from; the
// hand-off reads them, so their formats are checked here.
const SKILLS = path.resolve(__dirname, "../../../skills");

test("reads the Files table and the verdict in the formats the skills' templates write", () => {
  const plan = fs.readFileSync(
    path.join(SKILLS, "test-plan-writing/test-plan.template.md"),
    "utf8",
  );
  const filesHeader = plan
    .split("## Files")[1]
    ?.split("\n")
    .find((line) => line.startsWith("|"));
  assert.ok(filesHeader, "the plan template has no Files table");
  const columns = filesHeader
    .replace(/^\||\|$/g, "")
    .split("|")
    .map((cell) => cell.trim());
  assert.equal(columns[1], "Path");
  assert.equal(columns[2], "Decision");
  assert.equal(columns[3], "Golden example or template");

  const review = fs.readFileSync(
    path.join(SKILLS, "test-review-checklist/test-review.template.md"),
    "utf8",
  );
  assert.match(review, /^Verdict: PASS \/ CHANGES NEEDED$/m);
  assert.equal(
    parseVerdict(review.replace("PASS / CHANGES NEEDED", "PASS")),
    "PASS",
  );
});

const EXAMPLE = {
  id: "api-spec",
  need: "Spec for Login (test-plans/login.md)",
  file: "tests/api/login.spec.ts",
};

test("hands off new approved examples for the plan's own files", () => {
  const base = input();
  const result = evaluateHandoff({
    ...base,
    changed: [...base.changed, EXAMPLES_FILE],
    modified: { ...base.modified, [EXAMPLES_FILE]: 5000 },
    examples: { base: [], current: [EXAMPLE] },
  });
  assert.deepEqual(result.errors, []);
  assert.ok(result.files.includes(EXAMPLES_FILE));
});

test("refuses approved examples for other files, and changed existing ones", () => {
  const base = input();
  const foreign = evaluateHandoff({
    ...base,
    changed: [...base.changed, EXAMPLES_FILE],
    examples: {
      base: [],
      current: [{ ...EXAMPLE, file: "tests/api/orders.spec.ts" }],
    },
  });
  assert.match(
    foreign.errors.join("\n"),
    /outside this plan.*orders\.spec\.ts/,
  );

  const changed = evaluateHandoff({
    ...base,
    changed: [...base.changed, EXAMPLES_FILE],
    examples: { base: [EXAMPLE], current: [{ ...EXAMPLE, need: "renamed" }] },
  });
  assert.match(changed.errors.join("\n"), /existing example was changed/);
});

test("reads the layer and template id of every planned file", () => {
  const spec = parsePlannedFiles(PLAN).find(
    (row) => row.path === "tests/api/login.spec.ts",
  );
  assert.deepEqual(spec, {
    layer: "Spec",
    path: "tests/api/login.spec.ts",
    decision: "create",
    template: "api-spec",
  });
});
