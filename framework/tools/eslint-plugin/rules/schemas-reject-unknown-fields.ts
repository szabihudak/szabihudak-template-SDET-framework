import { AST_NODE_TYPES as T } from "@typescript-eslint/utils";
import type { TSESTree } from "@typescript-eslint/utils";
import { createRule, say } from "../ast.ts";

const ID = "schemas-reject-unknown-fields";
const SOURCE = "framework/docs/TESTING_STANDARDS.md#schema-standard";

// Type.Object(properties, options) calls whose own options do not set
// additionalProperties: false. Nested objects are checked on their own.
export default createRule({
  meta: {
    type: "problem",
    messages: {
      loose: say(
        ID,
        "This Type.Object does not declare additionalProperties: false, so unexpected fields would pass validation. Add { additionalProperties: false } as its options.",
        SOURCE,
      ),
    },
    schema: [],
  },
  defaultOptions: [],
  create: (context) => ({
    "CallExpression[callee.object.name='Type'][callee.property.name='Object']"(
      node: TSESTree.CallExpression,
    ) {
      const options = node.arguments[1];
      const strict =
        options?.type === T.ObjectExpression &&
        options.properties.some(
          (property) =>
            property.type === T.Property &&
            property.key.type === T.Identifier &&
            property.key.name === "additionalProperties" &&
            property.value.type === T.Literal &&
            property.value.value === false,
        );

      if (!strict) context.report({ node, messageId: "loose" });
    },
  }),
});
