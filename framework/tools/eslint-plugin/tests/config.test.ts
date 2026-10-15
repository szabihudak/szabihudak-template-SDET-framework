import assert from "node:assert/strict";
import path from "node:path";
import { test } from "node:test";
import { ESLint } from "eslint";

// Each case is a file that breaks exactly one rule of eslint.config.mjs, or a
// file that follows the rules. A rule that stops reporting fails here.
const ROOT = path.resolve(import.meta.dirname, "../../../..");
const eslint = new ESLint({ cwd: ROOT });

const spec = (body: string) => `import { test, expect } from "@playwright/test";

test.describe("Lint self-test", () => {
  test("case", async ({ page }) => {
${body}
  });
});
`;

type Case = { name: string; file: string; code: string };

const invalid: (Case & { rule: string })[] = [
  {
    name: "expect in a client",
    file: "src/api/clients/LintClient.ts",
    code: 'import { expect } from "@playwright/test";\nexpect(1).toBe(1);\n',
    rule: "[no-assertions-outside-specs]",
  },
  {
    name: "expect in the framework core",
    file: "framework/core/api/Lint.ts",
    code: "expect.soft(1).toBe(1);\n",
    rule: "[no-assertions-outside-specs]",
  },
  {
    name: "cast on await response.json()",
    file: "src/api/clients/LintClient.ts",
    code: "type T = { id: string };\nexport const read = async (r: Response) => (await r.json()) as T;\n",
    rule: "[no-cast-on-response-json]",
  },
  {
    name: "cast through unknown",
    file: "src/api/clients/LintClient.ts",
    code: "type T = { id: string };\nexport const read = async (r: Response) => (await r.json()) as unknown as T;\n",
    rule: "[no-cast-on-response-json]",
  },
  {
    name: "raw locator in a spec",
    file: "tests/ui/lint.spec.ts",
    code: spec('    await expect(page.getByRole("button")).toBeVisible();'),
    rule: "[no-raw-locators-in-specs]",
  },
  {
    name: "SQL in a spec",
    file: "tests/api/lint.spec.ts",
    code: spec('    expect("SELECT id FROM users").toBe("");'),
    rule: "[no-sql-in-specs]",
  },
  {
    name: "pg in a spec",
    file: "tests/api/lint.spec.ts",
    code: `import { Client } from "pg";\n${spec("    expect(Client).toBeDefined();")}`,
    rule: "[no-sql-in-specs]",
  },
  {
    name: "fixed wait",
    file: "src/pages/LintPage.ts",
    code: "export const wait = (page: { waitForTimeout(ms: number): Promise<void> }) => page.waitForTimeout(500);\n",
    rule: "playwright/no-wait-for-timeout",
  },
  {
    name: "AxeBuilder outside the scanner",
    file: "tests/accessibility/lint.spec.ts",
    code: `import AxeBuilder from "@axe-core/playwright";\n${spec("    expect(AxeBuilder).toBeDefined();")}`,
    rule: "[axe-only-through-scanner]",
  },
  {
    name: "Playwright in a factory",
    file: "src/data/lintFactory.ts",
    code: 'import { test } from "@playwright/test";\nexport const value = test;\n',
    rule: "[factories-without-playwright]",
  },
  {
    name: "framework by path",
    file: "src/api/clients/LintClient.ts",
    code: 'export { validateSchema } from "../../../framework/core/api/SchemaValidator";\n',
    rule: "[framework-through-alias]",
  },
  {
    name: "non-retrying assertion",
    file: "tests/ui/lint.spec.ts",
    code: spec(
      '    expect(await page.title()).toBe("");\n    expect(await homePage.heading.isVisible()).toBe(true);',
    ),
    rule: "playwright/prefer-web-first-assertions",
  },
  {
    name: "count() assertion",
    file: "tests/ui/lint.spec.ts",
    code: spec("    expect(await homePage.rows.count()).toBe(2);"),
    rule: "playwright/prefer-to-have-count",
  },
  {
    name: "innerHTML assertion",
    file: "tests/ui/lint.spec.ts",
    code: spec('    expect(await homePage.heading.innerHTML()).toBe("");'),
    rule: "[web-first-assertions]",
  },
  {
    name: "networkidle",
    file: "src/pages/LintPage.ts",
    code: 'export const load = (page: { waitForLoadState(s: string): Promise<void> }) => page.waitForLoadState("networkidle");\n',
    rule: "playwright/no-networkidle",
  },
  {
    name: "waitForSelector",
    file: "src/pages/LintPage.ts",
    code: 'export const load = (page: { waitForSelector(s: string): Promise<void> }) => page.waitForSelector("#id");\n',
    rule: "playwright/no-wait-for-selector",
  },
  {
    name: "forced action",
    file: "src/pages/LintPage.ts",
    code: "export const press = (button: { click(o: object): Promise<void> }) => button.click({ force: true });\n",
    rule: "playwright/no-force-option",
  },
  {
    name: "locator by position",
    file: "src/pages/LintPage.ts",
    code: "export const first = (rows: { first(): unknown }) => rows.first();\n",
    rule: "playwright/no-nth-methods",
  },
  {
    name: "CSS locator",
    file: "src/pages/LintPage.ts",
    code: 'export const row = (page: { locator(s: string): unknown }) => page.locator(".row > td");\n',
    rule: "[locate-by-user-attributes]",
  },
  {
    name: "test.only",
    file: "tests/ui/lint.spec.ts",
    code: spec("    await expect(homePage.heading).toBeVisible();").replace(
      'test("case"',
      'test.only("case"',
    ),
    rule: "playwright/no-focused-test",
  },
  {
    name: "test.step",
    file: "tests/ui/lint.spec.ts",
    code: spec('    await test.step("open", async () => {});'),
    rule: "[no-test-step]",
  },
  {
    name: "assertion without await",
    file: "tests/ui/lint.spec.ts",
    code: spec("    expect(homePage.heading).toBeVisible();"),
    rule: "playwright/missing-playwright-await",
  },
  {
    name: "test outside describe",
    file: "tests/ui/lint.spec.ts",
    code: 'import { test, expect } from "@playwright/test";\n\ntest("case", async ({ homePage }) => {\n  await expect(homePage.heading).toBeVisible();\n});\n',
    rule: "playwright/require-top-level-describe",
  },
  {
    name: "framework core importing the application",
    file: "framework/core/api/Lint.ts",
    code: 'export { TaskApiClient } from "@app/api/clients/TaskApiClient";\n',
    rule: "[core-independent-of-app]",
  },
  {
    name: "application importing a spec",
    file: "src/fixtures/lint.ts",
    code: 'export * from "../../tests/api/create-task.spec";\n',
    rule: "[app-independent-of-specs]",
  },
  {
    name: "factory importing a client",
    file: "src/data/lintFactory.ts",
    code: 'export { TaskApiClient } from "@app/api/clients/TaskApiClient";\n',
    rule: "[factory-boundaries]",
  },
  {
    name: "Page Object importing a fixture",
    file: "src/pages/LintPage.ts",
    code: 'export { test } from "../fixtures/test-fixtures";\n',
    rule: "[page-object-boundaries]",
  },
  {
    name: "starter file checked as src/",
    file: "framework/setup/starter/src/fixtures/lint.ts",
    code: "expect(1).toBe(1);\n",
    rule: "[no-assertions-outside-specs]",
  },
  {
    name: "self-test spec checked as tests/",
    file: "framework/setup/selftest/tests/smoke/lint.spec.ts",
    code: spec('    await test.step("open", async () => {});'),
    rule: "[no-test-step]",
  },
];

