import type { MarkdownRuleDefinition } from "@eslint/markdown";
import { say } from "../ast.ts";
import { cases, list, readPlan, SOURCE } from "../plan.ts";
import type { MarkdownNode } from "../plan.ts";

const ID = "plan-coverage";
export const CATEGORIES = [
  "happy path",
  "business rules",
  "equivalence classes and boundary values",
  "invalid and missing input",
  "unauthenticated or unauthorized access",
  "exploratory",
];
const NOT_APPLICABLE = /^not applicable:\s*\S/i;
const CHARTER = /^charter:\s*\S/i;

// The Coverage table names every category with the cases that cover it or the
// reason it does not apply (exploratory: a charter or a reason), and every
// planned case is in at least one category.
const rule: MarkdownRuleDefinition = {
  meta: {
    type: "problem",
    messages: {
      noTable: say(
        ID,
        `The plan needs a "## Coverage" table (Category, Cases or reason) with: ${CATEGORIES.join(", ")}.`,
        SOURCE,
      ),
      missing: say(ID, 'Coverage is missing the "{{category}}" row.', SOURCE),
      unknownCategory: say(
        ID,
        `"{{category}}" is not a coverage category: ${CATEGORIES.join(", ")}.`,
        SOURCE,
      ),
      value: say(
        ID,
        '"{{category}}" needs case IDs from the Cases table or "not applicable: <reason>"{{charter}}.',
        SOURCE,
      ),
      uncovered: say(ID, "{{id}} is in no coverage category.", SOURCE),
    },
    schema: [],
  },
  create: (context) => ({
    root(node) {
      const plan = readPlan(node as unknown as MarkdownNode);
      const table = plan.tables.get("coverage");
      const planned = cases(plan);
      if (!plan.tables.has("cases")) return;
      if (!table) {
        context.report({
          loc: plan.tables.get("cases")!.node.position!,
          messageId: "noTable",
        });
        return;
      }

      const ids = new Set(planned.map((item) => item.id));
      const covered = new Set<string>();
      const seen = new Set<string>();

      for (const row of table.rows) {
        const category = row.cell("category")?.text.toLowerCase() ?? "";
        const value = row.cell("cases or reason");
        const text = value?.text ?? "";
        const where = (value?.node ?? row.node).position!;

        if (!CATEGORIES.includes(category)) {
          context.report({
            loc: row.node.position!,
            messageId: "unknownCategory",
            data: { category },
          });
          continue;
        }
        seen.add(category);

        const exploratory = category === "exploratory";
        const reason =
          NOT_APPLICABLE.test(text) || (exploratory && CHARTER.test(text));
        const items = list(text);
        if (reason) continue;
        if (exploratory || !items.length || items.some((id) => !ids.has(id))) {
          context.report({
            loc: where,
            messageId: "value",
            data: {
              category,
              charter: exploratory
                ? ' or "charter: <what, how long, which risk>"'
                : "",
            },
          });
          continue;
        }
        items.forEach((id) => covered.add(id));
      }

      for (const category of CATEGORIES.filter((item) => !seen.has(item))) {
        context.report({
          loc: table.node.position!,
          messageId: "missing",
          data: { category },
        });
      }
      for (const { id, row } of planned.filter(
        (item) => !covered.has(item.id),
      )) {
        context.report({
          loc: row.node.position!,
          messageId: "uncovered",
          data: { id },
        });
      }
    },
  }),
};

export default rule;
