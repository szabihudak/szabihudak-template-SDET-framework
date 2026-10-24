import { AST_NODE_TYPES as T } from "@typescript-eslint/utils";
import type { TSESTree } from "@typescript-eslint/utils";
import { assertion, createRule, say } from "../ast.ts";

const ID = "no-trivial-assertions";
const SOURCE = "AGENTS.md#playwright-rules";
const EXISTENCE = new Set(["toBeDefined", "toBeTruthy"]);
const NOT_EMPTY = new Set(["toBeUndefined", "toBeNull", "toBeFalsy"]);
const RESPONSE = /^(response|res|body|result|json)$|Response$/i;

const unwrap = (node: TSESTree.Node | undefined) =>
  node?.type === T.AwaitExpression ? node.argument : node;

// true, 1, "x", `x`, null, undefined: known before the test runs.
const isConstant = (node: TSESTree.Node | undefined) =>
  node?.type === T.Literal ||
  (node?.type === T.TemplateLiteral && node.expressions.length === 0) ||
  (node?.type === T.Identifier && node.name === "undefined");

// A whole response or body: response, taskResponse, body, await response.json().
function isWholeResponse(node: TSESTree.Node | undefined): boolean {
  const subject = unwrap(node);
  if (subject?.type === T.Identifier) return RESPONSE.test(subject.name);
  return (
    subject?.type === T.CallExpression &&
    subject.callee.type === T.MemberExpression &&
    subject.callee.property.type === T.Identifier &&
    subject.callee.property.name === "json"
  );
}

// expect(true).toBe(true) passes whatever the application does;
// expect(response).toBeDefined() passes for any response, also an error.
export default createRule({
  meta: {
    type: "problem",
    messages: {
      constant: say(
        ID,
        "This assertion checks a value written in the test, so it passes whatever the application does. Assert an outcome of the behavior under test.",
        SOURCE,
      ),
      existence: say(
        ID,
        "This assertion only checks that a response exists, so an error response passes too. Assert the status, validate the schema and assert the fields.",
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

      if (isConstant(found.subject)) {
        context.report({ node, messageId: "constant" });
        return;
      }
      const existence = found.negated
        ? NOT_EMPTY.has(found.matcher)
        : EXISTENCE.has(found.matcher);
      if (existence && isWholeResponse(found.subject)) {
        context.report({ node, messageId: "existence" });
      }
    },
  }),
});
