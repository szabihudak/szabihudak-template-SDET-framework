import type { MarkdownRuleDefinition } from "@eslint/markdown";
import { say } from "../ast.ts";
import {
  CATEGORIES,
  cases,
  categoryOf,
  list,
  PRIORITIES,
  readPlan,
  SOURCE,
  TYPES,
} from "../plan.ts";
import type { MarkdownNode } from "../plan.ts";

const ID = "plan-coverage";
const NAMES = CATEGORIES.map((item) => item.name);
const NOT_APPLICABLE = /^not applicable:\s*\S/i;
const CHARTER = /^charter:\s*\S/i;

// The Coverage table has every category in order, each with the cases its
// technique places there or the reason it does not apply (exploratory: a
// charter or a reason), and every planned case is in its own category only.
// The Cases table is ordered by category, then Type, then Priority.
const rule: MarkdownRuleDefinition = {
  meta: {
    type: "problem",
    messages: {
      noTable: say(
        ID,
        `The plan needs a "## Coverage" table (Category, Cases or reason) with: ${NAMES.join(", ")}.`,
        SOURCE,
      ),
      missing: say(ID, 'Coverage is missing the "{{category}}" row.', SOURCE),
      unknownCategory: say(
        ID,
        `"{{category}}" is not a coverage category: ${NAMES.join(", ")}.`,
        SOURCE,
      ),
      order: say(
        ID,
        `"{{category}}" belongs before "{{previous}}"; the order is: ${NAMES.join(", ")}.`,
        SOURCE,
      ),
      value: say(
        ID,
        '"{{category}}" needs case IDs from the Cases table or "not applicable: <reason>"{{charter}}.',
        SOURCE,
      ),
      wrongCategory: say(
        ID,
        '{{id}} ({{technique}}) belongs in "{{expected}}" only.',
        SOURCE,
      ),
      uncovered: say(ID, '{{id}} is missing from "{{expected}}".', SOURCE),
      caseOrder: say(
        ID,
        "{{id}} belongs before {{previous}}: cases are ordered by category, then Positive before Negative, then Priority High, Medium, Low.",
        SOURCE,
      ),
    },
    schema: [],
  },
  create: (context) => ({
    root(node) {
      const plan = readPlan(node as unknown as MarkdownNode);
      const table = plan.tables.get("coverage");
      if (!plan.tables.has("cases")) return;

      // Category of each case from its technique; the technique rule reports
      // a case without one.
      const planned = cases(plan).map((item) => ({
        ...item,
        technique: item.row.cell("technique")?.text.toLowerCase() ?? "",
        category: categoryOf(item.row.cell("technique")?.text ?? ""),
      }));

      let previous: { id: string; key: number[] } | undefined;
      for (const { id, row, category } of planned) {
        const key = [
          NAMES.indexOf(category?.name ?? ""),
          TYPES.indexOf(row.cell("type")?.text ?? ""),
          PRIORITIES.indexOf(row.cell("priority")?.text ?? ""),
        ];
        if (key.includes(-1)) continue;
        const before = previous?.key.findIndex((value, i) => value !== key[i]);
        if (previous && before !== -1 && previous.key[before!] > key[before!]) {
          context.report({
            loc: row.node.position!,
            messageId: "caseOrder",
            data: { id, previous: previous.id },
          });
        }
        previous = { id, key };
      }

      if (!table) {
        context.report({
          loc: plan.tables.get("cases")!.node.position!,
          messageId: "noTable",
        });
        return;
      }

      const ids = new Map(planned.map((item) => [item.id, item]));
      const listed = new Map<string, string[]>();
      const seen: string[] = [];

      for (const row of table.rows) {
        const category = row.cell("category")?.text.toLowerCase() ?? "";
        const value = row.cell("cases or reason");
        const text = value?.text ?? "";
        const where = (value?.node ?? row.node).position!;

        if (!NAMES.includes(category)) {
          context.report({
            loc: row.node.position!,
            messageId: "unknownCategory",
            data: { category },
          });
          continue;
        }
        const last = seen[seen.length - 1];
        if (last && NAMES.indexOf(last) > NAMES.indexOf(category)) {
          context.report({
            loc: row.node.position!,
            messageId: "order",
            data: { category, previous: last },
          });
        }
        seen.push(category);

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
        for (const id of items) {
          listed.set(id, [...(listed.get(id) ?? []), category]);
          const item = ids.get(id)!;
          if (item.category && item.category.name !== category) {
            context.report({
              loc: where,
              messageId: "wrongCategory",
              data: {
                id,
                technique: item.technique,
                expected: item.category.name,
              },
            });
          }
        }
      }

      for (const category of NAMES.filter((item) => !seen.includes(item))) {
        context.report({
          loc: table.node.position!,
          messageId: "missing",
          data: { category },
        });
      }
      for (const { id, row, category } of planned) {
        if (category && !listed.get(id)?.includes(category.name)) {
          context.report({
            loc: row.node.position!,
            messageId: "uncovered",
            data: { id, expected: category.name },
          });
        }
      }
    },
  }),
};

export default rule;
