import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { Type, type TSchema } from "@sinclair/typebox";

import { validateSchema } from "../core/api/SchemaValidator";

const PLAN_REVIEW_CHECK_IDS = [
  "plan-integrity",
  "case-quality",
  "coverage-decisions",
  "evidence-support",
  "template-selection",
  "setup-and-scope",
  "conflicts-and-open-questions",
] as const;
const IMPLEMENTATION_REVIEW_CHECK_IDS = [
  "plan-build-identity",
  "scope-and-files",
  "case-assertions",
  "template-conformance",
  "evidence-and-expected-results",
  "project-boundaries",
] as const;
// Technical gates every build report records; one Playwright check per
// project the plan's cases run in is added to these.
const BUILD_GATE_IDS = [
  "plan-check",
  "prettier",
  "typecheck",
  "architecture",
  "plan-check-all",
  "templates",
] as const;
const reportIdentity = {
  schemaVersion: Type.Literal(1),
  feature: Type.String({ pattern: "^[a-z0-9]+(?:-[a-z0-9]+)*$" }),
  planPath: Type.String({ minLength: 1 }),
  planSha256: Type.String({ pattern: "^[a-f0-9]{64}$" }),
};

const reviewCheckSchema = Type.Object(
  {
    id: Type.String({ minLength: 1 }),
    status: Type.Union([Type.Literal("passed"), Type.Literal("failed")]),
    summary: Type.String({ minLength: 1 }),
  },
  { additionalProperties: false },
);

const findingSchema = Type.Object(
  {
    id: Type.String({ minLength: 1 }),
    severity: Type.Union([Type.Literal("blocking"), Type.Literal("optional")]),
    category: Type.Union([
      Type.Literal("plan"),
      Type.Literal("implementation"),
      Type.Literal("environment"),
    ]),
    location: Type.String({ minLength: 1 }),
    rule: Type.String({ minLength: 1 }),
    problem: Type.String({ minLength: 1 }),
    requiredChange: Type.String({ minLength: 1 }),
  },
  { additionalProperties: false },
);

const planReviewSchema = Type.Object(
  {
    ...reportIdentity,
    verdict: Type.Union([Type.Literal("PASS"), Type.Literal("FAIL")]),
    reviewChecks: Type.Array(reviewCheckSchema),
    findings: Type.Array(findingSchema),
    unresolvedQuestions: Type.Array(Type.String({ minLength: 1 })),
  },
  { additionalProperties: false },
);

const buildReportSchema = Type.Object(
  {
    ...reportIdentity,
    attempt: Type.Integer({ minimum: 1 }),
    status: Type.Union([Type.Literal("passed"), Type.Literal("failed")]),
    changedFiles: Type.Array(
      Type.Object(
        {
          path: Type.String({ minLength: 1 }),
          change: Type.Union([
            Type.Literal("created"),
            Type.Literal("modified"),
          ]),
          exampleOrTemplateId: Type.Union([Type.String(), Type.Null()]),
          summary: Type.String({ minLength: 1 }),
        },
        { additionalProperties: false },
      ),
    ),
    implementedCases: Type.Array(
      Type.Object(
        {
          caseId: Type.String({ minLength: 1 }),
          files: Type.Array(Type.String({ minLength: 1 }), { minItems: 1 }),
        },
        { additionalProperties: false },
      ),
    ),
    checks: Type.Array(
      Type.Object(
        {
          id: Type.String({ minLength: 1 }),
          command: Type.String({ minLength: 1 }),
          status: Type.Union([
            Type.Literal("passed"),
            Type.Literal("failed"),
            Type.Literal("notRun"),
          ]),
          resultLine: Type.String({ minLength: 1 }),
        },
        { additionalProperties: false },
      ),
    ),
    deviations: Type.Array(Type.String({ minLength: 1 })),
    unresolvedQuestions: Type.Array(Type.String({ minLength: 1 })),
    evidencePaths: Type.Array(Type.String({ minLength: 1 })),
  },
  { additionalProperties: false },
);

