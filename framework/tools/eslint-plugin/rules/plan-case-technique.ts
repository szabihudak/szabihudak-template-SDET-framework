import type { MarkdownRuleDefinition } from "@eslint/markdown";
import { say } from "../ast.ts";
import { cases, readPlan, SOURCE } from "../plan.ts";
import type { MarkdownNode } from "../plan.ts";

const ID = "plan-case-technique";
export const TECHNIQUES = [
  "happy path",
  "equivalence partitioning",
  "boundary value analysis",
  "decision table",
  "state transition",
  "business rule",
  "error guessing",
];

// Every planned case names exactly one test design technique from the list.
const rule: MarkdownRuleDefinition = {
  meta: {
    type: "problem",
    messages: {
      noColumn: say(ID, "The Cases table needs a Technique column.", SOURCE),
      technique: say(
        ID,
        `{{id}} needs exactly one technique: ${TECHNIQUES.join(", ")}.`,
        SOURCE,
      ),
    },
    schema: [],
  },
  create: (context) => ({
    root(node) {
      const plan = readPlan(node as unknown as MarkdownNode);
      const table = plan.tables.get("cases");
      if (!table) return;

      if (!table.columns.includes("technique")) {
        context.report({ loc: table.node.position!, messageId: "noColumn" });
        return;
      }
      for (const { id, row } of cases(plan)) {
        const technique = row.cell("technique");
        if (!TECHNIQUES.includes(technique?.text.toLowerCase() ?? "")) {
          context.report({
            loc: (technique?.node ?? row.node).position!,
            messageId: "technique",
            data: { id },
          });
        }
      }
    },
  }),
};

export default rule;
