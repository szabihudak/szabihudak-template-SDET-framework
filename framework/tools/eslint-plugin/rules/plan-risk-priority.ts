import type { MarkdownRuleDefinition } from "@eslint/markdown";
import { say } from "../ast.ts";
import { cases, list, readPlan, SOURCE } from "../plan.ts";
import type { MarkdownNode } from "../plan.ts";

const ID = "plan-risk-priority";
const LEVELS = ["Low", "Medium", "High"];

// Risk level by impact (rows) and likelihood (columns), as in the standard.
const MATRIX: Record<string, Record<string, string>> = {
  High: { Low: "Medium", Medium: "High", High: "High" },
  Medium: { Low: "Low", Medium: "Medium", High: "High" },
  Low: { Low: "Low", Medium: "Low", High: "Medium" },
};
const REASON = /^(Yes|No):\s*\S/;

// Risks are rated by the matrix, every risk is covered by a case, and every
// case takes its Priority from its highest risk and its Regression from the
// regression rule, or says why it differs.
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
        "{{id}} needs at least one risk ID from the Risks table.",
        SOURCE,
      ),
      priority: say(
        ID,
        "{{id}}: Priority is {{expected}}, the highest level of its risks.",
        SOURCE,
      ),
      regression: say(
        ID,
        '{{id}}: Regression is {{expected}} for a {{level}} risk; a different value needs "Yes: <reason>" or "No: <reason>".',
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
        const risks = list(row.cell("risk")?.text ?? "");
        if (!risks.length || risks.some((risk) => !levels.has(risk))) {
          context.report({
            loc: row.node.position!,
            messageId: "risk",
            data: { id },
          });
          continue;
        }
        risks.forEach((risk) => used.add(risk));

        const highest = risks
          .map((risk) => levels.get(risk)!)
          .sort((a, b) => LEVELS.indexOf(b) - LEVELS.indexOf(a))[0];
        const priority = row.cell("priority");
        if (priority?.text !== highest) {
          context.report({
            loc: (priority?.node ?? row.node).position!,
            messageId: "priority",
            data: { id, expected: highest },
          });
        }

        const regression = row.cell("regression");
        const expected = highest === "Low" ? "No" : "Yes";
        if (
          regression?.text !== expected &&
          !REASON.test(regression?.text ?? "")
        ) {
          context.report({
            loc: (regression?.node ?? row.node).position!,
            messageId: "regression",
            data: { id, expected, level: highest },
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
