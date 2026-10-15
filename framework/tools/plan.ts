import fs from "node:fs";
import path from "node:path";

import { Type } from "@sinclair/typebox";

import { validateSchema } from "../core/api/SchemaValidator";

const PLAN_DIR = "test-plans";
const PLAN_FILE = "plan.json";
const VIEW_FILE = "plan.md";
const CATEGORIES = [
  "happyPath",
  "businessRules",
  "equivalencePartitions",
  "boundaryValues",
  "errorHandling",
  "emptyOmittedMissingData",
  "unauthenticatedAccess",
  "unauthorizedAccess",
] as const;

const evidenceSchema = Type.Object(
  {
    id: Type.String({ minLength: 1 }),
    sourceType: Type.Union([
      Type.Literal("requirements"),
      Type.Literal("repository"),
      Type.Literal("provider-contract"),
      Type.Literal("running-application"),
    ]),
    source: Type.String({ minLength: 1 }),
    finding: Type.String({ minLength: 1 }),
    verified: Type.Boolean(),
  },
  { additionalProperties: false },
);

const planSchema = Type.Object(
  {
    schemaVersion: Type.Literal(1),
    feature: Type.String({ pattern: "^[a-z0-9]+(?:-[a-z0-9]+)*$" }),
    status: Type.Literal("draft"),
    mode: Type.Union([
      Type.Literal("requirements"),
      Type.Literal("exploratory"),
    ]),
    inputs: Type.Object(
      {
        environment: Type.String({ minLength: 1 }),
        credentialsRole: Type.String({ minLength: 1 }),
        scenario: Type.String({ minLength: 1 }),
        testType: Type.Union([
          Type.Literal("API"),
          Type.Literal("UI"),
          Type.Literal("both"),
        ]),
      },
      { additionalProperties: false },
    ),
    discovery: Type.Array(evidenceSchema),
    setupChanges: Type.Array(
      Type.Object(
        {
          change: Type.String({ minLength: 1 }),
          reason: Type.String({ minLength: 1 }),
          evidenceIds: Type.Array(Type.String({ minLength: 1 })),
        },
        { additionalProperties: false },
      ),
    ),
    cases: Type.Array(
      Type.Object(
        {
          id: Type.String({
            pattern: "^T[0-9]{3,}_[A-Z][A-Za-z0-9]*_(API|E2E)$",
          }),
          title: Type.String({ minLength: 1 }),
          level: Type.Union([Type.Literal("API"), Type.Literal("UI")]),
          project: Type.String({ minLength: 1 }),
          basis: Type.Union([
            Type.Literal("requirement"),
            Type.Literal("providerContract"),
            Type.Literal("observedBehavior"),
          ]),
          techniques: Type.Array(Type.String({ minLength: 1 }), {
            minItems: 1,
          }),
          preconditions: Type.Array(Type.String({ minLength: 1 })),
          steps: Type.Array(Type.String({ minLength: 1 }), { minItems: 1 }),
          expectedResult: Type.String({ minLength: 1 }),
          testData: Type.Object(
            {
              setup: Type.String({ minLength: 1 }),
              cleanup: Type.String({ minLength: 1 }),
            },
            { additionalProperties: false },
          ),
          regression: Type.Object(
            {
              included: Type.Boolean(),
              reason: Type.String({ minLength: 1 }),
            },
            { additionalProperties: false },
          ),
          evidenceIds: Type.Array(Type.String({ minLength: 1 }), {
            minItems: 1,
          }),
        },
        { additionalProperties: false },
      ),
      { minItems: 1 },
    ),
    coverage: Type.Array(
      Type.Object(
        {
          category: Type.Union(
            CATEGORIES.map((category) => Type.Literal(category)),
          ),
          status: Type.Union([
            Type.Literal("covered"),
            Type.Literal("notApplicable"),
          ]),
          caseIds: Type.Array(Type.String({ minLength: 1 })),
          reason: Type.Union([Type.String({ minLength: 1 }), Type.Null()]),
        },
        { additionalProperties: false },
      ),
    ),
    outOfScope: Type.Array(
      Type.Object(
        {
          behavior: Type.String({ minLength: 1 }),
          reason: Type.String({ minLength: 1 }),
        },
        { additionalProperties: false },
      ),
    ),
    files: Type.Array(
      Type.Object(
        {
          path: Type.String({ minLength: 1 }),
          decision: Type.Union([
            Type.Literal("reuse"),
            Type.Literal("extend"),
            Type.Literal("create"),
          ]),
          exampleOrTemplateId: Type.Union([Type.String(), Type.Null()]),
          reason: Type.String({ minLength: 1 }),
        },
        { additionalProperties: false },
      ),
    ),
    openQuestions: Type.Array(Type.String({ minLength: 1 })),
  },
  { additionalProperties: false },
);

