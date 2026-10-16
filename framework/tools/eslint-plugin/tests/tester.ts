import { describe, it } from "node:test";
import markdown from "@eslint/markdown";
import { RuleTester } from "eslint";
import type { Rule } from "eslint";
import tseslint from "typescript-eslint";

// ESLint's RuleTester on node:test, with the TypeScript parser the config uses.
RuleTester.describe = describe;
RuleTester.it = it;
RuleTester.itOnly = it.only;

const tester = new RuleTester({ languageOptions: { parser: tseslint.parser } });

export type Cases = Parameters<RuleTester["run"]>[2];

export function run(name: string, rule: unknown, cases: Cases): void {
  tester.run(name, rule as Rule.RuleModule, cases);
}

// The plan rules read test-plans/*.md as the config does.
const planTester = new RuleTester({
  plugins: { markdown },
  language: "markdown/gfm",
});

export function runPlan(name: string, rule: unknown, cases: Cases): void {
  planTester.run(name, rule as Rule.RuleModule, cases);
}

// A spec with one describe around the given tests.
export const spec = (tests: string, imports = "") =>
  `import { test, expect } from "@app/fixtures/test-fixtures";
${imports}
test.describe("Rule self-test", () => {
${tests}
});
`;

// A plan that follows the format; the plan rule tests change one part of it.
export const PLAN = `# Login test plan

## Risks

| ID | Risk | Impact | Likelihood | Level |
| --- | --- | --- | --- | --- |
| R1 | Valid users cannot log in | High | Medium | High |
| R2 | Login accepts invalid input | Medium | Medium | Medium |

## Cases

| ID | Level | Case | Technique | Type | Steps | Expected result | Risk | Priority | Regression | Source |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| T001_Login_API | API | logs in | happy path | Positive | 1. Log in with the user role.<br>2. Check the status and the schema. | HTTP 200 | R1 | High | Yes | contract |
| T002_Login_API | API | rejects a short password | boundary value analysis | Negative | 1. Log in with a five-character password.<br>2. Check the status. | HTTP 400 | R2 | Medium | Yes | contract |

## Coverage

| Category | Cases or reason |
| --- | --- |
| happy path | T001_Login_API |
| boundary values | T002_Login_API |
| equivalence classes | not applicable: the contract defines no input classes beyond the password length |
| business flow | not applicable: the contract defines no rule beyond input validation |
| error handling | not applicable: no unexpected input identified |
| exploratory | charter: 30 minutes on error messages |
`;
