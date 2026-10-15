import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const PLAN_DIR = "test-plans";
const REVIEW_FILE = "review.md";
const VALIDATION_FILE = "validation.md";

const PLAN_REVIEW_CHECK_IDS = [
  "plan-integrity",
  "case-quality",
  "coverage-decisions",
  "evidence-support",
  "template-selection",
  "setup-and-scope",
  "conflicts-and-open-questions",
] as const;
const VALIDATION_CHECK_IDS = [
  "scope-and-files",
  "case-assertions",
  "template-conformance",
  "evidence-and-expected-results",
  "project-boundaries",
] as const;

type Plan = {
  feature: string;
  cases: { id: string }[];
  files: { path: string }[];
};

type PlanContext = { plan: Plan; directory: string; sha256: string };

// The parts of review.md and validation.md the gates read; everything else in
// the report is free text for the human.
type Report = {
  file: string;
  planSha256?: string;
  verdict?: string;
  checks: Map<string, boolean>;
  cases: Map<string, boolean>;
  blockingFindings: string[];
  problems: string[];
};

function fail(message: string): never {
  throw new Error(message);
}

// Each command reports every problem it finds in one run instead of stopping
// at the first.
function failOnProblems(problems: string[]): void {
  if (problems.length === 1) fail(problems[0]);
  if (problems.length > 1) {
    fail(
      `${problems.length} problems:\n${problems.map((problem) => `- ${problem}`).join("\n")}`,
    );
  }
}

function readPlan(feature: string): PlanContext {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(feature)) {
    fail(`Give the feature slug, such as login; got "${feature}"`);
  }
  const directory = path.join(PLAN_DIR, feature);
  const file = path.join(directory, "plan.json");
  if (!fs.existsSync(file)) fail(`No plan at ${file}`);
  const raw = fs.readFileSync(file, "utf8");
  const plan = JSON.parse(raw) as Plan;
  if (plan.feature !== feature) fail(`${file} names feature ${plan.feature}`);
  if (!Array.isArray(plan.cases) || !Array.isArray(plan.files)) {
    fail(`${file} must contain cases and files arrays`);
  }
  return {
    plan,
    directory,
    sha256: createHash("sha256").update(raw).digest("hex"),
  };
}

function parseReport(file: string, requiredChecks: readonly string[]): Report {
  const report: Report = {
    file,
    checks: new Map(),
    cases: new Map(),
    blockingFindings: [],
    problems: [],
  };
  if (!fs.existsSync(file)) {
    report.problems.push(`${file} is missing`);
    return report;
  }
  let section = "";
  for (const line of fs.readFileSync(file, "utf8").split("\n")) {
    const heading = /^## (.+)$/.exec(line);
    if (heading) {
      section = heading[1].trim().toLowerCase();
      continue;
    }
    const hash = /^Plan SHA-256: ([a-f0-9]{64})$/.exec(line);
    if (hash) report.planSha256 = hash[1];
    const verdict = /^Verdict: (PASS|FAIL)$/.exec(line);
    if (verdict) report.verdict = verdict[1];
    const item = /^- \[([ x])\] ([A-Za-z0-9_-]+): \S/.exec(line);
    if (item && section === "checks") {
      if (report.checks.has(item[2]))
        report.problems.push(`${file}: check ${item[2]} is listed twice`);
      report.checks.set(item[2], item[1] === "x");
    } else if (item && section === "cases") {
      if (report.cases.has(item[2]))
        report.problems.push(`${file}: case ${item[2]} is listed twice`);
      report.cases.set(item[2], item[1] === "x");
    }
    if (section === "findings" && line.startsWith("### ")) {
      const finding =
        /^### (\S+) \((blocking|optional), (plan|implementation|environment)\)$/.exec(
          line,
        );
      if (!finding) {
        report.problems.push(
          `${file}: finding heading must read "### <ID> (<blocking|optional>, <plan|implementation|environment>)": ${line}`,
        );
      } else if (finding[2] === "blocking") {
        report.blockingFindings.push(finding[1]);
      }
    }
  }
  if (!report.planSha256)
    report.problems.push(`${file}: missing the "Plan SHA-256: <hash>" line`);
  if (!report.verdict)
    report.problems.push(`${file}: missing the "Verdict: PASS|FAIL" line`);
  const missing = requiredChecks.filter((id) => !report.checks.has(id));
  if (missing.length)
    report.problems.push(`${file}: missing checks: ${missing.join(", ")}`);
  return report;
}

