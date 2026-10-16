import type { MarkdownRuleDefinition } from "@eslint/markdown";
import { say } from "../ast.ts";
import { cases, categoryOf, readPlan, SOURCE, TECHNIQUES } from "../plan.ts";
import type { MarkdownNode } from "../plan.ts";

const ID = "plan-case-technique";

// Every planned case names exactly one test design technique from the list and
// a Type (Positive or Negative) that the technique's category allows.
const rule: MarkdownRuleDefinition = {
  meta: {
    type: "problem",
    messages: {
      noColumn: say(ID, "The Cases table needs a {{column}} column.", SOURCE),
      technique: say(
        ID,
        `{{id}} needs exactly one technique: ${TECHNIQUES.join(", ")}.`,
        SOURCE,
      ),
      type: say(
        ID,
        "{{id}}: Type is {{types}} for a {{category}} case.",
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

      const missing = ["technique", "type"].filter(
        (column) => !table.columns.includes(column),
      );
      for (const column of missing) {
        context.report({
          loc: table.node.position!,
          messageId: "noColumn",
          data: { column: column[0].toUpperCase() + column.slice(1) },
        });
      }
      if (missing.length) return;

      for (const { id, row } of cases(plan)) {
        const technique = row.cell("technique");
        const category = categoryOf(technique?.text ?? "");
        if (!category) {
          context.report({
            loc: (technique?.node ?? row.node).position!,
            messageId: "technique",
            data: { id },
          });
          continue;
        }
        const type = row.cell("type");
        if (!category.types.includes(type?.text ?? "")) {
          context.report({
            loc: (type?.node ?? row.node).position!,
            messageId: "type",
            data: {
              id,
              category: category.name,
              types: category.types.join(" or "),
            },
          });
        }
      }
    },
  }),
};

export default rule;
