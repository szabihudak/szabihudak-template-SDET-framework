import rule from "../rules/no-boolean-wrapped-assertions.ts";
import { run } from "./tester.ts";

run("no-boolean-wrapped-assertions", rule, {
  valid: [
    'expect(body.error).toBe("Unauthorized");',
    "expect(body.active).toBe(true);",
    "expect(body).toEqual({ error: 'x' });",
    "await expect(page.heading).toBeVisible();",
  ],
  invalid: [
    {
      code: "expect(isAuthErrorResponse(body)).toBe(true);",
      errors: [{ messageId: "wrapped" }],
    },
    {
      code: "expect(Number.isInteger(body.user.id)).toBe(true);",
      errors: [{ messageId: "wrapped" }],
    },
    {
      code: "expect(!hasError(body)).toBeTruthy();",
      errors: [{ messageId: "wrapped" }],
    },
    {
      code: "expect(\n  isError(\n    body,\n  ),\n).not.toBe(false);",
      errors: [{ messageId: "wrapped" }],
    },
  ],
});