type Plan = typeof planSchema extends { static: infer T } ? T : never;

// Returns the problem as a message, so validatePlan can report every problem
// in one run instead of stopping at the first.
function duplicates(values: string[], label: string): string[] {
  const seen = new Set<string>();
  const repeated = values.filter((value) =>
    seen.has(value) ? true : (seen.add(value), false),
  );
  return repeated.length > 0
    ? [
        `${label} must be unique; duplicates: ${[...new Set(repeated)].join(", ")}`,
      ]
    : [];
}

function validatePlan(plan: Plan, file: string): void {
  validateSchema(planSchema, plan);

  const problems: string[] = [];
  const expectedDirectory = path.resolve(PLAN_DIR, plan.feature);
  const actualDirectory = path.resolve(path.dirname(file));
  if (
    actualDirectory !== expectedDirectory ||
    path.basename(file) !== PLAN_FILE
  ) {
    problems.push(
      `Plan must be stored at ${PLAN_DIR}/${plan.feature}/${PLAN_FILE}`,
    );
  }

  const evidenceById = new Map(
    plan.discovery.map((entry) => [entry.id, entry]),
  );
  problems.push(
    ...duplicates(
      plan.discovery.map(({ id }) => id),
      "Evidence IDs",
    ),
    ...duplicates(
      plan.cases.map(({ id }) => id),
      "Case IDs",
    ),
    ...duplicates(
      plan.cases.map(({ id }) =>
        String(Number(id.match(/^T([0-9]{3,})_/)?.[1] ?? NaN)),
      ),
      "Case ID sequence numbers",
    ),
    ...duplicates(
      plan.coverage.map(({ category }) => category),
      "Coverage categories",
    ),
  );

  const actualCategories = new Set<string>(
    plan.coverage.map(({ category }) => category),
  );
  const missingCategories = CATEGORIES.filter(
    (category) => !actualCategories.has(category),
  );
  if (missingCategories.length > 0) {
    problems.push(
      `Missing coverage categories: ${missingCategories.join(", ")}`,
    );
  }

  const caseIds = new Set(plan.cases.map(({ id }) => id));
  const coveredCaseIds = new Set<string>();
  for (const item of plan.coverage) {
    for (const id of item.caseIds) {
      if (!caseIds.has(id))
        problems.push(
          `Coverage ${item.category} references unknown case ${id}`,
        );
      coveredCaseIds.add(id);
    }
    if (
      item.status === "covered" &&
      (item.caseIds.length === 0 || item.reason !== null)
    ) {
      problems.push(
        `Covered category ${item.category} requires case IDs and a null reason`,
      );
    }
    if (
      item.status === "notApplicable" &&
      (item.caseIds.length > 0 || !item.reason?.trim())
    ) {
      problems.push(
        `Not-applicable category ${item.category} requires no case IDs and a reason`,
      );
    }
    problems.push(
      ...duplicates(item.caseIds, `Case IDs in coverage ${item.category}`),
    );
  }
  for (const item of plan.cases) {
    if (!coveredCaseIds.has(item.id))
      problems.push(
        `Case ${item.id} is not referenced by any coverage category`,
      );
    const idLevel = item.id.split("_").at(-1);
    if (
      (item.level === "API" && idLevel !== "API") ||
      (item.level === "UI" && idLevel !== "E2E")
    ) {
      problems.push(`Case ID ${item.id} does not match level ${item.level}`);
    }
    const evidence = item.evidenceIds.flatMap((id) => {
      const entry = evidenceById.get(id);
      if (!entry) {
        problems.push(`Case ${item.id} references unknown evidence ${id}`);
        return [];
      }
      if (!entry.verified) {
        problems.push(
          `Case ${item.id} cannot rely on unverified evidence ${id}`,
        );
        return [];
      }
      return [entry];
    });
    if (plan.mode === "requirements") {
      if (
        item.basis !== "requirement" ||
        !evidence.some(({ sourceType }) => sourceType === "requirements")
      ) {
        problems.push(
          `Requirements-mode case ${item.id} needs verified requirements evidence and basis=requirement`,
        );
      }
    } else {
      const sourceType =
        item.basis === "providerContract"
          ? "provider-contract"
          : "running-application";
      if (
        item.basis === "requirement" ||
        !evidence.some((entry) => entry.sourceType === sourceType)
      ) {
        problems.push(
          `Exploratory case ${item.id} needs verified ${sourceType} evidence matching its basis`,
        );
      }
    }
  }

  for (const item of plan.setupChanges) {
    for (const id of item.evidenceIds) {
      if (!evidenceById.has(id))
        problems.push(`Setup change references unknown evidence ${id}`);
    }
  }

  if (problems.length > 0) {
    throw new Error(
      `Plan has ${problems.length} problem(s):\n${problems.map((problem) => `- ${problem}`).join("\n")}`,
    );
  }
}

