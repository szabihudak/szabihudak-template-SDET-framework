import rule from "../rules/no-trivial-assertions.ts";
import { run } from "./tester.ts";

run("no-trivial-assertions", rule, {
  valid: [
    "expect(response.status()).toBe(201);",
    "expect(body.title).toBe(taskData.title);",
    "expect(body.access_token).toBeTruthy();",
    "await expect(response).toBeOK();",
    "expect(body).toEqual({ error: 'x' });",
    "await expect(page.heading).toBeVisible();",
  ],
  invalid: [
    {
      code: "expect(true).toBe(true);",
      errors: [{ messageId: "constant" }],
    },
    {
      code: 'expect("Saved").toBeTruthy();',
      errors: [{ messageId: "constant" }],
    },
    {
      code: "expect(undefined).toBeUndefined();",
      errors: [{ messageId: "constant" }],
    },
    {
      code: "expect(response).toBeDefined();",
      errors: [{ messageId: "existence" }],
    },
    {
      code: "expect(taskResponse).toBeTruthy();",
      errors: [{ messageId: "existence" }],
    },
    {
      code: "expect(await response.json()).not.toBeNull();",
      errors: [{ messageId: "existence" }],
    },
    {
      code: "expect(body).not.toBeUndefined();",
      errors: [{ messageId: "existence" }],
    },
  ],
});
