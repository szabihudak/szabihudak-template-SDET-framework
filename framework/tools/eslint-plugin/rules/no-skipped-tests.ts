import { AST_NODE_TYPES as T } from "@typescript-eslint/utils";
import type { TSESTree } from "@typescript-eslint/utils";
import { code, createRule, previousLine, say } from "../ast.ts";

const ID = "no-skipped-tests";
const SOURCE = "AGENTS.md#hard-rules";
const SKIP = /^test(?:\.describe)?\.(?:skip|fixme|fail)$/;
const QUARANTINE =
  /\/\/\s*quarantine:\s*[^;\n]*\S[^;\n]*;\s*owner:\s*[^;\n]*\S[^;\n]*;\s*exit:\s*\S/;

const isText = (node: TSESTree.Node | undefined) =>
  node?.type === T.TemplateLiteral ||
  (node?.type === T.Literal && typeof node.value === "string");

// test.skip / fixme / fail (and their describe forms) that are not a runtime
// condition with a reason and not a documented quarantine.
export default createRule({
  meta: {
    type: "problem",
    messages: {
      skipped: say(
        ID,
        'Do not skip a test. Skip only for a stated runtime condition, test.skip(condition, "reason"), or quarantine it with "// quarantine: <reason>; owner: <name>; exit: <issue or condition>" on the line above.',
        SOURCE,
      ),
    },
    schema: [],
  },
  defaultOptions: [],
  create: (context) => ({
    CallExpression(node) {
      if (!SKIP.test(code(context, node.callee))) return;

      const [condition] = node.arguments;
      const reason = node.arguments[node.arguments.length - 1];
      const conditionWithReason =
        node.arguments.length >= 2 &&
        !isText(condition) &&
        isText(reason) &&
        context.sourceCode.getText(reason).slice(1, -1).trim() !== "";

      if (
        !conditionWithReason &&
        !QUARANTINE.test(previousLine(context, node))
      ) {
        context.report({ node, messageId: "skipped" });
      }
    },
  }),
});
