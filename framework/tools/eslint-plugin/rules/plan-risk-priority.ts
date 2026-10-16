import type { MarkdownRuleDefinition } from "@eslint/markdown";
import { say } from "../ast.ts";
import { cases, readPlan, SOURCE } from "../plan.ts";
import type { MarkdownNode } from "../plan.ts";

const ID = "plan-risk-priority";
// Risk level by impact (rows) and likelihood (columns), as in the standard.
const MATRIX: Record<string, Record<string, string>> = {
  High: { Low: "Medium", Medium: "High", High: "High" },
  Medium: { Low: "Low", Medium: "Medium", High: "High" },
  Low: { Low: "Low", Medium: "Low", High: "Medium" },
};
// The only reasons a case may differ from the regression rule (Yes for a High
// or Medium risk, No for a Low one), by the value the rule expects.
export const REASONS: Record<string, string[]> = {
  Yes: [
    "No: persistent data without cleanup",
    "No: depends on unstable or external state",
    "No: manual only",
  ],
  No: ["Yes: main path, cheap and stable"],
};

// Risks are rated by the matrix, every risk is covered by a case, and every
// case names one risk, takes its Priority from that risk's level and its
// Regression from the regression rule or one of its fixed reasons.
const rule: MarkdownRuleDefinition = {
  meta: {
    type: "problem",
    messages: {
      noTable: say(
        ID,
        'The plan needs a "## Risks" table (ID, Risk, Impact, Likelihood, Level).',
        SOURCE,
      ),
      rating: say(
        ID,
        "{{id}}: Impact and Likelihood must be High, Medium or Low.",
        SOURCE,
      ),
      level: say(
        ID,
        "{{id}}: Level is {{expected}} for impact {{impact}} and likelihood {{likelihood}}.",
        SOURCE,
      ),
      uncovered: say(ID, "{{id}} is not covered by any case.", SOURCE),
      risk: say(
        ID,
        "{{id}} needs exactly one risk ID from the Risks table.",
        SOURCE,
      ),
      priority: say(
        ID,
        "{{id}}: Priority is {{expected}}, the level of {{risk}}.",
        SOURCE,
      ),
      regression: say(
        ID,
        "{{id}}: Regression is {{expected}} for a {{level}} risk, or one of: {{reasons}}.",
        SOURCE,
      ),
    },
    schema: [],
  },
  create: (context) => ({
    root(node) {
      const plan = readPlan(node as unknown as MarkdownNode);
      const table = plan.tables.get("risks");
      if (!plan.tables.has("cases")) return;
      if (!table) {
        context.report({
          loc: plan.tables.get("cases")!.node.position!,
          messageId: "noTable",
        });
        return;
      }

      const levels = new Map<string, string>();
      for (const row of table.rows) {
        const id = row.cell("id")?.text ?? "";
        const impact = row.cell("impact")?.text ?? "";
        const likelihood = row.cell("likelihood")?.text ?? "";
        const level = row.cell("level");
        const expected = MATRIX[impact]?.[likelihood];

        if (!expected) {
          context.report({
            loc: row.node.position!,
            messageId: "rating",
            data: { id },
          });
          continue;
        }
        levels.set(id, expected);
        if (level?.text !== expected) {
          context.report({
            loc: (level?.node ?? row.node).position!,
            messageId: "level",
            data: { id, expected, impact, likelihood },
          });
        }
      }

      const used = new Set<string>();
      for (const { id, row } of cases(plan)) {
        const risk = row.cell("risk")?.text ?? "";
        const level = levels.get(risk);
        if (!level) {
          context.report({
            loc: (row.cell("risk")?.node ?? row.node).position!,
            messageId: "risk",
            data: { id },
          });
          continue;
        }
        used.add(risk);

        const priority = row.cell("priority");
        if (priority?.text !== level) {
          context.report({
            loc: (priority?.node ?? row.node).position!,
            messageId: "priority",
            data: { id, expected: level, risk },
          });
        }

        const regression = row.cell("regression")?.text ?? "";
        const expected = level === "Low" ? "No" : "Yes";
        if (
          regression !== expected &&
          !REASONS[expected].includes(regression)
        ) {
          context.report({
            loc: (row.cell("regression")?.node ?? row.node).position!,
            messageId: "regression",
            data: {
              id,
              expected,
              level,
              reasons: REASONS[expected].map((r) => `"${r}"`).join(", "),
            },
          });
        }
      }

      for (const row of table.rows) {
        const id = row.cell("id")?.text ?? "";
        if (levels.has(id) && !used.has(id)) {
          context.report({
            loc: row.node.position!,
            messageId: "uncovered",
            data: { id },
          });
        }
      }
    },
  }),
};

export default rule;