function renderMarkdown(plan: Plan): string {
  const lines = [
    `# Test Plan: ${plan.feature}`,
    "",
    `> Generated from \`${PLAN_FILE}\`. Edit the JSON source, then run the plan refresh command.`,
    "",
    `- **Status:** ${plan.status}`,
    `- **Mode:** ${plan.mode}`,
    `- **Environment:** ${plan.inputs.environment}`,
    `- **Credentials role:** ${plan.inputs.credentialsRole}`,
    `- **Scenario:** ${plan.inputs.scenario}`,
    `- **Test type:** ${plan.inputs.testType}`,
    "",
    "## Discovery",
    "",
  ];
  for (const evidence of plan.discovery) {
    lines.push(
      `### ${evidence.id}: ${evidence.sourceType}`,
      "",
      `- **Source:** ${evidence.source}`,
      `- **Verified:** ${evidence.verified}`,
      `- **Finding:** ${evidence.finding}`,
      "",
    );
  }
  lines.push("## Setup Changes", "");
  if (plan.setupChanges.length === 0) lines.push("None.", "");
  for (const item of plan.setupChanges) {
    lines.push(
      `- **${item.change}**`,
      `  - Reason: ${item.reason}`,
      `  - Evidence: ${item.evidenceIds.join(", ") || "none"}`,
      "",
    );
  }
  lines.push("## Test Cases", "");
  for (const item of plan.cases) {
    lines.push(
      `### ${item.id}: ${item.title}`,
      "",
      `- **Level / project:** ${item.level} / ${item.project}`,
      `- **Basis:** ${item.basis}`,
      `- **Techniques:** ${item.techniques.join(", ")}`,
      `- **Preconditions:** ${item.preconditions.join("; ") || "None"}`,
      "- **Steps:**",
      ...item.steps.map((step, index) => `  ${index + 1}. ${step}`),
      `- **Expected result:** ${item.expectedResult}`,
      `- **Test data:** setup: ${item.testData.setup}; cleanup: ${item.testData.cleanup}`,
      `- **Regression:** ${item.regression.included ? "yes" : "no"} (${item.regression.reason})`,
      `- **Evidence:** ${item.evidenceIds.join(", ")}`,
      "",
    );
  }
  lines.push(
    "## Coverage",
    "",
    "| Category | Status | Cases | Reason |",
    "| --- | --- | --- | --- |",
  );
  for (const item of plan.coverage) {
    lines.push(
      `| ${item.category} | ${item.status} | ${item.caseIds.join(", ") || "-"} | ${item.reason ?? "-"} |`,
    );
  }
  lines.push("", "## Out of Scope", "");
  if (plan.outOfScope.length === 0) lines.push("None.", "");
  for (const item of plan.outOfScope)
    lines.push(`- **${item.behavior}:** ${item.reason}`);
  lines.push(
    "",
    "## Planned Files",
    "",
    "| File | Decision | Example/template | Reason |",
    "| --- | --- | --- | --- |",
  );
  for (const item of plan.files)
    lines.push(
      `| ${item.path} | ${item.decision} | ${item.exampleOrTemplateId ?? "-"} | ${item.reason} |`,
    );
  lines.push("", "## Open Questions", "");
  if (plan.openQuestions.length === 0) lines.push("None.");
  else lines.push(...plan.openQuestions.map((question) => `- ${question}`));
  return `${lines.join("\n")}\n`;
}

