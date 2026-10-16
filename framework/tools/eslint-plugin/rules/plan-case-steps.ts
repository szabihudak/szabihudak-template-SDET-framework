import type { MarkdownRuleDefinition } from "@eslint/markdown";
import { say } from "../ast.ts";
import { cases, readPlan, SOURCE } from "../plan.ts";
import type { MarkdownNode } from "../plan.ts";

const ID = "plan-case-steps";

// Every planned case has its steps: "### <case ID>" under "## Steps" with a
// numbered list. A Steps heading without a planned case is reported too.
const rule: MarkdownRuleDefinition = {
  meta: {
    type: "problem",
    messages: {
      missing: say(
        ID,
        '{{id}} needs "### {{id}}" under "## Steps" with numbered steps.',
        SOURCE,
      ),
      unknown: say(ID, "{{id}} is not a case in the Cases table.", SOURCE),
    },
    schema: [],
  },
  create: (context) => ({
    root(node) {
      const plan = readPlan(node as unknown as MarkdownNode);
      const planned = cases(plan);

      for (const { id, row } of planned) {
        if (!plan.steps.get(id)?.items) {
          context.report({
            loc: (row.cell("id")?.node ?? row.node).position!,
            messageId: "missing",
            data: { id },
          });
        }
      }
      for (const [id, { heading }] of plan.steps) {
        if (!planned.some((item) => item.id === id)) {
          context.report({
            loc: heading.position!,
            messageId: "unknown",
            data: { id },
          });
        }
      }
    },
  }),
};

export default rule;
