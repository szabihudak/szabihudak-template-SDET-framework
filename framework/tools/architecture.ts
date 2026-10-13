import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

// Architecture rules from AGENTS.md and framework/docs/TESTING_STANDARDS.md that can be
// checked mechanically. ESLint is not used because typescript-eslint does not
// support TypeScript 7.

type Rule = {
  id: string;
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
    appliesTo: () => true,
    // A plain `as unknown` asserts nothing; any other cast trusts unvalidated data.
    pattern: /\.json\(\)\s*\)?\s*as\s+(?!unknown\s*(?:[;,)]|$))/,
    message:
      "Do not cast provider responses. Validate with validateSchema() and use the schema type.",
  },
  {
    id: "no-raw-locators-in-specs",
    appliesTo: isSpec,
    pattern: /\.(locator|getBy[A-Z]\w*)\(/,
    message:
      "Locators belong in Page Objects or Component Objects. Expose a locator query instead.",
  },
  {
    id: "no-sql-in-specs",
    appliesTo: isSpec,
    pattern:
      /\b(SELECT\s.+\sFROM|INSERT\s+INTO|DELETE\s+FROM|UPDATE\s+\w+\s+SET)\b|from\s+["']pg["']/,
    message:
      "SQL belongs in a domain database client. Use the database fixtures from specs.",
  },
  {
    id: "no-fixed-waits",
    appliesTo: () => true,
    pattern: /\bwaitForTimeout\s*\(/,
    message:
      "Fixed waits are flaky. Wait for an observable state with a web-first assertion.",
  },
  {
    id: "axe-only-through-scanner",
    appliesTo: (file) => !file.startsWith("framework/core/accessibility/"),
    pattern: /\bAxeBuilder\b/,
    message:
      "Use the AccessibilityScanner fixtures so the central WCAG policy applies.",
  },
  {
    id: "factories-without-playwright",
    appliesTo: inDirectory("src/data"),
    pattern: /from\s+["']@playwright\/test["']/,
    message:
      "Factories build data only. Requests, pages and assertions belong in clients, Page Objects and specs.",
  },
  {
    id: "framework-through-alias",
    appliesTo: (file) =>
      inDirectory("src", "tests")(file) && /\.ts$/.test(file),
    pattern: /["'](\.\.\/)+framework\//,
    message:
      "Import the framework through @framework/ so the code does not depend on its location.",
  },
];

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
const forbiddenImports: { from: string; to: string[]; message: string }[] = [
  {
    from: "framework/core/",
    to: ["src/", "tests/"],
    message: "The framework core must not depend on application code or specs.",
  },
  {
    from: "src/",
    to: ["tests/"],
    message: "Application code must not depend on specs.",
  },
  {
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

// Baselines are approved by a human, never regenerated by automation.
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

function main(): void {
  const problems: string[] = [];
  const repository = repositoryFiles();
  const files = sourceFiles(repository);

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
          problems.push(`${file}:${index + 1} [${rule.id}] ${rule.message}`);
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
            `${file} [import-direction] imports ${specifier}. ${boundary.message}`,
          );
        }
      }
    }

    if (isSpec(logicalFile)) {
      for (const line of negativeResponsesValidated(source)) {
        problems.push(
          `${file}:${line} [no-success-schema-on-negative-response] A test that expects a 4xx status must not validate the body against a success schema. Assert the error fields instead; validated setup data comes from a client setup helper.`,
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
            `${file}:${index + 1} [no-snapshot-update-in-automation] Visual baselines are approved by a human, never updated by a script or CI.`,
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
