import { AST_NODE_TYPES as T } from "@typescript-eslint/utils";
import type { TSESTree } from "@typescript-eslint/utils";
import { assertion, createRule, say } from "../ast.ts";

const ID = "no-boolean-wrapped-assertions";
const SOURCE = "framework/docs/TESTING_STANDARDS.md#negative-api-test-standard";

const isBoolean = (node: TSESTree.Node | undefined) =>
  node?.type === T.Literal && typeof node.value === "boolean";

// expect(isError(body)).toBe(true), expect(!check(x)).toBeFalsy(): a failure
// only says true or false, not which field is wrong.
export default createRule({
  meta: {
    type: "problem",
    messages: {
      wrapped: say(
        ID,
        "This assertion wraps a check in a function and only reports true or false. Assert the fields directly, as the templates do: expect(body.error).toBe(...), or toEqual on a nested object.",
        SOURCE,
      ),
    },
    schema: [],
  },
  defaultOptions: [],
  create: (context) => ({
    CallExpression(node) {
      const found = assertion(node);
      if (!found) return;

      const subject =
        found.subject?.type === T.UnaryExpression &&
        found.subject.operator === "!"
          ? found.subject.argument
          : found.subject;
      const booleanMatcher =
        (found.matcher === "toBe" && isBoolean(node.arguments[0])) ||
        found.matcher === "toBeTruthy" ||
        found.matcher === "toBeFalsy";

      if (subject?.type === T.CallExpression && booleanMatcher) {
        context.report({ node, messageId: "wrapped" });
      }
    },
  }),
});
