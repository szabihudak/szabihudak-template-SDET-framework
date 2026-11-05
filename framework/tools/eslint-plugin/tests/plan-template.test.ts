import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";

import { PLAN } from "./tester.ts";

// The test-plan-writing skill's template is what planners copy; the plan rules
// read the sample plan PLAN. Every section and column the rules read in PLAN
// must be in the template, so the template and the rules cannot drift apart.
const TEMPLATE = fs.readFileSync(
  path.resolve(
    import.meta.dirname,
    "../../../skills/test-plan-writing/test-plan.template.md",
  ),
  "utf8",
);

const columns = (row: string) =>
  row
    .trim()
    .replace(/^\||\|$/g, "")
    .split("|")
    .map((cell) => cell.trim());

function headerRows(plan: string): Map<string, string[]> {
  const tables = new Map<string, string[]>();
  let section = "";
  for (const line of plan.split("\n")) {
    const heading = /^## (.+)$/.exec(line);
    if (heading) section = heading[1].trim();
    else if (line.startsWith("|") && section && !tables.has(section)) {
      tables.set(section, columns(line));
    }
  }
  return tables;
}

test("the plan template has every section and column the plan rules read", () => {
  const template = headerRows(TEMPLATE);
  for (const [section, sample] of headerRows(PLAN)) {
    const header = template.get(section);
    assert.ok(header, `the plan template has no ${section} table`);
    for (const column of sample) {
      assert.ok(
        header.includes(column),
        `the plan template's ${section} table has no ${column} column`,
      );
    }
  }
});
