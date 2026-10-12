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
];

function sourceFiles(): string[] {
  return execSync("git ls-files --cached --others --exclude-standard", {
    cwd: ROOT,
  })
    .toString()
    .split("\n")
    .filter(
      (file) =>
        SOURCE_FILE.test(file) &&
        SOURCE_ROOTS.some((root) => file.startsWith(`${root}/`)) &&
        fs.existsSync(path.join(ROOT, file)),
    );
}

function isComment(line: string): boolean {
  return /^\s*(\/\/|\*|\/\*)/.test(line);
}

function main(): void {
  const problems: string[] = [];
  const files = sourceFiles();

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
  }

  if (problems.length > 0) {
    console.error(problems.map((problem) => `✖ ${problem}`).join("\n"));
    console.error(`\n${problems.length} architecture rule violation(s).`);
    process.exit(1);
  }

  console.log(`✔ ${files.length} files follow the architecture rules`);
}

main();
