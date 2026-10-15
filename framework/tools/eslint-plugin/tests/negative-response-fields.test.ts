import rule from "../rules/negative-response-fields.ts";
import { run, spec } from "./tester.ts";

const test = (steps: string) =>
  spec(`  test("rejects a missing token", async ({ taskApi }) => {
    const response = await taskApi.createTask(taskData, "");
    expect(response.status()).toBe(HTTP_STATUS.UNAUTHORIZED);
    const body = await response.json();
${steps}
  });`);

run("negative-response-fields", rule, {
  valid: [
    test('    expect(body.error).toBe("Unauthorized");'),
    test('    expect(body).toEqual({ error: "Unauthorized" });'),
    test('    expect(body["error"]).toBe("Unauthorized");'),
  ],
  invalid: [
    { code: test(""), errors: [{ messageId: "noFields" }] },
    {
      code: test("    expect(isAuthError(body)).toBe(true);"),
      errors: [{ messageId: "noFields" }],
    },
  ],
});