function resolvePlanPath(input: string): string {
  const absolute = path.resolve(input);
  const relative = path.relative(process.cwd(), absolute);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error("Plan path must be inside the repository");
  }
  return absolute;
}

function readAndValidate(file: string): { plan: Plan; markdown: string } {
  const parsed: unknown = JSON.parse(fs.readFileSync(file, "utf8"));
  validateSchema(planSchema, parsed);
  const plan = parsed as Plan;
  validatePlan(plan, path.relative(process.cwd(), file));
  return { plan, markdown: renderMarkdown(plan) };
}

function refresh(file: string): void {
  const { markdown } = readAndValidate(file);
  const view = path.join(path.dirname(file), VIEW_FILE);
  fs.writeFileSync(view, markdown);
  console.log(
    `✔ plan is valid; generated ${path.relative(process.cwd(), view)}`,
  );
}

function check(file: string): void {
  const { markdown } = readAndValidate(file);
  const view = path.join(path.dirname(file), VIEW_FILE);
  if (!fs.existsSync(view))
    throw new Error(
      `Generated plan view is missing: ${path.relative(process.cwd(), view)}`,
    );
  if (fs.readFileSync(view, "utf8") !== markdown) {
    throw new Error(
      `Generated plan view is stale: ${path.relative(process.cwd(), view)}; run qa:plan refresh after a human-requested plan update`,
    );
  }
  console.log(
    `✔ plan and generated view are valid: ${path.relative(process.cwd(), file)}`,
  );
}

function findPlans(directory: string): string[] {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const child = path.join(directory, entry.name);
    return entry.isDirectory()
      ? findPlans(child)
      : entry.name === PLAN_FILE
        ? [child]
        : [];
  });
}

function main(): void {
  const [, , command, argument] = process.argv;
  try {
    if (command === "refresh" || command === "check") {
      if (!argument)
        throw new Error(
          `Usage: npm run qa:plan -- ${command} ${PLAN_DIR}/<feature>/${PLAN_FILE}`,
        );
      const file = resolvePlanPath(argument);
      if (command === "refresh") refresh(file);
      else check(file);
      return;
    }
    if (command === "check-all") {
      const plans = findPlans(path.resolve(PLAN_DIR));
      for (const file of plans) check(file);
      console.log(`✔ checked ${plans.length} plan(s)`);
      return;
    }
    throw new Error(
      "Usage: npm run qa:plan -- <refresh|check|check-all> [plan.json]",
    );
  } catch (error) {
    console.error(
      `✖ ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exitCode = 1;
  }
}

if (require.main === module) main();
