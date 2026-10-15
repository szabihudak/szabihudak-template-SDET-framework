import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

// Architecture rules from AGENTS.md and framework/docs/TESTING_STANDARDS.md that can be
// checked mechanically. ESLint is not used because typescript-eslint does not
// support TypeScript 7.

// Every check cites the written rule it enforces as "<file>#<heading anchor>".
// The linter fails when a cited section does not exist, so no check can exist
// without a documented rule behind it.
type Rule = {
  id: string;
  source: string;
  appliesTo: (file: string) => boolean;
  pattern: RegExp;
  message: string;
};

const ROOT = path.resolve(__dirname, "../..");
const SOURCE_ROOTS = [
  "src",
  "tests",
  "framework/core",
  "framework/setup/starter",
  "framework/setup/selftest/tests",
];
// Aliases from tsconfig.json; projects import the framework and their own
// application layer through them.
const ALIASES: Record<string, string> = {
  "@framework/": "framework/core/",
  "@app/": "src/",
};
const SOURCE_FILE = /\.(ts|js|mjs)$/;

const inDirectory =
  (...directories: string[]) =>
  (file: string) =>
    directories.some((directory) => file.startsWith(`${directory}/`));

const isSpec = (file: string) => /\.spec\.ts$/.test(file);

const rules: Rule[] = [
  {
    id: "no-assertions-outside-specs",
    source: "AGENTS.md#layer-rules",
    // The Lighthouse policy is the one framework helper that asserts by design.
    appliesTo: (file) =>
      inDirectory("src", "framework/core")(file) &&
      !file.startsWith("framework/core/performance/"),
    pattern: /\bexpect\s*[.(]/,
    message:
      "Assertions belong in specs, not in clients, pages, factories or fixtures.",
  },
  {
    id: "no-cast-on-response-json",
    source: "AGENTS.md#hard-rules",
    appliesTo: () => true,
    // A plain `as unknown` asserts nothing; any other cast trusts unvalidated data.
    pattern: /\.json\(\)\s*\)?\s*as\s+(?!unknown\s*(?:[;,)]|$))/,
    message:
      "Do not cast provider responses. Validate with validateSchema() and use the schema type.",
  },
  {
    id: "no-raw-locators-in-specs",
    source: "AGENTS.md#layer-rules",
    appliesTo: isSpec,
    pattern: /\.(locator|getBy[A-Z]\w*)\(/,
    message:
      "Locators belong in Page Objects or Component Objects. Expose a locator query instead.",
  },
  {
    id: "no-sql-in-specs",
    source: "AGENTS.md#layer-rules",
    appliesTo: isSpec,
    pattern:
      /\b(SELECT\s.+\sFROM|INSERT\s+INTO|DELETE\s+FROM|UPDATE\s+\w+\s+SET)\b|from\s+["']pg["']/,
    message:
      "SQL belongs in a domain database client. Use the database fixtures from specs.",
  },
  {
    id: "no-fixed-waits",
    source: "AGENTS.md#playwright-rules",
    appliesTo: () => true,
    pattern: /\bwaitForTimeout\s*\(/,
    message:
      "Fixed waits are flaky. Wait for an observable state with a web-first assertion.",
  },
  {
    id: "axe-only-through-scanner",
    source: "AGENTS.md#hard-rules",
    appliesTo: (file) => !file.startsWith("framework/core/accessibility/"),
    pattern: /\bAxeBuilder\b/,
    message:
      "Use the AccessibilityScanner fixtures so the central WCAG policy applies.",
  },
  {
    id: "factories-without-playwright",
    source: "AGENTS.md#layer-rules",
    appliesTo: inDirectory("src/data"),
    pattern: /from\s+["']@playwright\/test["']/,
    message:
      "Factories build data only. Requests, pages and assertions belong in clients, Page Objects and specs.",
  },
  {
    id: "framework-through-alias",
    source: "AGENTS.md#ownership",
    appliesTo: (file) =>
      inDirectory("src", "tests")(file) && /\.ts$/.test(file),
    pattern: /["'](\.\.\/)+framework\//,
    message:
      "Import the framework through @framework/ so the code does not depend on its location.",
  },
  {
    id: "web-first-assertions",
    source: "AGENTS.md#playwright-rules",
    appliesTo: inDirectory("src", "tests"),
    pattern:
      /expect\(\s*await\s+[^;]*\.(count|isVisible|isHidden|isEnabled|isDisabled|isChecked|isEditable|textContent|innerText|innerHTML|inputValue)\(\)/,
    message:
      "This assertion does not retry. Use a web-first assertion on the locator, such as await expect(locator).toHaveCount(n) or toBeVisible().",
  },
  {
    id: "no-network-idle",
    source: "AGENTS.md#playwright-rules",
    appliesTo: inDirectory("src", "tests"),
    pattern: /["']networkidle["']/,
    message:
      "Waiting for network idle is unreliable. Wait for the element or state the test needs with a web-first assertion.",
  },
  {
    id: "no-wait-for-selector",
    source: "AGENTS.md#playwright-rules",
    appliesTo: inDirectory("src", "tests"),
    pattern: /\.waitForSelector\s*\(/,
    message:
      "Use a locator with a web-first assertion instead of waitForSelector.",
  },
  {
    id: "no-force-actions",
    source: "AGENTS.md#playwright-rules",
    appliesTo: inDirectory("src", "tests"),
    pattern: /\bforce\s*:\s*true\b/,
    message:
      "Forced actions skip the checks a user would hit. Fix the state that blocks the action instead.",
  },
  {
    id: "locate-by-user-attributes",
    source: "AGENTS.md#playwright-rules",
    appliesTo: inDirectory("src", "tests"),
    // locator() is allowed only for a single test id attribute selector, for a
    // match getByTestId cannot express (such as a prefix).
    pattern:
      /\.(?:nth\(|first\(\s*\)|last\(\s*\))|\.locator\(\s*(["'`])(?!\[data-testid(?:[\^$*~|]?=["']?[^"'\]]*["']?)?\]\1)/,
    message:
      "Locate by role, label or test id, scoped to a container and filtered by content; never by position, CSS or XPath.",
  },
  {
    id: "no-test-only",
    source: "AGENTS.md#playwright-rules",
    appliesTo: inDirectory("tests"),
    pattern: /\b(test|describe)(\.describe)?\.only\s*\(/,
    message: "Remove .only; it silently skips every other test.",
  },
  {
    id: "no-test-step",
    source: "AGENTS.md#playwright-rules",
    appliesTo: inDirectory("tests"),
    pattern: /\btest\.step\s*\(/,
    message:
      "Do not use test.step(); the test and its Page Object methods express the steps.",
  },
];

// Playwright matchers that retry and return a promise; without await they
// assert nothing.
const ASYNC_MATCHER =
  /\.(?:not\.)?(?:toBeVisible|toBeHidden|toBeEnabled|toBeDisabled|toBeChecked|toBeEditable|toBeEmpty|toBeFocused|toBeAttached|toBeInViewport|toHaveText|toContainText|toHaveValue|toHaveValues|toHaveCount|toHaveURL|toHaveTitle|toHaveAttribute|toHaveClass|toHaveCSS|toHaveId|toHaveJSProperty|toHaveScreenshot|toHaveAccessibleName|toHaveAccessibleDescription|toHaveAccessibleErrorMessage|toHaveRole|toMatchAriaSnapshot|toBeOK|toPass)\s*\(/;

// Matchers that check what the page shows; toHaveURL and toHaveTitle do not.
const PAGE_ASSERTION =
  /\.(?:not\.)?(?:toBeVisible|toBeHidden|toBeEnabled|toBeDisabled|toBeChecked|toBeEditable|toBeEmpty|toBeFocused|toBeAttached|toBeInViewport|toHaveText|toContainText|toHaveValue|toHaveValues|toHaveCount|toHaveAttribute|toHaveClass|toHaveCSS|toHaveId|toHaveJSProperty|toHaveScreenshot|toHaveAccessibleName|toHaveAccessibleDescription|toHaveAccessibleErrorMessage|toHaveRole|toMatchAriaSnapshot)\s*\(/;

const UI_PAGE_ASSERTION_CHECK = {
  id: "ui-tests-assert-the-page",
  source: "framework/docs/TESTING_STANDARDS.md#ui-spec-standard",
  message:
    "This UI test never asserts what the page shows. Add an assertion on a visible element or text; a URL or response check alone is not enough.",
};

const API_BUSINESS_ASSERTION_CHECK = {
  id: "api-tests-assert-business-fields",
  source: "framework/docs/TESTING_STANDARDS.md#api-test-standard",
  message:
    "This test validates the schema but asserts no field of the body. Assert the business values of the response fields.",
};

// Bodies of the test(...) callbacks in a spec, with their line numbers.
function testBodies(source: string): { line: number; body: string }[] {
  return [...source.matchAll(/(?<![.\w])test\s*\(/g)].flatMap((match) => {
    const body = callbackBody(source, match.index);

    return body
      ? [{ line: source.slice(0, match.index).split("\n").length, body }]
      : [];
  });
}

function uiTestsWithoutPageAssertion(source: string): number[] {
  return testBodies(source)
    .filter(({ body }) => !PAGE_ASSERTION.test(body))
    .map(({ line }) => line);
}

// A test that validates a body against a schema must also assert at least one
// of its fields. Whether every field is asserted is left to review.
function schemaOnlyApiTests(source: string): number[] {
  return testBodies(source)
    .filter(({ body }) =>
      [...body.matchAll(/validateSchema\(\s*\w+\s*,\s*(\w+)\s*\)/g)].some(
        ([, variable]) => !new RegExp(`expect\\(\\s*${variable}\\b`).test(body),
      ),
    )
    .map(({ line }) => line);
}

// Index just past the bracket that closes the one at `open`, skipping quoted
// strings.
function closingIndex(source: string, open: number): number {
  const pairs: Record<string, string> = { "(": ")", "{": "}", "[": "]" };
  const stack: string[] = [];
  let quote: string | undefined;

  for (let index = open; index < source.length; index += 1) {
    const char = source[index];

    if (quote) {
      if (char === "\\") index += 1;
      else if (char === quote) quote = undefined;
    } else if (char === '"' || char === "'" || char === "`") {
      quote = char;
    } else if (pairs[char]) {
      stack.push(pairs[char]);
    } else if (char === stack[stack.length - 1]) {
      stack.pop();
      if (stack.length === 0) return index + 1;
    }
  }

  return source.length;
}

const STRICT_SCHEMA_CHECK = {
  id: "schemas-reject-unknown-fields",
  source: "framework/docs/TESTING_STANDARDS.md#schema-standard",
  message:
    "This Type.Object does not declare additionalProperties: false, so unexpected fields would pass validation. Add { additionalProperties: false } as its options.",
};

// Type.Object(properties, options) calls whose own options do not set
// additionalProperties: false. Nested objects are checked on their own.
function looseSchemaObjects(source: string): number[] {
  const lines: number[] = [];

  for (const match of source.matchAll(/Type\.Object\s*\(/g)) {
    const callOpen = match.index + match[0].length - 1;
    const propertiesOpen = source.indexOf("{", callOpen);
    const propertiesEnd = closingIndex(source, propertiesOpen);
    const callEnd = closingIndex(source, callOpen);
    const rest = source.slice(propertiesEnd, callEnd);
    const optionsOpen = rest.indexOf("{");
    const options =
      optionsOpen === -1
        ? ""
        : rest.slice(optionsOpen, closingIndex(rest, optionsOpen));

    if (!/additionalProperties\s*:\s*false/.test(options)) {
      lines.push(source.slice(0, match.index).split("\n").length);
    }
  }

  return lines;
}

const FIELD_COVERAGE_CHECK = {
  id: "api-field-coverage",
  source: "framework/docs/TESTING_STANDARDS.md#api-test-standard",
};

type SchemaLike = {
  format?: string;
  properties?: Record<string, SchemaLike>;
};

// Leaf fields of a schema by path ("user.id"); nested objects are walked.
function schemaFields(
  schema: SchemaLike,
  prefix = "",
): { path: string; format?: string }[] {
  return Object.entries(schema.properties ?? {}).flatMap(
    ([name, definition]) =>
      definition.properties
        ? schemaFields(definition, `${prefix}${name}.`)
        : [{ path: `${prefix}${name}`, format: definition.format }],
  );
}

// "user.id" → ["", "user"]: the body itself and each enclosing object.
function ancestors(field: string): string[] {
  const parts = field.split(".");

  return parts.map((_, index) => parts.slice(0, index).join("."));
}

// Names imported by a spec, mapped to the repository file they come from.
function importedNames(file: string, source: string): Map<string, string> {
  const names = new Map<string, string>();

  for (const [, list, specifier] of source.matchAll(
    /import\s*(?:type\s*)?\{([^}]*)\}\s*from\s*["']([^"']+)["']/g,
  )) {
    for (const entry of list.split(",")) {
      const name = entry
        .replace(/^\s*type\s+/, "")
        .split(/\s+as\s+/)
        .pop()
        ?.trim();

      if (name) names.set(name, importTarget(file, specifier));
    }
  }

  return names;
}

function loadSchema(target: string, name: string): SchemaLike | undefined {
  const file = path.join(ROOT, `${target}.ts`);
  if (!fs.existsSync(file)) return undefined;

  // tsx runs this tool, so the schema module and its aliases load as is.
  const schema = require(file)[name] as SchemaLike | undefined;

  return schema?.properties ? schema : undefined;
}

// Every field of a schema a spec validates against, including the fields of
// nested objects, is asserted in some test of the file (directly, or through
// an enclosing object compared with toEqual or toStrictEqual), declares a
// format in the schema, or is listed in an "// unasserted: user.id (reason)"
// comment.
function uncoveredFields(file: string, source: string): string[] {
  const problems: string[] = [];
  const imports = importedNames(file, source);
  const exempt = new Set<string>();

  for (const [, fields, reason] of source.matchAll(
    /\/\/\s*unasserted:\s*([^(\n]+?)\s*(?:\(([^)\n]*)\))?\s*$/gm,
  )) {
    if (!reason?.trim()) {
      problems.push(
        `the "unasserted: ${fields}" comment needs a reason in parentheses`,
      );
    }
    for (const field of fields.split(",")) exempt.add(field.trim());
  }

  const variablesBySchema = new Map<string, Set<string>>();

  for (const { body } of testBodies(source)) {
    for (const [, schemaName, variable] of body.matchAll(
      /validateSchema\(\s*(\w+)\s*,\s*(\w+)\s*\)/g,
    )) {
      const variables = variablesBySchema.get(schemaName) ?? new Set<string>();
      variables.add(variable);
      variablesBySchema.set(schemaName, variables);
    }
  }

  for (const [schemaName, variables] of variablesBySchema) {
    const target = imports.get(schemaName);
    const schema = target ? loadSchema(target, schemaName) : undefined;
    if (!schema?.properties) continue;

    const names = [...variables].join("|");

    const member = (field: string) =>
      field ? `\\.${field.replace(/\./g, "\\.")}` : "";

    for (const { path: field, format } of schemaFields(schema)) {
      const asserted =
        new RegExp(`expect\\(\\s*(?:${names})${member(field)}\\b`).test(
          source,
        ) ||
        ancestors(field).some((ancestor) =>
          new RegExp(
            `expect\\(\\s*(?:${names})${member(ancestor)}\\s*\\)\\s*\\.(?:toEqual|toStrictEqual)\\(`,
          ).test(source),
        );
      const listed = [field, ...ancestors(field)].some((path) =>
        exempt.has(path),
      );

      if (!asserted && !format && !listed) {
        problems.push(
          `${schemaName} field "${field}" is not asserted, has no format in the schema and is not listed in an "// unasserted: ${field} (reason)" comment`,
        );
      }
    }
  }

  return problems;
}

const SKIP_CHECK = {
  id: "no-skipped-tests",
  source: "AGENTS.md#hard-rules",
  message:
    'Do not skip a test. Skip only for a stated runtime condition, test.skip(condition, "reason"), or quarantine it with "// quarantine: <reason>; owner: <name>; exit: <issue or condition>" on the line above.',
};
const QUARANTINE =
  /\/\/\s*quarantine:\s*[^;\n]*\S[^;\n]*;\s*owner:\s*[^;\n]*\S[^;\n]*;\s*exit:\s*\S/;

// Line above `index`, ignoring blank lines.
function previousLine(source: string, index: number): string {
  const before = source.slice(0, index).split("\n");
  before.pop();

  return [...before].reverse().find((line) => line.trim()) ?? "";
}

// test.skip / fixme / fail (and their describe forms) that are not a runtime
// condition with a reason and not a documented quarantine.
function unapprovedSkips(source: string): number[] {
  const lines: number[] = [];

  for (const match of source.matchAll(
    /(?<![.\w])test(?:\.describe)?\.(?:skip|fixme|fail)\s*\(/g,
  )) {
    const open = match.index + match[0].length - 1;
    const args = source.slice(open + 1, closingIndex(source, open) - 1).trim();
    const conditionWithReason =
      args !== "" &&
      !/^["'`]/.test(args) &&
      /,\s*["'`][^"'`]*\S[^"'`]*["'`]\s*,?$/.test(args);

    if (
      !conditionWithReason &&
      !QUARANTINE.test(previousLine(source, match.index))
    ) {
      lines.push(source.slice(0, match.index).split("\n").length);
    }
  }

  return lines;
}

const VISUAL_OPTIONS_CHECK = {
  id: "shared-visual-options",
  source: "framework/docs/TESTING_STANDARDS.md#visual-regression-test-standard",
  message:
    'Pass VISUAL_COMPARISON_OPTIONS to toHaveScreenshot(). A tolerance or mask needs "// visual-exception: <element> (<why it cannot be made deterministic>)" on the line above.',
};
const VISUAL_EXCEPTION = /\/\/\s*visual-exception:\s*\S.*\(\s*\S[^)]*\)/;

// toHaveScreenshot() calls without the shared options, or with their own
// tolerances or masks and no documented exception.
function visualOptionDeviations(source: string): number[] {
  const lines: number[] = [];

  for (const match of source.matchAll(/\.toHaveScreenshot\s*\(/g)) {
    const open = match.index + match[0].length - 1;
    const args = source.slice(open, closingIndex(source, open));
    const own =
      /\b(?:maxDiffPixels|maxDiffPixelRatio|threshold|mask|maskColor)\b/;

    if (
      !/\bVISUAL_COMPARISON_OPTIONS\b/.test(args) ||
      (own.test(args) &&
        !VISUAL_EXCEPTION.test(previousLine(source, match.index)))
    ) {
      lines.push(source.slice(0, match.index).split("\n").length);
    }
  }

  return lines;
}

const SQL_INTERPOLATION_CHECK = {
  id: "parameterized-sql",
  source: "AGENTS.md#layer-rules",
  message:
    "Do not build SQL from values. Pass them as query parameters ($1, $2) instead.",
};
const SQL_STATEMENT =
  /\b(?:SELECT|INSERT\s+INTO|UPDATE|DELETE\s+FROM|DROP|CREATE|ALTER|TRUNCATE)\b/;

// SQL in a template literal with a ${} placeholder, or a string joined with +.
function interpolatedSql(source: string): number[] {
  const literals = [
    ...[...source.matchAll(/`[^`]*`/g)].filter(([literal]) =>
      /\$\{/.test(literal),
    ),
    ...source.matchAll(/(["'])[^"'\n]*\1\s*\+|\+\s*(["'])[^"'\n]*\2/g),
  ];

  return literals
    .filter(([literal]) => SQL_STATEMENT.test(literal))
    .map((match) => source.slice(0, match.index).split("\n").length);
}

const DESCRIBE_CHECK = {
  id: "tests-inside-describe",
  source: "AGENTS.md#playwright-rules",
  message:
    "Group the tests of a spec in test.describe(), even when there is only one.",
};

// Tests that are not nested in the callback of a test.describe(...).
function testsOutsideDescribe(source: string): number[] {
  const describeBodies = [
    ...source.matchAll(/(?<![.\w])test\.describe(?:\.\w+)?\s*\(/g),
  ].flatMap((match) => {
    const body = callbackBody(source, match.index);
    const start = body ? source.indexOf(body, match.index) : -1;

    return start === -1 ? [] : [[start, start + body!.length]];
  });

  return [...source.matchAll(/(?<![.\w])test\s*\(/g)]
    .filter(
      (match) =>
        !describeBodies.some(
          ([start, end]) => match.index > start && match.index < end,
        ),
    )
    .map((match) => source.slice(0, match.index).split("\n").length);
}

const CASE_ID_TITLE_CHECK = {
  id: "planned-case-id-in-test-title",
  source: "AGENTS.md#playwright-rules",
  message:
    "Every planned API/UI test title must start with its exact plan case ID and a concise behavior description.",
};

type PlannedCase = { id: string; level: "API" | "UI" };
type PlannedFeature = {
  planPath: string;
  cases: PlannedCase[];
  files: string[];
};
type TestTitle = { line: number; title: string };

function markdownTableRows(lines: string[]): string[][] {
  return lines
    .filter((line) => /^\s*\|/.test(line))
    .filter((line) => !/^\s*\|\s*:?-{3,}/.test(line))
    .map((line) =>
      line
        .trim()
        .replace(/^\||\|$/g, "")
        .split("|")
        .map((cell) => cell.trim().replace(/^`|`$/g, "")),
    );
}

function planSection(lines: string[], title: string): string[] {
  const start = lines.findIndex((line) => line.trim() === `## ${title}`);
  if (start === -1) return [];
  const rest = lines.slice(start + 1);
  const end = rest.findIndex((line) => /^##\s/.test(line.trim()));
  return rest.slice(0, end === -1 ? undefined : end);
}

function plannedFeatures(): PlannedFeature[] {
  const result: PlannedFeature[] = [];
  const root = path.join(ROOT, "test-plans");
  if (!fs.existsSync(root)) return result;

  const visit = (directory: string) => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const absolute = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        visit(absolute);
        continue;
      }
      if (!entry.name.endsWith(".md")) continue;

      const lines = fs.readFileSync(absolute, "utf8").split("\n");
      const caseRows = markdownTableRows(planSection(lines, "Cases"));
      const fileRows = markdownTableRows(planSection(lines, "Files"));
      if (caseRows.length < 2 || fileRows.length < 2) continue;

      const caseHeader = caseRows[0].map((cell) => cell.toLowerCase());
      const idIndex = caseHeader.indexOf("id");
      const levelIndex = caseHeader.indexOf("level");
      const fileHeader = fileRows[0].map((cell) => cell.toLowerCase());
      const fileIndex = fileHeader.indexOf("path");
      if (idIndex === -1 || levelIndex === -1 || fileIndex === -1) continue;

      const cases = caseRows.slice(1).flatMap((row) => {
        const id = row[idIndex];
        const level = row[levelIndex];
        return id && (level === "API" || level === "UI")
          ? [{ id, level: level as "API" | "UI" }]
          : [];
      });
      const files = fileRows
        .slice(1)
        .map((row) => row[fileIndex])
        .filter((file) => /^tests\/(api|ui)\/.*\.spec\.ts$/.test(file));
      if (cases.length && files.length) {
        result.push({
          planPath: path.relative(ROOT, absolute).split(path.sep).join("/"),
          cases,
          files,
        });
      }
    }
  };

  visit(root);
  return result;
}

function testTitles(source: string): TestTitle[] {
  const titles: TestTitle[] = [];
  const pattern = /(?<![.\w])test\s*\(\s*(?:"([^"]*)"|'([^']*)'|`([^`]*)`)/g;
  for (const match of source.matchAll(pattern)) {
    titles.push({
      line: source.slice(0, match.index).split("\n").length,
      title: match[1] ?? match[2] ?? match[3],
    });
  }
  return titles;
}

function plannedCaseTitleProblems(
  file: string,
  source: string,
  features: PlannedFeature[],
  usedIds: Map<string, string[]>,
): string[] {
  const problems: string[] = [];
  const level = file.startsWith("tests/api/") ? "API" : "UI";
  const relevant = features.filter((feature) => feature.files.includes(file));
  if (relevant.length === 0) return problems;

  const describeTitle =
    /test\.describe\s*\(\s*(?:"([^"]*)"|'([^']*)'|`([^`]*)`)/.exec(source);
  const suiteTitle =
    describeTitle?.[1] ?? describeTitle?.[2] ?? describeTitle?.[3];
  if (!suiteTitle?.trim() || suiteTitle.includes("__")) {
    problems.push(`${file} must use a descriptive test.describe suite title`);
  }

  const expectedCases = relevant.flatMap((feature) =>
    feature.cases.filter((item) => item.level === level),
  );
  const expectedById = new Map(expectedCases.map((item) => [item.id, item]));
  const dynamicTitle = /^\$\{[^}]*\.caseId\}:\s+\$\{[^}]*\.name\}$/;
  let hasDynamicCaseTitle = false;
  const sourceCaseIdMatches = [
    ...source.matchAll(
      /\bcaseId\s*:\s*["'](T[0-9]{3,}_[A-Z][A-Za-z0-9]*_(?:API|E2E))["']/g,
    ),
  ].map((match) => match[1]);
  if (new Set(sourceCaseIdMatches).size !== sourceCaseIdMatches.length) {
    problems.push(
      `${file} [${CASE_ID_TITLE_CHECK.id}] table-driven scenario caseId values must be unique. ${citation(CASE_ID_TITLE_CHECK.source) ?? CASE_ID_TITLE_CHECK.source}`,
    );
  }
  const sourceCaseIds = new Set(sourceCaseIdMatches);
  const seenInFile = new Set<string>();

  for (const { line, title } of testTitles(source)) {
    const match = /^(T[0-9]{3,}_[A-Z][A-Za-z0-9]*_(API|E2E)):\s+(.+)$/.exec(
      title,
    );
    if (!match) {
      if (dynamicTitle.test(title)) {
        hasDynamicCaseTitle = true;
      } else {
        problems.push(
          `${file}:${line} [${CASE_ID_TITLE_CHECK.id}] test title must start with its planned case ID and ': '. ${citation(CASE_ID_TITLE_CHECK.source) ?? CASE_ID_TITLE_CHECK.source}`,
        );
      }
      continue;
    }
    const [, id, suffix, behavior] = match;
    if (!expectedById.has(id)) {
      problems.push(
        `${file}:${line} [${CASE_ID_TITLE_CHECK.id}] unknown or wrong-plan case ID ${id}. ${citation(CASE_ID_TITLE_CHECK.source) ?? CASE_ID_TITLE_CHECK.source}`,
      );
    }
    if (
      (level === "API" && suffix !== "API") ||
      (level === "UI" && suffix !== "E2E")
    ) {
      problems.push(
        `${file}:${line} [${CASE_ID_TITLE_CHECK.id}] ${id} suffix does not match ${level}. ${citation(CASE_ID_TITLE_CHECK.source) ?? CASE_ID_TITLE_CHECK.source}`,
      );
    }
    if (!behavior.trim()) {
      problems.push(
        `${file}:${line} [${CASE_ID_TITLE_CHECK.id}] ${id} needs a concise behavior description. ${citation(CASE_ID_TITLE_CHECK.source) ?? CASE_ID_TITLE_CHECK.source}`,
      );
    }
    if (seenInFile.has(id)) {
      problems.push(
        `${file}:${line} [${CASE_ID_TITLE_CHECK.id}] duplicate test title ID ${id}. ${citation(CASE_ID_TITLE_CHECK.source) ?? CASE_ID_TITLE_CHECK.source}`,
      );
    }
    seenInFile.add(id);
  }

  if (hasDynamicCaseTitle) {
    for (const id of sourceCaseIds) {
      if (!expectedById.has(id)) {
        problems.push(
          `${file} [${CASE_ID_TITLE_CHECK.id}] table case ID ${id} is not in the plan for this level. ${citation(CASE_ID_TITLE_CHECK.source) ?? CASE_ID_TITLE_CHECK.source}`,
        );
      }
      seenInFile.add(id);
    }
  }

  for (const feature of relevant) {
    for (const id of seenInFile) {
      if (!feature.cases.some((item) => item.id === id)) continue;
      const key = `${feature.planPath}#${id}`;
      const locations = usedIds.get(key) ?? [];
      locations.push(file);
      usedIds.set(key, locations);
    }
  }
  return problems;
}

const MISSING_AWAIT_CHECK = {
  id: "await-playwright-assertions",
  source: "AGENTS.md#playwright-rules",
  message:
    "This Playwright assertion is not awaited, so it checks nothing. Add await.",
};

// Statements that start with expect( (no await or return before it) and use
// an async matcher before the statement ends.
function missingAwaitAssertions(source: string): number[] {
  const lines: number[] = [];

  for (const match of source.matchAll(/^[ \t]*expect(?:\.soft)?\s*\(/gm)) {
    const end = source.indexOf(";", match.index);
    const statement = source.slice(match.index, end === -1 ? undefined : end);

    if (ASYNC_MATCHER.test(statement)) {
      lines.push(source.slice(0, match.index).split("\n").length);
    }
  }

  return lines;
}

const IMPORT_SPECIFIER =
  /(?:from\s+|import\s*\(\s*|require\s*\(\s*)["']((?:\.|@framework\/|@app\/)[^"']+)["']/g;

function importTarget(file: string, specifier: string): string {
  for (const [alias, directory] of Object.entries(ALIASES)) {
    if (specifier.startsWith(alias)) {
      return directory + specifier.slice(alias.length);
    }
  }

  return path.posix.normalize(
    path.posix.join(path.posix.dirname(file), specifier),
  );
}

// Dependencies flow toward the framework core (ADR-007).
const forbiddenImports: {
  id: string;
  source: string;
  from: string;
  to: string[];
  message: string;
}[] = [
  {
    id: "core-independent-of-app",
    source: "AGENTS.md#ownership",
    from: "framework/core/",
    to: ["src/", "tests/"],
    message: "The framework core must not depend on application code or specs.",
  },
  {
    id: "app-independent-of-specs",
    source: "AGENTS.md#ownership",
    from: "src/",
    to: ["tests/"],
    message: "Application code must not depend on specs.",
  },
  {
    id: "factory-boundaries",
    source: "AGENTS.md#layer-rules",
    from: "src/data/",
    to: [
      "src/api/clients/",
      "src/pages/",
      "src/components/",
      "src/fixtures/",
      "src/mocks/",
      "src/database/",
    ],
    message:
      "Factories must not call APIs, drive the UI or manage lifecycle; fixtures combine them.",
  },
  ...["src/pages/", "src/components/"].map((from) => ({
    id: "page-object-boundaries",
    source: "AGENTS.md#layer-rules",
    from,
    to: ["src/api/clients/", "src/database/", "src/fixtures/"],
    message:
      "Page and Component Objects own locators and user actions only; set up data in fixtures.",
  })),
];

const CLIENT_ERROR_ASSERTION =
  /\.toBe\(\s*(?:HTTP_STATUS\.(?:BAD_REQUEST|UNAUTHORIZED|FORBIDDEN|NOT_FOUND|METHOD_NOT_ALLOWED|CONFLICT)|4\d\d)\s*\)/;

// The body of a test callback: from the first "{" after "=>" to its matching
// "}". Braces inside quoted strings are skipped; template literals are counted
// as code because their ${} placeholders are balanced.
function callbackBody(source: string, start: number): string | undefined {
  const arrow = source.indexOf("=>", start);
  const open = arrow === -1 ? -1 : source.indexOf("{", arrow);
  if (open === -1) return undefined;

  let depth = 0;
  let quote: string | undefined;

  for (let index = open; index < source.length; index += 1) {
    const char = source[index];

    if (quote) {
      if (char === "\\") index += 1;
      else if (char === quote) quote = undefined;
    } else if (char === '"' || char === "'") {
      quote = char;
    } else if (char === "{") {
      depth += 1;
    } else if (char === "}" && --depth === 0) {
      return source.slice(open, index + 1);
    }
  }

  return undefined;
}

// A test that expects a 4xx status must not validate the body against a
// success schema (AGENTS.md). Scenario tests with a variable status are not
// detected; this check only reports what it can prove.
function negativeResponsesValidated(source: string): number[] {
  const lines: number[] = [];

  for (const match of source.matchAll(/(?<![.\w])test\s*\(/g)) {
    const body = callbackBody(source, match.index);

    if (
      body &&
      CLIENT_ERROR_ASSERTION.test(body) &&
      /\bvalidateSchema\s*\(/.test(body)
    ) {
      lines.push(source.slice(0, match.index).split("\n").length);
    }
  }

  return lines;
}

const NEGATIVE_RESPONSE_CHECK = {
  id: "no-success-schema-on-negative-response",
  source: "AGENTS.md#hard-rules",
  message:
    "A test that expects a 4xx status must not validate the body against a success schema. Assert the error fields instead; validated setup data comes from a client setup helper.",
};

// Baselines are approved by a human, never regenerated by automation.
const SNAPSHOT_UPDATE_CHECK = {
  id: "no-snapshot-update-in-automation",
  source: "AGENTS.md#hard-rules",
  message:
    "Visual baselines are approved by a human, never updated by a script or CI.",
};
const SNAPSHOT_UPDATE = /--update-snapshots\b|playwright test\b.*\s-u(?:\s|$)/;
const AUTOMATION_FILES = [
  /^\.github\/workflows\/[^/]+\.ya?ml$/,
  /^framework\/setup\/starter\/\.github\/workflows\/[^/]+\.ya?ml$/,
  /^package\.json$/,
  /^install\.sh$/,
];

function repositoryFiles(): string[] {
  return execSync("git ls-files --cached --others --exclude-standard", {
    cwd: ROOT,
  })
    .toString()
    .split("\n")
    .filter((file) => file && fs.existsSync(path.join(ROOT, file)));
}

function sourceFiles(files: string[]): string[] {
  return files.filter(
    (file) =>
      SOURCE_FILE.test(file) &&
      SOURCE_ROOTS.some((root) => file.startsWith(`${root}/`)),
  );
}

function isComment(line: string): boolean {
  return /^\s*(\/\/|\*|\/\*)/.test(line);
}

// Heading anchors as Markdown renders them, mapped to their titles.
function headings(markdownFile: string): Map<string, string> {
  const file = path.join(ROOT, markdownFile);
  if (!fs.existsSync(file)) return new Map();

  return new Map(
    [...fs.readFileSync(file, "utf8").matchAll(/^#{1,6} (.+)$/gm)].map(
      ([, title]) => [
        title
          .trim()
          .toLowerCase()
          .replace(/[^\w\s-]/g, "")
          .replace(/\s/g, "-"),
        title.trim(),
      ],
    ),
  );
}

// "(AGENTS.md → Layer Rules)", or undefined when the cited section is missing.
function citation(source: string): string | undefined {
  const [file, anchor] = source.split("#");
  const title = headings(file).get(anchor);

  return title ? `(${file} → ${title})` : undefined;
}

function main(): void {
  const problems: string[] = [];
  const repository = repositoryFiles();
  const files = sourceFiles(repository);
  const checks = [
    ...rules,
    ...forbiddenImports,
    NEGATIVE_RESPONSE_CHECK,
    MISSING_AWAIT_CHECK,
    DESCRIBE_CHECK,
    STRICT_SCHEMA_CHECK,
    SQL_INTERPOLATION_CHECK,
    SKIP_CHECK,
    VISUAL_OPTIONS_CHECK,
    FIELD_COVERAGE_CHECK,
    UI_PAGE_ASSERTION_CHECK,
    API_BUSINESS_ASSERTION_CHECK,
    CASE_ID_TITLE_CHECK,
    SNAPSHOT_UPDATE_CHECK,
  ];
  const cite = (source: string) => citation(source) ?? `(${source})`;
  const planFeatures = plannedFeatures();
  const plannedCaseTitleFiles = new Map<string, string[]>();

  for (const check of checks) {
    if (!citation(check.source)) {
      problems.push(
        `framework/tools/architecture.ts [${check.id}] cites ${check.source}, which does not exist. Every check must enforce a documented rule.`,
      );
    }
  }

  for (const file of files) {
    const lines = fs.readFileSync(path.join(ROOT, file), "utf8").split("\n");
    // Starter and self-test files are checked as if they were already in their
    // target place.
    const logicalFile = file.replace(
      /^framework\/setup\/(starter|selftest)\//,
      "",
    );

    lines.forEach((line, index) => {
      if (isComment(line)) return;

      for (const rule of rules) {
        if (
          (rule.appliesTo(file) || rule.appliesTo(logicalFile)) &&
          rule.pattern.test(line)
        ) {
          problems.push(
            `${file}:${index + 1} [${rule.id}] ${rule.message} ${cite(rule.source)}`,
          );
        }
      }
    });

    const source = lines.join("\n");

    for (const boundary of forbiddenImports) {
      if (!logicalFile.startsWith(boundary.from)) continue;

      for (const [, specifier] of source.matchAll(IMPORT_SPECIFIER)) {
        const target = importTarget(logicalFile, specifier);

        if (boundary.to.some((forbidden) => target.startsWith(forbidden))) {
          problems.push(
            `${file} [${boundary.id}] imports ${specifier}. ${boundary.message} ${cite(boundary.source)}`,
          );
        }
      }
    }

    if (logicalFile.startsWith("src/api/schemas/")) {
      for (const line of looseSchemaObjects(source)) {
        problems.push(
          `${file}:${line} [${STRICT_SCHEMA_CHECK.id}] ${STRICT_SCHEMA_CHECK.message} ${cite(STRICT_SCHEMA_CHECK.source)}`,
        );
      }
    }

    if (logicalFile.startsWith("src/database/")) {
      for (const line of interpolatedSql(source)) {
        problems.push(
          `${file}:${line} [${SQL_INTERPOLATION_CHECK.id}] ${SQL_INTERPOLATION_CHECK.message} ${cite(SQL_INTERPOLATION_CHECK.source)}`,
        );
      }
    }

    if (isSpec(logicalFile)) {
      for (const problem of plannedCaseTitleProblems(
        logicalFile,
        source,
        planFeatures,
        plannedCaseTitleFiles,
      )) {
        problems.push(problem);
      }

      for (const line of unapprovedSkips(source)) {
        problems.push(
          `${file}:${line} [${SKIP_CHECK.id}] ${SKIP_CHECK.message} ${cite(SKIP_CHECK.source)}`,
        );
      }

      for (const line of visualOptionDeviations(source)) {
        problems.push(
          `${file}:${line} [${VISUAL_OPTIONS_CHECK.id}] ${VISUAL_OPTIONS_CHECK.message} ${cite(VISUAL_OPTIONS_CHECK.source)}`,
        );
      }

      if (logicalFile.startsWith("tests/api/")) {
        for (const problem of uncoveredFields(logicalFile, source)) {
          problems.push(
            `${file} [${FIELD_COVERAGE_CHECK.id}] ${problem}. ${cite(FIELD_COVERAGE_CHECK.source)}`,
          );
        }
      }

      for (const line of negativeResponsesValidated(source)) {
        problems.push(
          `${file}:${line} [${NEGATIVE_RESPONSE_CHECK.id}] ${NEGATIVE_RESPONSE_CHECK.message} ${cite(NEGATIVE_RESPONSE_CHECK.source)}`,
        );
      }

      // Specs tagged @selftest belong to the setup self-test: they run against
      // any application, also inside generated test projects, so they cannot
      // know its elements. Real project specs never carry the tag.
      if (
        /^tests\/(ui|smoke)\//.test(logicalFile) &&
        !/tag:\s*["']@selftest["']/.test(source)
      ) {
        for (const line of uiTestsWithoutPageAssertion(source)) {
          problems.push(
            `${file}:${line} [${UI_PAGE_ASSERTION_CHECK.id}] ${UI_PAGE_ASSERTION_CHECK.message} ${cite(UI_PAGE_ASSERTION_CHECK.source)}`,
          );
        }
      }

      if (logicalFile.startsWith("tests/api/")) {
        for (const line of schemaOnlyApiTests(source)) {
          problems.push(
            `${file}:${line} [${API_BUSINESS_ASSERTION_CHECK.id}] ${API_BUSINESS_ASSERTION_CHECK.message} ${cite(API_BUSINESS_ASSERTION_CHECK.source)}`,
          );
        }
      }

      for (const line of testsOutsideDescribe(source)) {
        problems.push(
          `${file}:${line} [${DESCRIBE_CHECK.id}] ${DESCRIBE_CHECK.message} ${cite(DESCRIBE_CHECK.source)}`,
        );
      }

      for (const line of missingAwaitAssertions(source)) {
        problems.push(
          `${file}:${line} [${MISSING_AWAIT_CHECK.id}] ${MISSING_AWAIT_CHECK.message} ${cite(MISSING_AWAIT_CHECK.source)}`,
        );
      }
    }
  }

  for (const feature of planFeatures) {
    for (const plannedCase of feature.cases) {
      if (plannedCase.level !== "API" && plannedCase.level !== "UI") continue;
      const key = `${feature.planPath}#${plannedCase.id}`;
      const occurrences = plannedCaseTitleFiles.get(key) ?? [];
      if (occurrences.length === 0) {
        problems.push(
          `${feature.planPath} [${CASE_ID_TITLE_CHECK.id}] planned case ${plannedCase.id} has no matching Playwright title in its listed spec files. ${cite(CASE_ID_TITLE_CHECK.source)}`,
        );
      } else if (occurrences.length > 1) {
        problems.push(
          `${feature.planPath} [${CASE_ID_TITLE_CHECK.id}] planned case ${plannedCase.id} appears in multiple specs: ${occurrences.join(", ")}. ${cite(CASE_ID_TITLE_CHECK.source)}`,
        );
      }
    }
  }

  for (const file of repository.filter((candidate) =>
    AUTOMATION_FILES.some((pattern) => pattern.test(candidate)),
  )) {
    fs.readFileSync(path.join(ROOT, file), "utf8")
      .split("\n")
      .forEach((line, index) => {
        if (!/^\s*#/.test(line) && SNAPSHOT_UPDATE.test(line)) {
          problems.push(
            `${file}:${index + 1} [${SNAPSHOT_UPDATE_CHECK.id}] ${SNAPSHOT_UPDATE_CHECK.message} ${cite(SNAPSHOT_UPDATE_CHECK.source)}`,
          );
        }
      });
  }

  if (problems.length > 0) {
    console.error(problems.map((problem) => `✖ ${problem}`).join("\n"));
    console.error(`\n${problems.length} architecture rule violation(s).`);
    process.exit(1);
  }

  console.log(`✔ ${files.length} files follow the architecture rules`);
}

main();
