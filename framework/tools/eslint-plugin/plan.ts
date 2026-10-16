// Markdown syntax-tree helpers for the test plan rules: the plan's sections,
// their tables by column name, and the Steps heading of every case.

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
export type Steps = { heading: MarkdownNode; items: number };
export type Plan = {
  tables: Map<string, PlanTable>;
  steps: Map<string, Steps>;
  stepsSection?: MarkdownNode;
};

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

// The first table of every "## <Section>" (by lowercase title) and the
// numbered steps under each "### <case ID>" of "## Steps".
export function readPlan(root: MarkdownNode): Plan {
  const plan: Plan = { tables: new Map(), steps: new Map() };
  let section = "";
  let steps: Steps | undefined;

  for (const node of root.children ?? []) {
    if (node.type === "heading" && node.depth === 2) {
      section = text(node).toLowerCase();
      steps = undefined;
      if (section === "steps") plan.stepsSection = node;
    } else if (node.type === "heading" && section === "steps") {
      steps = { heading: node, items: 0 };
      plan.steps.set(text(node), steps);
    } else if (node.type === "table" && !plan.tables.has(section)) {
      plan.tables.set(section, table(node));
    } else if (node.type === "list" && node.ordered && steps) {
      steps.items += node.children?.length ?? 0;
    }
  }
  return plan;
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
