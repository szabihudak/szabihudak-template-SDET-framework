import { AST_NODE_TYPES as T } from "@typescript-eslint/utils";
import type { TSESLint, TSESTree } from "@typescript-eslint/utils";
import { createRule, descendants, say, tests } from "../ast.ts";
import { isClientCall } from "./no-inline-payload-to-api-client.ts";

const ID = "similar-tests-as-scenarios";
const SOURCE = "framework/docs/TESTING_STANDARDS.md#negative-api-test-standard";
const SEPARATE_TEST = /^\s*separate-test:\s*\S/;

type Context = Readonly<TSESLint.RuleContext<string, readonly unknown[]>>;

// The node's code with every string and number replaced: what is left is the
// shape of the step, not its data.
const shape = (context: Context, node: TSESTree.Node) =>
  context.sourceCode
    .getTokens(node)
    .map((token) =>
      token.type === "String" || token.type === "Template"
        ? "S"
        : token.type === "Numeric"
          ? "N"
          : token.value,
    )
    .join(" ");

// Client calls and assertion statements of a test, in order.
function skeleton(context: Context, callback: TSESTree.Node): string {
  const nodes = descendants(callback);
  const calls = nodes
    .filter(
      (node): node is TSESTree.CallExpression =>
        node.type === T.CallExpression && isClientCall(node),
    )
    .map((call) => shape(context, call.callee));
  const checks = nodes
    .filter(
      (node): node is TSESTree.ExpressionStatement =>
        node.type === T.ExpressionStatement &&
        /^(await\s+)?expect\b/.test(context.sourceCode.getText(node)),
    )
    .map((statement) => shape(context, statement));

  return calls.length && checks.length
    ? `${calls.join(" ")} | ${checks.join(" ")}`
    : "";
}

// Tests whose client calls and assertions are the same once strings and
// numbers are ignored differ only in data: they belong in one scenario array.
export default createRule({
  meta: {
    type: "problem",
    messages: {
      similar: say(
        ID,
        'Tests at lines {{lines}} differ only in data. Put the cases in a scenario array with caseId and generate them with for (const scenario of ...), as in api-scenario-spec; keep one apart only with "// separate-test: <reason>" above it.',
        SOURCE,
      ),
    },
    schema: [],
  },
  defaultOptions: [],
  create: (context) => ({
    "Program:exit"(program: TSESTree.Program) {
      const groups = new Map<string, TSESTree.CallExpression[]>();

      for (const { call, callback } of tests(program)) {
        const separate = context.sourceCode
          .getCommentsBefore(call.parent ?? call)
          .some((comment) => SEPARATE_TEST.test(comment.value));
        const key = separate ? "" : skeleton(context, callback);
        if (key) groups.set(key, [...(groups.get(key) ?? []), call]);
      }

      for (const group of groups.values()) {
        if (group.length < 2) continue;
        context.report({
          node: group[0],
          messageId: "similar",
          data: { lines: group.map((call) => call.loc.start.line).join(", ") },
        });
      }
    },
  }),
});