const validationReportSchema = Type.Object(
  {
    ...reportIdentity,
    buildReportPath: Type.String({ minLength: 1 }),
    buildReportSha256: Type.String({ pattern: "^[a-f0-9]{64}$" }),
    verdict: Type.Union([Type.Literal("PASS"), Type.Literal("FAIL")]),
    reviewChecks: Type.Array(reviewCheckSchema),
    caseCoverage: Type.Array(
      Type.Object(
        {
          caseId: Type.String({ minLength: 1 }),
          files: Type.Array(Type.String({ minLength: 1 })),
          status: Type.Union([
            Type.Literal("implemented"),
            Type.Literal("missing"),
            Type.Literal("outOfScope"),
          ]),
          summary: Type.String({ minLength: 1 }),
        },
        { additionalProperties: false },
      ),
    ),
    findings: Type.Array(findingSchema),
    evidenceOpened: Type.Array(Type.String({ minLength: 1 })),
    unverified: Type.Array(Type.String({ minLength: 1 })),
  },
  { additionalProperties: false },
);

type Plan = {
  feature: string;
  cases: { id: string; project: string }[];
  files: { path: string; exampleOrTemplateId: string | null }[];
};

type PlanContext = {
  plan: Plan;
  path: string;
  sha256: string;
  runDirectory: string;
};

type Identity = {
  feature: string;
  planPath: string;
  planSha256: string;
};

function fail(message: string): never {
  throw new Error(message);
}

function relativePath(file: string): string {
  const relative = path.relative(process.cwd(), path.resolve(file));
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    return fail("Pipeline artifacts must remain inside the repository");
  }
  return relative.split(path.sep).join("/");
}

function readPlan(file: string): PlanContext {
  const absolute = path.resolve(file);
  const relative = relativePath(absolute);
  const raw = fs.readFileSync(absolute, "utf8");
  const plan = JSON.parse(raw) as Plan;
  const expectedPath = `test-plans/${plan.feature}/plan.json`;
  if (relative !== expectedPath) fail(`Plan must be stored at ${expectedPath}`);
  if (!Array.isArray(plan.cases) || !Array.isArray(plan.files)) {
    fail("Plan must contain cases and files arrays");
  }
  const sha256 = createHash("sha256").update(raw).digest("hex");
  return {
    plan,
    path: relative,
    sha256,
    runDirectory: path.join("pipeline-runs", plan.feature, sha256),
  };
}

function readJson(file: string, schema: TSchema): Record<string, any> {
  const value: unknown = JSON.parse(fs.readFileSync(file, "utf8"));
  validateSchema(schema, value);
  return value as Record<string, any>;
}

function readMatchingReport(
  context: PlanContext,
  file: string,
  schema: TSchema,
): Record<string, any> {
  const absolute = path.resolve(file);
  const root = path.resolve(context.runDirectory);
  if (absolute !== root && !absolute.startsWith(`${root}${path.sep}`)) {
    fail(`Report must be stored under ${context.runDirectory}`);
  }
  const report = readJson(absolute, schema);
  const identity = report as Identity;
  if (
    identity.feature !== context.plan.feature ||
    identity.planPath !== context.path ||
    identity.planSha256 !== context.sha256
  ) {
    fail(`Report ${relativePath(absolute)} refers to a different plan version`);
  }
  return report;
}

// Returns the problem as a message, so each command reports every problem it
// finds in one run instead of stopping at the first.
function duplicates(values: string[], label: string): string[] {
  return new Set(values).size !== values.length
    ? [`${label} must be unique`]
    : [];
}

function failOnProblems(problems: string[]): void {
  if (problems.length === 1) fail(problems[0]);
  if (problems.length > 1) {
    fail(
      `${problems.length} problems:\n${problems.map((problem) => `- ${problem}`).join("\n")}`,
    );
  }
}

function requiredBuildChecks(plan: Plan): string[] {
  return [
    ...BUILD_GATE_IDS,
    ...new Set(plan.cases.map(({ project }) => `playwright:${project}`)),
  ];
}