const valid: Case[] = [
  {
    name: "as unknown before validation",
    file: "src/api/clients/LintClient.ts",
    code: "export const read = async (r: Response) => (await r.json()) as unknown;\n",
  },
  {
    name: "test id locator",
    file: "src/pages/LintPage.ts",
    code: 'export const rows = (page: { locator(s: string): unknown }) => [page.locator(\'[data-testid^="task-"]\'), page.locator(`[data-testid="task-${1}"]`)];\n',
  },
  {
    name: "Lighthouse policy asserts",
    file: "framework/core/performance/lint.ts",
    code: "expect(1).toBe(1);\n",
  },
  {
    name: "scanner uses axe",
    file: "framework/core/accessibility/lint.ts",
    code: 'import AxeBuilder from "@axe-core/playwright";\nexport const builder = AxeBuilder;\n',
  },
  {
    name: "k6 script imports the framework by path",
    file: "tests/performance/k6/lint.js",
    code: 'export { handleSummary } from "../../../framework/core/performance/k6/k6SummaryReporter.js";\n',
  },
  {
    name: "conforming spec",
    file: "tests/ui/lint.spec.ts",
    code: spec("    await expect(homePage.heading).toBeVisible();"),
  },
];

async function messages({ file, code }: Case): Promise<string[]> {
  const [result] = await eslint.lintText(code, {
    filePath: path.join(ROOT, file),
  });

  return result.messages.map(
    (message) => `${message.ruleId}: ${message.message}`,
  );
}

for (const lintCase of invalid) {
  test(`reports ${lintCase.rule}: ${lintCase.name}`, async () => {
    const reported = await messages(lintCase);

    assert.ok(
      reported.some((message) => message.includes(lintCase.rule)),
      `expected ${lintCase.rule}, got:\n${reported.join("\n")}`,
    );
  });
}

for (const lintCase of valid) {
  test(`accepts: ${lintCase.name}`, async () => {
    assert.deepEqual(await messages(lintCase), []);
  });
}
