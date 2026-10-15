import { AST_NODE_TYPES as T } from "@typescript-eslint/utils";
import type { TSESTree } from "@typescript-eslint/utils";
import { createRule, say } from "../ast.ts";

const ID = "no-inline-payload-to-api-client";
const SOURCE = "framework/docs/TESTING_STANDARDS.md#factory-standard";

// taskApi.createTask(...) or fixtures.taskApi.createTask(...).
export function isClientCall(node: TSESTree.CallExpression): boolean {
  if (node.callee.type !== T.MemberExpression) return false;
  const client = node.callee.object;
  const name =
    client.type === T.Identifier
      ? client.name
      : client.type === T.MemberExpression &&
          client.property.type === T.Identifier
        ? client.property.name
        : "";

  return /\wApi$/.test(name) && node.callee.property.type === T.Identifier;
}

// A single-field partial update ({ priority: "high" }) is the scenario itself
// and stays inline; a request with several fields comes from the factory.
export default createRule({
  meta: {
    type: "problem",
    messages: {
      inline: say(
        ID,
        "This API client call gets a request object with several fields written inline. Build it with the domain factory (createX({ ... })) or take it from a scenario array.",
        SOURCE,
      ),
    },
    schema: [],
  },
  defaultOptions: [],
  create: (context) => ({
    CallExpression(node) {
      const inline = node.arguments.some(
        (argument) =>
          argument.type === T.ObjectExpression &&
          argument.properties.length > 1 &&
          argument.properties.every((property) => property.type === T.Property),
      );

      if (isClientCall(node) && inline) {
        context.report({ node, messageId: "inline" });
      }
    },
  }),
});