function validatePlanReview(planFile: string): Record<string, any> {
  const context = readPlan(planFile);
  const file = path.join(context.runDirectory, "plan-review.json");
  const report = readMatchingReport(context, file, planReviewSchema);
  const ids = report.reviewChecks.map(({ id }: { id: string }) => id);
  const missing = PLAN_REVIEW_CHECK_IDS.filter((id) => !ids.includes(id));
  failOnProblems([
    ...duplicates(ids, "Plan review check IDs"),
    ...(missing.length
      ? [`Plan review is missing checks: ${missing.join(", ")}`]
      : []),
  ]);
  return report;
}

function checkPlanReview(planFile: string): void {
  const context = readPlan(planFile);
  const report = validatePlanReview(planFile);
  const problems: string[] = [];
  if (report.verdict !== "PASS") problems.push("Plan reviewer verdict is FAIL");
  if (
    report.reviewChecks.some(
      ({ status }: { status: string }) => status !== "passed",
    )
  ) {
    problems.push("Plan review contains failed checks");
  }
  if (
    report.findings.some(
      ({ severity }: { severity: string }) => severity === "blocking",
    )
  ) {
    problems.push("Plan review contains blocking findings");
  }
  failOnProblems(problems);
  console.log(
    `✔ plan review passed: ${relativePath(path.join(context.runDirectory, "plan-review.json"))}`,
  );
}

function validateBuildReport(
  planFile: string,
  buildFile: string,
): Record<string, any> {
  const context = readPlan(planFile);
  const report = readMatchingReport(context, buildFile, buildReportSchema);
  const problems: string[] = [];
  const attemptNumber = /^attempt-(\d{3,})$/.exec(
    path.basename(path.dirname(path.resolve(buildFile))),
  )?.[1];
  if (!attemptNumber || Number(attemptNumber) !== report.attempt) {
    problems.push("Build report attempt does not match its directory");
  }
  const plannedCases = context.plan.cases.map(({ id }) => id);
  const implemented = report.implementedCases.map(
    ({ caseId }: { caseId: string }) => caseId,
  );
  problems.push(...duplicates(implemented, "Implemented case IDs"));
  if (implemented.some((id: string) => !plannedCases.includes(id))) {
    problems.push("Build report references a case not in the approved plan");
  }
  const checkIds = (report.checks as { id: string }[]).map(({ id }) => id);
  problems.push(...duplicates(checkIds, "Build check IDs"));
  const missing = requiredBuildChecks(context.plan).filter(
    (id) => !checkIds.includes(id),
  );
  if (missing.length)
    problems.push(`Build report is missing checks: ${missing.join(", ")}`);
  failOnProblems(problems);
  return report;
}

// Files changed in the working tree and index compared with HEAD, plus new
// untracked files, so a build report cannot leave out a changed file. Plan
// artifacts and pipeline reports are not implementation changes.
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
    ].filter(
      (file) =>
        !file.startsWith("test-plans/") && !file.startsWith("pipeline-runs/"),
    );
  } catch {
    return undefined;
  }
}

