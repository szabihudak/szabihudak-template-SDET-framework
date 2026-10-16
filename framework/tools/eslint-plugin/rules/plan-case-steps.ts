import type { MarkdownRuleDefinition } from "@eslint/markdown";
import { say } from "../ast.ts";
import { cases, readPlan, SOURCE, steps } from "../plan.ts";
import type { MarkdownNode } from "../plan.ts";

const ID = "plan-case-steps";
const STEP = /^(\d+)\.\s+\S/;

// Every planned case has at least two steps in its Steps cell, numbered from 1
// and separated by <br>. A separate "## Steps" section is the old format.
const rule: MarkdownRuleDefinition = {
  meta: {
    type: "problem",
    messages: {
      noColumn: say(ID, "The Cases table needs a Steps column.", SOURCE),
      steps: say(
        ID,
        '{{id}} needs at least two steps in its Steps cell, numbered from 1: "1. <step><br>2. <step>".',
        SOURCE,
      ),
      section: say(
        ID,
        '"## Steps" is replaced by the Steps column of the Cases table.',
        SOURCE,
      ),
    },
    schema: [],
  },
  create: (context) => ({
    root(node) {
      const plan = readPlan(node as unknown as MarkdownNode);
      const table = plan.tables.get("cases");

      if (plan.stepsSection) {
        context.report({
          loc: plan.stepsSection.position!,
          messageId: "section",
        });
      }
      if (!table) return;
      if (!table.columns.includes("steps")) {
        context.report({ loc: table.node.position!, messageId: "noColumn" });
        return;
      }
      for (const { id, row } of cases(plan)) {
        const cell = row.cell("steps");
        const items = cell ? steps(cell) : [];
        const numbered = items.every(
          (item, index) => Number(STEP.exec(item)?.[1]) === index + 1,
        );
        if (items.length < 2 || !numbered) {
          context.report({
            loc: (cell?.node ?? row.node).position!,
            messageId: "steps",
            data: { id },
          });
        }
      }
    },
  }),
};

export default rule;
