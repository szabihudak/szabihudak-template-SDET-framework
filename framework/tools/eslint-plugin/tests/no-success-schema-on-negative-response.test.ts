import rule from "../rules/no-success-schema-on-negative-response.ts";
import { run, spec } from "./tester.ts";

const test = (status: string, body: string) =>
  spec(`  test("case", async ({ taskApi }) => {
    const response = await taskApi.getTask("id");
    expect(response.status()).toBe(${status});
    const body = await response.json();
${body}
  });`);

run("no-success-schema-on-negative-response", rule, {
  valid: [
    test(
      "HTTP_STATUS.OK",
      '    validateSchema(taskResponseSchema, body);\n    expect(body.title).toBe("t");',
    ),
    test("404", '    expect(body.error).toBe("Not found");'),
  ],
  invalid: [
    {
      code: test(
        "HTTP_STATUS.NOT_FOUND",
        "    validateSchema(taskResponseSchema, body);",
      ),
      errors: [{ messageId: "validated" }],
    },
    {
      code: test("400", "    validateSchema(errorSchema, body);"),
      errors: [{ messageId: "validated" }],
    },
  ],
});
