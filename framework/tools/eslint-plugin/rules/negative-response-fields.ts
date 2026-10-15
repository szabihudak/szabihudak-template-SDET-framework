import type { TSESTree } from "@typescript-eslint/utils";
import {
  assertions,
  code,
  createRule,
  ERROR_STATUS,
  responseBodies,
  say,
  tests,
} from "../ast.ts";

const ID = "negative-response-fields";
const SOURCE = "framework/docs/TESTING_STANDARDS.md#negative-api-test-standard";

// An error response that is read must have its error fields asserted.
export default createRule({
  meta: {
    type: "problem",
    messages: {
      noFields: say(
        ID,
        "This test reads an error response but asserts none of its fields. Assert the error fields directly, as in api-scenario-spec.",
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
        const unasserted = responseBodies(context, callback).some(
          ({ variable, status }) =>
            status &&
            ERROR_STATUS.test(status) &&
            !subjects.some((subject) =>
              new RegExp(`^${variable}(?:$|[.[])`).test(subject),
            ),
        );

        if (unasserted) context.report({ node: call, messageId: "noFields" });
      }
    },
  }),
});
