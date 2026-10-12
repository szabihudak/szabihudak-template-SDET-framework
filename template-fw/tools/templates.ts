import fs from "node:fs";
import path from "node:path";

import * as prettier from "prettier";

type TemplateEntry = {
  id: string;
  need: string;
  template: string;
  // null for patterns the reference implementation does not contain; those
  // are validated by the setup self-test instead of the round trip.
  canonical: string | null;
  output: string;
  rules: string;
};

type TemplateIndex = {
  tokens: Record<string, string>;
  templates: TemplateEntry[];
};

type ProjectExample = {
  id: string;
  need: string;
  file: string;
};

type RoundTripValues = {
  defaults: Record<string, string>;
  templates: Record<string, Record<string, string>>;
};

const ROOT = path.resolve(__dirname, "../..");
const INDEX_PATH = "template-fw/index.json";
const PROJECT_INDEX_PATH = "config/approved-examples.json";
const VALUES_PATH = "template-fw/templates/roundtrip/upex.values.json";
const CATALOGUE_PATH = "template-fw/templates/README.md";
const SNIPPETS_PATH = ".vscode/qa.code-snippets";
const TEMPLATE_DIRECTIVE = /^[ \t]*\/\/ @template\b.*(?:\r?\n|$)/gm;
const TOKEN_PATTERN = /__[A-Za-z]+__/g;

const read = (file: string) => fs.readFileSync(path.join(ROOT, file), "utf8");
const exists = (file: string) => fs.existsSync(path.join(ROOT, file));

function write(file: string, content: string): void {
  fs.mkdirSync(path.dirname(path.join(ROOT, file)), { recursive: true });
  fs.writeFileSync(path.join(ROOT, file), content);
}

function loadIndex(): TemplateIndex {
  return JSON.parse(read(INDEX_PATH));
}

function valuesFor(id: string): Record<string, string> {
  const values: RoundTripValues = JSON.parse(read(VALUES_PATH));

  return { ...values.defaults, ...values.templates[id] };
}

// Longest values first so "TasksDashboard" is matched before "Tasks".
function byLongest(entries: [string, string][], side: 0 | 1) {
  return [...entries].sort((a, b) => b[side].length - a[side].length);
}

function render(template: string, values: Record<string, string>): string {
  let output = template.replace(TEMPLATE_DIRECTIVE, "");

  for (const [token, value] of byLongest(Object.entries(values), 0)) {
    output = output.split(token).join(value);
  }

  return output;
}

function format(source: string, filepath: string): Promise<string> {
  return prettier.format(source, { filepath });
}

function slugify(heading: string): string {
  return heading
    .trim()
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s/g, "-");
}

