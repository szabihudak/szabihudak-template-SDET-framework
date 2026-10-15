import { AST_NODE_TYPES as T } from "@typescript-eslint/utils";
import type { TSESTree } from "@typescript-eslint/utils";
import { createRule, descendants, previousLine, say } from "../ast.ts";

const ID = "shared-visual-options";
const SOURCE =
  "framework/docs/TESTING_STANDARDS.md#visual-regression-test-standard";
const OWN_OPTIONS = new Set([
  "maxDiffPixels",
  "maxDiffPixelRatio",
  "threshold",
  "mask",
  "maskColor",
]);
const VISUAL_EXCEPTION = /\/\/\s*visual-exception:\s*\S.*\(\s*\S[^)]*\)/;

// toHaveScreenshot() calls without the shared options, or with their own
// tolerances or masks and no documented exception.
export default createRule({
  meta: {
    type: "problem",
    messages: {
      deviation: say(
        ID,
        'Pass VISUAL_COMPARISON_OPTIONS to toHaveScreenshot(). A tolerance or mask needs "// visual-exception: <element> (<why it cannot be made deterministic>)" on the line above.',
        SOURCE,
      ),
    },
    schema: [],
  },
  defaultOptions: [],
  create: (context) => ({
    "CallExpression[callee.property.name='toHaveScreenshot']"(
      node: TSESTree.CallExpression,
    ) {
      const inside = node.arguments.flatMap((argument) => [
        argument,
        ...descendants(argument),
      ]);
      const shared = inside.some(
        (child) =>
          child.type === T.Identifier &&
          child.name === "VISUAL_COMPARISON_OPTIONS",
      );
      const own = inside.some(
        (child) =>
          child.type === T.Property &&
          child.key.type === T.Identifier &&
          OWN_OPTIONS.has(child.key.name),
      );

      if (
        !shared ||
        (own && !VISUAL_EXCEPTION.test(previousLine(context, node)))
      ) {
        context.report({ node, messageId: "deviation" });
      }
    },
  }),
});
