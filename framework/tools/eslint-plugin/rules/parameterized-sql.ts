import { AST_NODE_TYPES as T } from "@typescript-eslint/utils";
import type { TSESTree } from "@typescript-eslint/utils";
import { createRule, say } from "../ast.ts";

const ID = "parameterized-sql";
const SOURCE = "AGENTS.md#layer-rules";
const SQL_STATEMENT =
  /\b(?:SELECT|INSERT\s+INTO|UPDATE|DELETE\s+FROM|DROP|CREATE|ALTER|TRUNCATE)\b/;

const isSqlString = (node: TSESTree.Node) =>
  node.type === T.Literal &&
  typeof node.value === "string" &&
  SQL_STATEMENT.test(node.value);

// SQL in a template literal with a ${} placeholder, or a string joined with +.
export default createRule({
  meta: {
    type: "problem",
    messages: {
      interpolated: say(
        ID,
        "Do not build SQL from values. Pass them as query parameters ($1, $2) instead.",
        SOURCE,
      ),
    },
    schema: [],
  },
  defaultOptions: [],
  create: (context) => ({
    TemplateLiteral(node) {
      const text = node.quasis.map((quasi) => quasi.value.raw).join(" ");

      if (node.expressions.length > 0 && SQL_STATEMENT.test(text)) {
        context.report({ node, messageId: "interpolated" });
      }
    },
    "BinaryExpression[operator='+']"(node: TSESTree.BinaryExpression) {
      if (isSqlString(node.left) || isSqlString(node.right)) {
        context.report({ node, messageId: "interpolated" });
      }
    },
  }),
});
