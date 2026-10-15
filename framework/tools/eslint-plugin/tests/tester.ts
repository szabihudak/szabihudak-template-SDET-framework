import { describe, it } from "node:test";
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

// A spec with one describe around the given tests.
export const spec = (tests: string, imports = "") =>
  `import { test, expect } from "@app/fixtures/test-fixtures";
${imports}
test.describe("Rule self-test", () => {
${tests}
});
`;
