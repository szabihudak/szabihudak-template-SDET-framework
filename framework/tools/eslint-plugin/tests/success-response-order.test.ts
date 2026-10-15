import rule from "../rules/success-response-order.ts";
import { run, spec } from "./tester.ts";

const test = (status: string, steps: string) =>
  spec(`  test("creates a task", async ({ taskApi }) => {
    const taskData = createTask();
    const response = await taskApi.createTask(taskData);
    expect(response.status()).toBe(${status});
    const body = await response.json();
${steps}
  });`);

run("success-response-order", rule, {
  valid: [
    test(
      "HTTP_STATUS.CREATED",
      "    validateSchema(taskResponseSchema, body);\n    expect(body.title).toBe(taskData.title);",
    ),
    test("401", '    expect(body.error).toBe("Unauthorized");'),
  ],
  invalid: [
    {
      code: test("201", "    expect(body.title).toBe(taskData.title);"),
      errors: [{ messageId: "notValidated" }],
    },
    {
      code: test(
        "HTTP_STATUS.OK",
        "    expect(body.title).toBe(taskData.title);\n    validateSchema(taskResponseSchema, body);",
      ),
      errors: [{ messageId: "assertedEarly" }],
    },
  ],
});