function checkBuild(planFile: string, buildFile: string): void {
  const context = readPlan(planFile);
  checkPlanReview(planFile);
  const report = validateBuildReport(planFile, buildFile);
  const problems: string[] = [];
  const plannedFiles = new Set(
    context.plan.files.map(({ path: file }) => file),
  );
  const reported = report.changedFiles.map(
    ({ path: file }: { path: string }) => file,
  );
  const unplanned = reported.filter((file: string) => !plannedFiles.has(file));
  if (unplanned.length)
    problems.push(`Unapproved changed files: ${unplanned.join(", ")}`);
  const changed = changedInGit();
  if (changed) {
    const unplannedInGit = changed.filter((file) => !plannedFiles.has(file));
    if (unplannedInGit.length)
      problems.push(
        `Git shows changes to files outside the plan: ${unplannedInGit.join(", ")}`,
      );
    const unreported = changed.filter(
      (file) => plannedFiles.has(file) && !reported.includes(file),
    );
    if (unreported.length)
      problems.push(
        `Changed files missing from the build report: ${unreported.join(", ")}`,
      );
  }
  for (const item of report.implementedCases as {
    caseId: string;
    files: string[];
  }[]) {
    if (item.files.some((file) => !plannedFiles.has(file))) {
      problems.push(`Case ${item.caseId} maps to an unapproved file`);
    }
  }
  const checkById = new Map<string, { status: string }>(
    (report.checks as { id: string; status: string }[]).map((check) => [
      check.id,
      check,
    ]),
  );
  const failed = requiredBuildChecks(context.plan).filter(
    (id) => checkById.get(id)?.status !== "passed",
  );
  if (failed.length)
    problems.push(`Required build checks did not pass: ${failed.join(", ")}`);
  if (report.status !== "passed")
    problems.push("Build report status is not passed");
  if (report.deviations.length)
    problems.push("A passing build report must not contain deviations");
  if (report.implementedCases.length !== context.plan.cases.length) {
    problems.push("Passing build report must map every approved case");
  }
  failOnProblems(problems);
  console.log(
    `✔ build report passed: ${relativePath(path.resolve(buildFile))}`,
  );
}

function validateValidationReport(
  planFile: string,
  buildFile: string,
  validationFile: string,
): Record<string, any> {
  const context = readPlan(planFile);
  checkBuild(planFile, buildFile);
  const report = readMatchingReport(
    context,
    validationFile,
    validationReportSchema,
  );
  const problems: string[] = [];
  const buildHash = createHash("sha256")
    .update(fs.readFileSync(buildFile))
    .digest("hex");
  if (
    report.buildReportPath !== relativePath(buildFile) ||
    report.buildReportSha256 !== buildHash
  ) {
    problems.push(
      "Validation report does not identify this build report version",
    );
  }
  if (
    path.dirname(path.resolve(validationFile)) !==
    path.dirname(path.resolve(buildFile))
  ) {
    problems.push(
      "Validation report must be in the build report's attempt directory",
    );
  }

  const caseCoverage = report.caseCoverage as {
    caseId: string;
    status: string;
  }[];
  problems.push(
    ...duplicates(
      caseCoverage.map(({ caseId }) => caseId),
      "Validated case IDs",
    ),
  );
  const plannedCases = new Set(context.plan.cases.map(({ id }) => id));
  if (caseCoverage.some(({ caseId }) => !plannedCases.has(caseId))) {
    problems.push(
      "Validation report references a case not in the approved plan",
    );
  }
  problems.push(
    ...duplicates(
      report.reviewChecks.map(({ id }: { id: string }) => id),
      "Validation check IDs",
    ),
  );
  const reviewCheckIds = new Set(
    report.reviewChecks.map(({ id }: { id: string }) => id),
  );
  const missingReviewChecks = IMPLEMENTATION_REVIEW_CHECK_IDS.filter(
    (id) => !reviewCheckIds.has(id),
  );
  if (missingReviewChecks.length) {
    problems.push(
      `Validation report is missing checks: ${missingReviewChecks.join(", ")}`,
    );
  }
  failOnProblems(problems);
  return report;
}

function checkValidation(
  planFile: string,
  buildFile: string,
  validationFile: string,
): void {
  const context = readPlan(planFile);
  const report = validateValidationReport(planFile, buildFile, validationFile);
  const problems: string[] = [];
  if (report.verdict !== "PASS")
    problems.push("Implementation validator verdict is FAIL");
  if (
    report.reviewChecks.some(
      ({ status }: { status: string }) => status !== "passed",
    )
  ) {
    problems.push("Implementation validation contains failed checks");
  }
  if (
    report.findings.some(
      ({ severity }: { severity: string }) => severity === "blocking",
    )
  ) {
    problems.push("Implementation validation contains blocking findings");
  }
  const caseCoverage = report.caseCoverage as {
    caseId: string;
    status: string;
  }[];
  if (
    caseCoverage.length !== context.plan.cases.length ||
    context.plan.cases.some(
      ({ id }) =>
        !caseCoverage.some(
          (item) => item.caseId === id && item.status === "implemented",
        ),
    )
  ) {
    problems.push(
      "Passing validation report must account for every approved case",
    );
  }
  failOnProblems(problems);
  console.log(
    `✔ implementation validation passed: ${relativePath(validationFile)}`,
  );
}

