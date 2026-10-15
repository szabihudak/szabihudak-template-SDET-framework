import rule from "../rules/ui-tests-assert-the-page.ts";
import { run, spec } from "./tester.ts";

const test = (body: string, options = "") =>
  spec(`  test("shows the dashboard", ${options}async ({ dashboardPage }) => {
${body}
  });`);

run("ui-tests-assert-the-page", rule, {
  valid: [
    test("    await expect(dashboardPage.heading).toBeVisible();"),
    test("    await expect(dashboardPage.rows).toHaveCount(2);"),
    test('    await expect(page).toHaveURL("/x");', '{ tag: "@selftest" }, '),
  ],
  invalid: [
    {
      code: test(
        "    await expect(dashboardPage.page).toHaveURL(/dashboard/);",
      ),
      errors: [{ messageId: "noPageAssertion" }],
    },
    {
      code: test("    await dashboardPage.open();"),
      errors: [{ messageId: "noPageAssertion" }],
    },
  ],
});
