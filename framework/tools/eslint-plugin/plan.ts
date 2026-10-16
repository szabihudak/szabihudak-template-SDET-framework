// Markdown syntax-tree helpers for the test plan rules: the plan's sections,
// their tables by column name, the steps in a cell and the coverage categories.

export const SOURCE =
  "framework/docs/TESTING_STANDARDS.md#test-design-standard";

// The parts of an mdast node the plan rules read.
export type MarkdownNode = {
  type: string;
  children?: MarkdownNode[];
  value?: string;
  depth?: number;
  ordered?: boolean | null;
  position?: {
    start: { line: number; column: number };
    end: { line: number; column: number };
  };
};

export type Cell = { text: string; node: MarkdownNode };
export type Row = {
  node: MarkdownNode;
  cell(column: string): Cell | undefined;
};
export type PlanTable = { node: MarkdownNode; columns: string[]; rows: Row[] };
export type Plan = {
  tables: Map<string, PlanTable>;
  stepsSection?: MarkdownNode;
};

// The coverage categories in plan order, the techniques that place a case in
// each, and the types a case there may have.
export const CATEGORIES = [
  { name: "happy path", techniques: ["happy path"], types: ["Positive"] },
  {
    name: "boundary values",
    techniques: ["boundary value analysis"],
    types: ["Positive", "Negative"],
  },
  {
    name: "equivalence classes",
    techniques: ["equivalence partitioning"],
    types: ["Positive", "Negative"],
  },
  {
    name: "business flow",
    techniques: ["business rule", "decision table", "state transition"],
    types: ["Positive", "Negative"],
  },
  {
    name: "error handling",
    techniques: ["error guessing"],
    types: ["Negative"],
  },
  { name: "exploratory", techniques: [], types: [] },
];
export const TECHNIQUES = CATEGORIES.flatMap((item) => item.techniques);
export const TYPES = ["Positive", "Negative"];
export const PRIORITIES = ["High", "Medium", "Low"];

// The category a technique places a case in: "decision table" → business flow.
export const categoryOf = (technique: string) =>
  CATEGORIES.find((item) => item.techniques.includes(technique.toLowerCase()));

// Plain text of a node: "`T001_Login_API`" → "T001_Login_API".
export function text(node: MarkdownNode): string {
  return (node.value ?? (node.children ?? []).map(text).join("")).trim();
}

function table(node: MarkdownNode): PlanTable {
  const [header, ...rows] = node.children ?? [];
  const columns = (header?.children ?? []).map((cell) =>
    text(cell).toLowerCase(),
  );

  return {
    node,
    columns,
    rows: rows.map((row) => ({
      node: row,
      cell: (column) => {
        const cell = row.children?.[columns.indexOf(column)];
        return cell && { text: text(cell), node: cell };
      },
    })),
  };
}

// The first table of every "## <Section>" (by lowercase title), and the old
// "## Steps" section if a plan still has one.
export function readPlan(root: MarkdownNode): Plan {
  const plan: Plan = { tables: new Map() };
  let section = "";

  for (const node of root.children ?? []) {
    if (node.type === "heading" && node.depth === 2) {
      section = text(node).toLowerCase();
      if (section === "steps") plan.stepsSection = node;
    } else if (node.type === "table" && !plan.tables.has(section)) {
      plan.tables.set(section, table(node));
    }
  }
  return plan;
}

// The steps of a cell, split at <br>: "1. Log in<br>2. Check" → both steps.
export function steps(cell: Cell): string[] {
  const parts: string[] = [""];
  for (const child of cell.node.children ?? []) {
    if (child.type === "html" && /^<br\s*\/?>$/i.test(child.value ?? "")) {
      parts.push("");
    } else {
      parts[parts.length - 1] += child.value ?? text(child);
    }
  }
  return parts.map((part) => part.trim()).filter(Boolean);
}

// The Cases rows that have an ID.
export const cases = (plan: Plan) =>
  (plan.tables.get("cases")?.rows ?? []).flatMap((row) => {
    const id = row.cell("id");
    return id?.text ? [{ id: id.text, row }] : [];
  });

// "T001_Login_API, T002_Login_API" → both IDs.
export const list = (value: string) =>
  value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
