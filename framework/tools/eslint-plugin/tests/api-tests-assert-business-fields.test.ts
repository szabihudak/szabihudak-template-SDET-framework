import rule from "../rules/api-tests-assert-business-fields.ts";
import { run, spec } from "./tester.ts";

const test = (assertion: string) =>
  spec(`  test("reads a task", async ({ taskApi }) => {
    const response = await taskApi.getTask("id");
    const body = await response.json();
    validateSchema(taskResponseSchema, body);
${assertion}
  });`);

run("api-tests-assert-business-fields", rule, {
  valid: [
    test('    expect(body.title).toBe("title");'),
    test("    expect(body).toEqual(expected);"),
  ],
  invalid: [
    {
      code: test("    expect(response.status()).toBe(200);"),
      errors: [{ messageId: "schemaOnly" }],
    },
  ],
});
