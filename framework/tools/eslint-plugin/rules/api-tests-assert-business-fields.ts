import type { TSESTree } from "@typescript-eslint/utils";
import {
  assertions,
  code,
  createRule,
  say,
  schemaValidations,
  tests,
} from "../ast.ts";

const ID = "api-tests-assert-business-fields";
const SOURCE = "framework/docs/TESTING_STANDARDS.md#api-test-standard";

// A test that validates a body against a schema must also assert something of
// that body; api-field-coverage decides whether every field is asserted.
export default createRule({
  meta: {
    type: "problem",
    messages: {
      schemaOnly: say(
        ID,
        "This test validates the schema but asserts no field of the body. Assert the business values of the response fields.",
        SOURCE,
      ),
    },
    schema: [],
  },
  defaultOptions: [],
  create: (context) => ({
    "Program:exit"(program: TSESTree.Program) {
      for (const { call, callback } of tests(program)) {
        const subjects = assertions(callback).map(({ subject }) =>
          code(context, subject),
        );
        const unasserted = schemaValidations(callback).some(
          ({ variable }) =>
            !subjects.some((subject) =>
              new RegExp(`^${variable}(?![\\w$])`).test(subject),
            ),
        );

        if (unasserted) context.report({ node: call, messageId: "schemaOnly" });
      }
    },
  }),
});
