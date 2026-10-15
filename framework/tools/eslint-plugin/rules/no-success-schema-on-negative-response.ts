import type { TSESTree } from "@typescript-eslint/utils";
import { assertions, callsTo, code, createRule, say, tests } from "../ast.ts";

const ID = "no-success-schema-on-negative-response";
const SOURCE = "AGENTS.md#hard-rules";
const CLIENT_ERROR =
  /^(?:HTTP_STATUS\.(?:BAD_REQUEST|UNAUTHORIZED|FORBIDDEN|NOT_FOUND|METHOD_NOT_ALLOWED|CONFLICT)|4\d\d)$/;

// A test that expects a 4xx status must not validate the body against a
// success schema. Scenario tests with a variable status are not detected; the
// rule only reports what it can prove.
export default createRule({
  meta: {
    type: "problem",
    messages: {
      validated: say(
        ID,
        "A test that expects a 4xx status must not validate the body against a success schema. Assert the error fields instead; validated setup data comes from a client setup helper.",
        SOURCE,
      ),
    },
    schema: [],
  },
  defaultOptions: [],
  create: (context) => ({
    "Program:exit"(program: TSESTree.Program) {
      for (const { call, callback } of tests(program)) {
        const expectsClientError = assertions(callback).some(
          ({ matcher, call: assertion }) =>
            matcher === "toBe" &&
            CLIENT_ERROR.test(code(context, assertion.arguments[0])),
        );

        if (
          expectsClientError &&
          callsTo(callback, "validateSchema").length > 0
        ) {
          context.report({ node: call, messageId: "validated" });
        }
      }
    },
  }),
});