function headingAnchors(markdownFile: string): Set<string> {
  const headings = read(markdownFile).match(/^#{1,6} .+$/gm) ?? [];

  return new Set(
    headings.map((heading) => slugify(heading.replace(/^#+ /, ""))),
  );
}

async function extract(ids: string[]): Promise<void> {
  const index = loadIndex();
  const selected = index.templates.filter(
    (entry) => ids.length === 0 || ids.includes(entry.id),
  );

  for (const entry of selected) {
    if (!entry.canonical) {
      console.log(`skipped ${entry.id}: no canonical file`);
      continue;
    }

    const canonical = read(entry.canonical);
    const existingTokens = canonical.match(TOKEN_PATTERN);

    if (existingTokens) {
      throw new Error(
        `${entry.canonical} already contains template tokens: ${existingTokens.join(", ")}`,
      );
    }

    let body = canonical;

    for (const [token, value] of byLongest(
      Object.entries(valuesFor(entry.id)),
      1,
    )) {
      body = body.split(value).join(token);
    }

    const header = [
      `// @template ${entry.id}: ${entry.need}.`,
      `// @template Canonical source: ${entry.canonical}. Rules: ${entry.rules}`,
      "// @template Replace the tokens described in template-fw/index.json. Fields, locators and test data are illustrative.",
      "",
    ].join("\n");

    // Templates stay unformatted: longer token names would make Prettier
    // re-wrap lines, and rendering must reproduce the canonical file exactly.
    write(entry.template, header + body);
    console.log(`extracted ${entry.id} -> ${entry.template}`);
  }
}

function buildCatalogue(index: TemplateIndex): string {
  const tokenRows = Object.entries(index.tokens).map(
    ([token, description]) => `| \`${token}\` | ${description} |`,
  );
  const templateRows = index.templates.map(
    (entry) =>
      `| \`${entry.id}\` | ${entry.need} | [template](${path.relative("template-fw/templates", entry.template)}) | \`${entry.output}\` | [rules](../../${entry.rules}) |`,
  );

  return [
    "# Golden Templates",
    "",
    "Generated from `template-fw/index.json` by `npm run qa:templates:build`. Do not edit by hand.",
    "",
    "Each template is a validated implementation with the application-specific names replaced by tokens.",
    "Copy the template to its output path, replace the tokens, then adapt fields, locators and test data to your application.",
    "In VS Code, type `qa-<id>` to insert a template as a snippet.",
    "",
    "Project-specific examples registered in `config/approved-examples.json` take precedence over these templates.",
    "",
    "## Tokens",
    "",
    "| Token | Meaning |",
    "| --- | --- |",
    ...tokenRows,
    "",
    "## Templates",
    "",
    "| Id | Use when you need | Template | Output | Rules |",
    "| --- | --- | --- | --- | --- |",
    ...templateRows,
    "",
  ].join("\n");
}

function buildSnippets(index: TemplateIndex): string {
  const tabStops = new Map(
    Object.keys(index.tokens).map((token, position) => [
      token,
      `\${${position + 1}:${token.replace(/__/g, "")}}`,
    ]),
  );
  const snippets: Record<string, unknown> = {};

  for (const entry of index.templates) {
    let body = read(entry.template)
      .replace(TEMPLATE_DIRECTIVE, "")
      .replace(/\\/g, "\\\\")
      .replace(/\$/g, "\\$");

    for (const [token, tabStop] of tabStops) {
      body = body.split(token).join(tabStop);
    }

    snippets[`QA ${entry.id}`] = {
      prefix: `qa-${entry.id}`,
      description: entry.need,
      scope: entry.template.endsWith(".js") ? "javascript" : "typescript",
      body: body.trimEnd().split("\n"),
    };
  }

  return `${JSON.stringify(snippets, null, 2)}\n`;
}

async function generatedFiles(index: TemplateIndex) {
  return [
    {
      file: CATALOGUE_PATH,
      content: await format(buildCatalogue(index), CATALOGUE_PATH),
    },
    {
      file: SNIPPETS_PATH,
      content: buildSnippets(index),
    },
  ];
}

async function build(): Promise<void> {
  for (const { file, content } of await generatedFiles(loadIndex())) {
    write(file, content);
    console.log(`generated ${file}`);
  }
}

async function check(): Promise<void> {
  const index = loadIndex();
  const knownTokens = new Set(Object.keys(index.tokens));
  const problems: string[] = [];
  // The round trip runs where the canonical reference implementation lives;
  // setup removes it, together with the values file, from new projects.
  const roundTrip = exists(VALUES_PATH);
  let roundTripped = 0;

  for (const entry of index.templates) {
    const canonicalPath = roundTrip ? entry.canonical : null;
    const required = canonicalPath
      ? [entry.template, canonicalPath]
      : [entry.template];

    for (const file of required) {
      if (!exists(file)) problems.push(`${entry.id}: missing ${file}`);
    }

    const [rulesFile, anchor] = entry.rules.split("#");

    if (!exists(rulesFile) || !headingAnchors(rulesFile).has(anchor)) {
      problems.push(`${entry.id}: rules link ${entry.rules} does not resolve`);
    }

    if (!required.every(exists)) continue;

    const template = read(entry.template);

    for (const token of [
      ...(template.replace(TEMPLATE_DIRECTIVE, "").match(TOKEN_PATTERN) ?? []),
      ...(entry.output.match(TOKEN_PATTERN) ?? []),
    ]) {
      if (!knownTokens.has(token)) {
        problems.push(`${entry.id}: unknown token ${token}`);
      }
    }

    if (!canonicalPath) continue;

    roundTripped += 1;

    const rendered = await format(
      render(template, valuesFor(entry.id)),
      canonicalPath,
    );
    const canonical = await format(read(canonicalPath), canonicalPath);

    if (rendered !== canonical) {
      problems.push(
        `${entry.id}: template does not reproduce ${canonicalPath}. Change both together, or run npm run qa:templates:extract -- ${entry.id} after an intended canonical change.`,
      );
    }
  }

  if (exists(PROJECT_INDEX_PATH)) {
    const { examples }: { examples: ProjectExample[] } = JSON.parse(
      read(PROJECT_INDEX_PATH),
    );

    for (const example of examples) {
      if (!exists(example.file)) {
        problems.push(
          `${PROJECT_INDEX_PATH}: example ${example.id} points to missing ${example.file}`,
        );
      }
    }
  }

  for (const { file, content } of await generatedFiles(index)) {
    if (!exists(file) || read(file) !== content) {
      problems.push(`${file} is out of date. Run npm run qa:templates:build.`);
    }
  }

  if (problems.length > 0) {
    console.error(problems.map((problem) => `✖ ${problem}`).join("\n"));
    process.exit(1);
  }

  console.log(
    roundTrip
      ? `✔ ${index.templates.length} golden templates are consistent; ${roundTripped} reproduce their canonical files`
      : `✔ ${index.templates.length} golden templates are consistent (round trip runs in the reference implementation)`,
  );
}

async function main(): Promise<void> {
  const [command, ...args] = process.argv.slice(2);

  if (command === "extract") return extract(args);
  if (command === "build") return build();
  if (command === "check") return check();

  console.error("Usage: templates.ts <extract [id...] | build | check>");
  process.exit(1);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
