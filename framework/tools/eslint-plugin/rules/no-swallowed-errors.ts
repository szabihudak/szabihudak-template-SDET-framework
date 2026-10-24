import { AST_NODE_TYPES as T } from "@typescript-eslint/utils";
import type { TSESTree } from "@typescript-eslint/utils";
import { createRule, say } from "../ast.ts";

const ID = "no-swallowed-errors";
const SOURCE = "AGENTS.md#hard-rules";

// true, 1, "x", null, undefined: a fixed answer in place of the failure.
const isConstant = (node: TSESTree.Node | null | undefined) =>
  !node ||
  node.type === T.Literal ||
  (node.type === T.Identifier && node.name === "undefined");

// A block that does nothing, or only returns a fixed value.
const swallows = (body: TSESTree.BlockStatement) =>
  body.body.length === 0 ||
  (body.body.length === 1 &&
    body.body[0].type === T.ReturnStatement &&
    isConstant(body.body[0].argument));

const isFunction = (
  node: TSESTree.Node | undefined,
): node is TSESTree.ArrowFunctionExpression | TSESTree.FunctionExpression =>
  node?.type === T.ArrowFunctionExpression ||
  node?.type === T.FunctionExpression;

// try { ... } catch {}, catch { return false }, .catch(() => {}),
// .catch(() => null): the failure disappears and the test or the caller
// goes on as if the step had worked.
export default createRule({
  meta: {
    type: "problem",
    messages: {
      swallowed: say(
        ID,
        "This catch discards the error, so a real failure passes unnoticed. Let it fail, or handle a named, expected error and say why.",
        SOURCE,
      ),
    },
    schema: [],
  },
  defaultOptions: [],
  create: (context) => ({
    CatchClause(node) {
      if (swallows(node.body)) {
        context.report({ node, messageId: "swallowed" });
      }
    },
    CallExpression(node) {
      const callee = node.callee;
      if (
        callee.type !== T.MemberExpression ||
        callee.property.type !== T.Identifier ||
        callee.property.name !== "catch"
      ) {
        return;
      }
      const [handler] = node.arguments;
      if (!isFunction(handler)) return;

      const body = handler.body;
      if (body.type === T.BlockStatement ? swallows(body) : isConstant(body)) {
        context.report({ node, messageId: "swallowed" });
      }
    },
  }),
});
