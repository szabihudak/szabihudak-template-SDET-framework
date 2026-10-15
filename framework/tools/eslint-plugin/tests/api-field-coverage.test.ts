import path from "node:path";
import rule from "../rules/api-field-coverage.ts";
import { run, spec } from "./tester.ts";

// The reference taskResponseSchema: id, userId, createdAt and updatedAt have a
// format; title, description, status, priority and position do not.
const filename = path.resolve("tests/api/rule-selftest.spec.ts");
const imports =
  'import { validateSchema } from "@framework/api/SchemaValidator";\nimport { taskResponseSchema } from "@app/api/schemas/TaskResponseSchema";';
const read = (assertions: string, comment = "") =>
  spec(
    `${comment}
  test("reads a task", async ({ taskApi }) => {
    const response = await taskApi.getTask("id");
    expect(response.status()).toBe(200);
    const body = await response.json();
    validateSchema(taskResponseSchema, body);
${assertions}
  });`,
    imports,
  );
const allFields = `    expect(body.title).toBe("title");
    expect(body.description).toBeNull();
    expect(body.status).toBe("todo");
    expect(body.priority).toBe("medium");
    expect(body.position).toBe(0);`;

run("api-field-coverage", rule, {
  valid: [
    { filename, code: read(allFields) },
    {
      filename,
      code: read("    expect(body).toEqual(expect.objectContaining({}));"),
    },
    {
      filename,
      code: read(
        allFields.replace("    expect(body.position).toBe(0);", ""),
        "  // unasserted: position (the contract does not define it on read)",
      ),
    },
  ],
  invalid: [
    {
      filename,
      code: read(allFields.replace("    expect(body.position).toBe(0);", "")),
      errors: [
        {
          messageId: "uncovered",
          data: { schema: "taskResponseSchema", field: "position" },
        },
      ],
    },
    {
      filename,
      code: read(
        allFields.replace("    expect(body.position).toBe(0);", ""),
        "  // unasserted: position",
      ),
      errors: [{ messageId: "noReason" }],
    },
    {
      filename,
      code: read(
        allFields.replace(
          'expect(body.title).toBe("title");',
          'expect(body.titles).toBe("title");',
        ),
      ),
      errors: [
        {
          messageId: "uncovered",
          data: { schema: "taskResponseSchema", field: "title" },
        },
      ],
    },
  ],
});