// Problems that keep a well-formed report from passing its gate.
function passProblems(report: Report, context: PlanContext): string[] {
  const problems: string[] = [];
  if (report.planSha256 && report.planSha256 !== context.sha256) {
    problems.push(
      `${report.file} refers to an earlier version of the plan; run the review again`,
    );
  }
  if (report.verdict === "FAIL") problems.push(`${report.file}: verdict FAIL`);
  const failed = [...report.checks].filter(([, passed]) => !passed);
  if (failed.length)
    problems.push(
      `${report.file}: failed checks: ${failed.map(([id]) => id).join(", ")}`,
    );
  if (report.blockingFindings.length)
    problems.push(
      `${report.file}: blocking findings: ${report.blockingFindings.join(", ")}`,
    );
  return problems;
}

function reviewProblems(context: PlanContext): string[] {
  const report = parseReport(
    path.join(context.directory, REVIEW_FILE),
    PLAN_REVIEW_CHECK_IDS,
  );
  return [...report.problems, ...passProblems(report, context)];
}

// Files changed in the working tree and index compared with HEAD, plus new
// untracked files. Plan artifacts and their reports are not implementation
// changes.
function changedInGit(): string[] | undefined {
  try {
    const run = (args: string[]) =>
      execFileSync("git", args, { encoding: "utf8" })
        .split("\n")
        .filter(Boolean);
    return [
      ...new Set([
        ...run(["diff", "--name-only", "HEAD"]),
        ...run(["ls-files", "--others", "--exclude-standard"]),
      ]),
    ].filter((file) => !file.startsWith(`${PLAN_DIR}/`));
  } catch {
    return undefined;
  }
}

function scopeProblems(context: PlanContext): string[] {
  const planned = new Set(context.plan.files.map(({ path: file }) => file));
  const outside = (changedInGit() ?? []).filter((file) => !planned.has(file));
  return outside.length
    ? [`Git shows changes to files outside the plan: ${outside.join(", ")}`]
    : [];
}

function validationProblems(context: PlanContext): string[] {
  const report = parseReport(
    path.join(context.directory, VALIDATION_FILE),
    VALIDATION_CHECK_IDS,
  );
  const problems = [...report.problems, ...passProblems(report, context)];
  const planned = context.plan.cases.map(({ id }) => id);
  const unknown = [...report.cases.keys()].filter(
    (id) => !planned.includes(id),
  );
  if (unknown.length)
    problems.push(
      `${report.file}: cases not in the plan: ${unknown.join(", ")}`,
    );
  const notImplemented = planned.filter((id) => !report.cases.get(id));
  if (notImplemented.length)
    problems.push(
      `${report.file}: cases not marked implemented: ${notImplemented.join(", ")}`,
    );
  return problems;
}

// CI: every committed report is well-formed. Whether it passes for the current
// plan is decided by the stage gates, not here.
function checkAll(): void {
  if (!fs.existsSync(PLAN_DIR)) {
    console.log("✔ no review reports to check");
    return;
  }
  const problems: string[] = [];
  let count = 0;
  for (const entry of fs.readdirSync(PLAN_DIR, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    for (const [name, checks] of [
      [REVIEW_FILE, PLAN_REVIEW_CHECK_IDS],
      [VALIDATION_FILE, VALIDATION_CHECK_IDS],
    ] as const) {
      const file = path.join(PLAN_DIR, entry.name, name);
      if (!fs.existsSync(file)) continue;
      problems.push(...parseReport(file, checks).problems);
      count += 1;
    }
  }
  failOnProblems(problems);
  console.log(`✔ checked ${count} review report(s)`);
}

function main(): void {
  const [, , command, feature] = process.argv;
  try {
    if (command === "check-all") {
      checkAll();
      return;
    }
    if (!feature) {
      fail(
        "Usage: npm run qa:pipeline -- <hash|review|scope|validation> <feature>, or check-all",
      );
    }
    const context = readPlan(feature);
    if (command === "hash") {
      console.log(context.sha256);
    } else if (command === "review") {
      failOnProblems(reviewProblems(context));
      console.log(`✔ plan review passed for ${feature}`);
    } else if (command === "scope") {
      failOnProblems([...reviewProblems(context), ...scopeProblems(context)]);
      console.log(`✔ plan review passed and changes stay in scope: ${feature}`);
    } else if (command === "validation") {
      failOnProblems([
        ...reviewProblems(context),
        ...scopeProblems(context),
        ...validationProblems(context),
      ]);
      console.log(`✔ implementation validation passed for ${feature}`);
    } else {
      fail(`Unknown command ${command}`);
    }
  } catch (caught) {
    console.error(
      `✖ ${caught instanceof Error ? caught.message : String(caught)}`,
    );
    process.exitCode = 1;
  }
}

if (require.main === module) main();