function nextAttempt(planFile: string): string {
  const context = readPlan(planFile);
  const root = path.resolve(context.runDirectory);
  fs.mkdirSync(root, { recursive: true });
  const attempts = fs
    .readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => /^attempt-(\d{3,})$/.exec(entry.name)?.[1])
    .filter((value): value is string => value !== undefined)
    .map(Number);
  const number = Math.max(0, ...attempts) + 1;
  const directory = path.join(
    root,
    `attempt-${String(number).padStart(3, "0")}`,
  );
  fs.mkdirSync(directory, { recursive: false });
  return relativePath(directory);
}

function checkAll(): void {
  const root = path.resolve("pipeline-runs");
  if (!fs.existsSync(root)) {
    console.log("✔ no pipeline reports to check");
    return;
  }
  const schemas: Record<string, TSchema> = {
    "plan-review.json": planReviewSchema,
    "build-report.json": buildReportSchema,
    "validation-report.json": validationReportSchema,
  };
  let count = 0;
  const visit = (directory: string) => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const file = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        visit(file);
        continue;
      }
      const schema = schemas[entry.name];
      if (!schema) continue;
      const report = readJson(file, schema) as Identity;
      // pipeline-runs/<feature>/<plan-sha256>/[attempt-NNN/]<report>
      const [feature, planSha256] = path.relative(root, file).split(path.sep);
      if (report.feature !== feature || report.planSha256 !== planSha256) {
        fail(
          `${relativePath(file)} is not stored under its feature and plan hash`,
        );
      }
      count += 1;
    }
  };
  visit(root);
  console.log(`✔ checked ${count} pipeline report(s)`);
}

function main(): void {
  const [, , command, ...args] = process.argv;
  try {
    if (command === "run-dir" && args[0]) {
      const context = readPlan(args[0]);
      fs.mkdirSync(context.runDirectory, { recursive: true });
      console.log(context.runDirectory);
    } else if (command === "metadata" && args[0]) {
      const context = readPlan(args[0]);
      console.log(
        JSON.stringify(
          {
            feature: context.plan.feature,
            planPath: context.path,
            planSha256: context.sha256,
            runDirectory: context.runDirectory,
          },
          null,
          2,
        ),
      );
    } else if (command === "hash" && args[0]) {
      console.log(
        createHash("sha256").update(fs.readFileSync(args[0])).digest("hex"),
      );
    } else if (command === "next-attempt" && args[0]) {
      console.log(nextAttempt(args[0]));
    } else if (command === "check-plan-review" && args[0]) {
      checkPlanReview(args[0]);
    } else if (command === "validate-plan-review" && args[0]) {
      const report = validatePlanReview(args[0]);
      console.log(`✔ plan-review report is valid (${report.verdict})`);
    } else if (command === "validate-build" && args.length === 2) {
      const report = validateBuildReport(args[0], args[1]);
      console.log(`✔ build report is valid (${report.status})`);
    } else if (command === "check-build" && args.length === 2) {
      checkBuild(args[0], args[1]);
    } else if (command === "validate-validation" && args.length === 3) {
      const report = validateValidationReport(args[0], args[1], args[2]);
      console.log(`✔ validation report is valid (${report.verdict})`);
    } else if (command === "check-validation" && args.length === 3) {
      checkValidation(args[0], args[1], args[2]);
    } else if (command === "check-all") {
      checkAll();
    } else {
      throw new Error(
        "Usage: npm run qa:pipeline -- <metadata|hash|run-dir|next-attempt|validate-plan-review|check-plan-review|validate-build|check-build|validate-validation|check-validation|check-all> ...",
      );
    }
  } catch (caught) {
    console.error(
      `✖ ${caught instanceof Error ? caught.message : String(caught)}`,
    );
    process.exitCode = 1;
  }
}

if (require.main === module) main();
