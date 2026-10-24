import { AST_NODE_TYPES as T } from "@typescript-eslint/utils";
import type { TSESTree } from "@typescript-eslint/utils";
import { createRule, descendants, say } from "../ast.ts";

const ID = "no-comparisons-in-page-objects";
const SOURCE = "AGENTS.md#layer-rules";
const COMPARISON = new Set(["===", "!==", "==", "!=", "<", ">", "<=", ">="]);

// Something read from the page: an awaited call, directly or inside the
// operand (`(await this.toast.textContent()) === "Saved"`).
const readsThePage = (node: TSESTree.Node) =>
  node.type === T.AwaitExpression ||
  descendants(node).some((child) => child.type === T.AwaitExpression);

// Page and Component Objects locate, act and read; the spec compares. A
// comparison of what the page shows, or a throw, is an assertion in another
// form: isSaved() returning `text === "Saved"`, or `if (...) throw`.
export default createRule({
  meta: {
    type: "problem",
    messages: {
      comparison: say(
        ID,
        "A Page or Component Object compares what the page shows. Return the locator or the value, and assert it in the spec with a web-first assertion.",
        SOURCE,
      ),
      thrown: say(
        ID,
        "A Page or Component Object throws, which is an assertion in another form. Return the locator or the value, and assert it in the spec.",
        SOURCE,
      ),
    },
    schema: [],
  },
  defaultOptions: [],
  create: (context) => ({
    BinaryExpression(node) {
      if (!COMPARISON.has(node.operator)) return;
      if (readsThePage(node.left) || readsThePage(node.right)) {
        context.report({ node, messageId: "comparison" });
      }
    },
    ThrowStatement(node) {
      context.report({ node, messageId: "thrown" });
    },
  }),
});
