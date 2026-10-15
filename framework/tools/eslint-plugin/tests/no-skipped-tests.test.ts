import rule from "../rules/no-skipped-tests.ts";
import { run } from "./tester.ts";

run("no-skipped-tests", rule, {
  valid: [
    'test.skip(browserName === "webkit", "WebKit has no clipboard API");',
    'test.skip(({ browserName }) => browserName === "webkit", "no clipboard");',
    '// quarantine: flaky upload; owner: Szabi; exit: #42\ntest.fixme("uploads a file", async () => {});',
  ],
  invalid: [
    {
      code: 'test.skip("creates a task", async () => {});',
      errors: [{ messageId: "skipped" }],
    },
    { code: "test.skip();", errors: [{ messageId: "skipped" }] },
    {
      code: 'test.skip(isCi, "");',
      errors: [{ messageId: "skipped" }],
    },
    {
      code: 'test.describe.fixme("tasks", () => {});',
      errors: [{ messageId: "skipped" }],
    },
    {
      code: '// quarantine: flaky\ntest.fail("uploads a file", async () => {});',
      errors: [{ messageId: "skipped" }],
    },
  ],
});
