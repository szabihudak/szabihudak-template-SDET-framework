import { execSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { stdin, stdout } from "node:process";
import { createInterface } from "node:readline/promises";

import { Type, type Static } from "@sinclair/typebox";
import * as prettier from "prettier";

import { validateSchema } from "../framework/api/SchemaValidator";
import { environmentsSchema } from "../framework/config/environmentSchema";
import {
  BROWSERS,
  frameworkConfigSchema,
  type FrameworkConfig,
} from "../framework/config/frameworkConfigSchema";

import {
  ciSecretNames,
  describeCiSettings,
  syncWorkflowSecrets,
} from "./ci-secrets";
import { assertSupportedNode } from "./runtime";

const ROOT = path.resolve(__dirname, "../..");
const STARTER_DIR = "template-fw/setup/starter";
const PROJECT_FILES = "template-fw/setup/project-files.json";
const ENVIRONMENTS = [
  { name: "staging", fallback: "-" },
  { name: "local", fallback: "http://localhost:3000" },
] as const;
const SKIP = "-";

const BROWSER_MODULES = [
  "ui",
  "smoke",
  "accessibility",
  "visual",
  "performance",
] as const;

const AI_TOOLS = ["copilot", "claude", "both", "none"] as const;
const AI_TOOLS_DIR = "template-fw/setup/ai-tools";

const MODULES = [
  "api",
  "ui",
  "smoke",
  "accessibility",
  "database",
  "visual",
  "performance",
  "ai",
] as const;

const answersSchema = Type.Object(
  {
    appName: Type.String({ pattern: "^[a-z0-9][a-z0-9-]*$" }),
    environments: environmentsSchema,
    modules: frameworkConfigSchema.properties.modules,
    browsers: frameworkConfigSchema.properties.browsers,
    // Login is configured after setup; answers files may still provide it.
    auth: Type.Optional(frameworkConfigSchema.properties.auth),
    roles: Type.Optional(
      Type.Array(Type.String({ pattern: "^[a-z][a-zA-Z0-9]*$" }), {
        uniqueItems: true,
      }),
    ),
    aiTools: Type.Optional(
      Type.Union(AI_TOOLS.map((tool) => Type.Literal(tool))),
    ),
  },
  { additionalProperties: false },
);

type Answers = Static<typeof answersSchema>;

// Secrets are never part of the answers, so an answers file stays shareable.
type Secrets = { databaseUrl?: string };

const templatePath = (file: string) => path.join(ROOT, file);

// Starter files, AI tool files and the project file list. An in-place setup
// stages them first, because it removes them from the folder it transforms.
const RESOURCES = [
  STARTER_DIR,
  AI_TOOLS_DIR,
  PROJECT_FILES,
  ".github/workflows/ai-failure-analysis.yml",
];
let sourceRoot = ROOT;
const sourcePath = (file: string) => path.join(sourceRoot, file);

function stageResources(): void {
  sourceRoot = fs.mkdtempSync(path.join(os.tmpdir(), "qa-setup-"));

  for (const resource of RESOURCES) {
    fs.cpSync(templatePath(resource), sourcePath(resource), {
      recursive: true,
    });
  }
}

async function writeFormatted(
  project: string,
  file: string,
  content: string,
): Promise<void> {
  const target = path.join(project, file);

  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(
    target,
    await prettier.format(content, { filepath: target }),
  );
}

function roleEnvPrefix(role: string): string {
  return role.replace(/([a-z0-9])([A-Z])/g, "$1_$2").toUpperCase();
}

function describeSchemaError(error: unknown): string {
  const details = String(
    error instanceof Error ? error.message : error,
  ).replace(/^Schema validation failed:\n/, "");

  try {
    const errors: { instancePath: string; message: string }[] =
      JSON.parse(details);

    return errors
      .map(
        ({ instancePath, message }) => `  - ${instancePath || "/"} ${message}`,
      )
      .join("\n");
  } catch {
    return details;
  }
}

type Validator = (value: string) => string | undefined;

const isUrl: Validator = (value) => {
  try {
    const url = new URL(value);

    if (
      (url.protocol === "http:" || url.protocol === "https:") &&
      !/[\s[\]()]/.test(value)
    ) {
      return undefined;
    }
  } catch {
    // Fall through to the message below.
  }

  return "Enter a full URL such as https://staging.example.com (no brackets or spaces).";
};

const isPath: Validator = (value) =>
  /^\/[^\s]*$/.test(value)
    ? undefined
    : "Enter a path that starts with /, for example /dashboard.";

const isProjectName: Validator = (value) =>
  /^[a-z0-9][a-z0-9-]*$/.test(value)
    ? undefined
    : "Use lower-case letters, digits and hyphens, for example my-app-tests.";

const isBrowserList: Validator = (value) => {
  const unknown = value
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item && !(BROWSERS as readonly string[]).includes(item));

  return unknown.length === 0
    ? undefined
    : `Unknown browser: ${unknown.join(", ")}. Choose from ${BROWSERS.join(", ")}.`;
};

const isDatabaseUrl: Validator = (value) =>
  value === "" || /^postgres(ql)?:\/\/\S+$/.test(value)
    ? undefined
    : "Enter a PostgreSQL URL such as postgresql://user:password@host:5432/test_db, or press Enter to skip.";

const isAiTool: Validator = (value) =>
  (AI_TOOLS as readonly string[]).includes(value)
    ? undefined
    : `Choose one of ${AI_TOOLS.join(", ")}.`;

// Removes the characters a raw-mode terminal sends for backspace.
function applyBackspaces(value: string): string {
  const characters: string[] = [];

  for (const character of value) {
    if (character === "\x7f" || character === "\b") characters.pop();
    else if (character >= " ") characters.push(character);
  }

  return characters.join("");
}

// Checks the answers file mode cannot express through the schema alone.
function semanticErrors(answers: Answers): string[] {
  const errors: string[] = [];

  for (const [name, environment] of Object.entries(answers.environments)) {
    for (const key of ["webBaseUrl", "apiBaseUrl"] as const) {
      const error = isUrl(environment[key]);
      if (error) errors.push(`environments.${name}.${key}: ${error}`);
    }
  }

  const paths: [string, string][] = [];
  if (answers.auth?.api.strategy === "bearer") {
    paths.push(["auth.api.loginPath", answers.auth.api.loginPath]);
  }
  if (answers.auth?.browser.strategy === "nextAuth") {
    paths.push(
      ["auth.browser.csrfPath", answers.auth.browser.csrfPath],
      ["auth.browser.callbackPath", answers.auth.browser.callbackPath],
      ["auth.browser.landingPath", answers.auth.browser.landingPath],
    );
  }
  for (const [key, value] of paths) {
    const error = isPath(value);
    if (error) errors.push(`${key}: ${error}`);
  }

  return errors;
}

async function askAnswers(): Promise<{ answers: Answers; secrets: Secrets }> {
  // Lines are pulled on demand so piped answers are not dropped between
  // questions, which readline's question() does with non-TTY input.
  const rl = createInterface({ input: stdin, terminal: false });
  const lines = rl[Symbol.asyncIterator]();

  const ask = async (
    question: string,
    fallback: string,
    validate?: Validator,
  ): Promise<string> => {
    for (;;) {
      stdout.write(`? ${question} (${fallback}): `);
      const { value, done } = await lines.next();
      const answer = (done ? "" : String(value).trim()) || fallback;

      if (!stdin.isTTY) stdout.write(`${done ? "" : String(value).trim()}\n`);

      const error = validate?.(answer);
      if (!error) return answer;

      // Piped input cannot be corrected interactively, so stop instead of looping.
      if (!stdin.isTTY || done) {
        throw new Error(`Invalid answer for "${question}": ${error}`);
      }

      stdout.write(`  ✖ ${error}\n`);
    }
  };
  const confirm = async (question: string, fallback: boolean) =>
    /^y/i.test(
      await ask(`${question} [y/n]`, fallback ? "y" : "n", (value) =>
        /^(y|yes|n|no)$/i.test(value) ? undefined : "Answer y or n.",
      ),
    );
  const list = (value: string) =>
    value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);

  // Reads a value without echoing it; the terminal echoes typed characters
  // unless raw mode is on.
  const askSecret = async (
    question: string,
    validate: Validator,
  ): Promise<string> => {
    for (;;) {
      stdout.write(`? ${question}: `);
      if (stdin.isTTY) stdin.setRawMode(true);

      let line: IteratorResult<string>;
      try {
        line = await lines.next();
      } finally {
        if (stdin.isTTY) stdin.setRawMode(false);
      }
      stdout.write("\n");

      const raw = line.done ? "" : String(line.value);
      if (raw.includes("\u0003")) process.exit(130);

      const answer = applyBackspaces(raw).trim();
      const error = validate(answer);
      if (!error) return answer;

      if (!stdin.isTTY || line.done) {
        throw new Error(`Invalid answer for "${question}": ${error}`);
      }

      stdout.write(`  ✖ ${error}\n`);
    }
  };

  stdout.write(
    "Setup creates a new project folder next to the template and asks about your application, not about login. The only secret it asks for is the test database URL, with hidden input, written only to the git-ignored .env file.\n\n",
  );

  try {
    const appName = await ask("Project name", "my-app-tests", isProjectName);

    const defaults: Answers["modules"] = {
      api: true,
      ui: true,
      smoke: true,
      accessibility: true,
      database: false,
      visual: false,
      performance: false,
      ai: false,
    };
    const modules = { ...defaults };
    for (const module of MODULES) {
      modules[module] = await confirm(
        `Enable ${module} tests`,
        defaults[module],
      );
    }

    // API-only projects never launch a browser, so browser questions are skipped.
    const usesBrowser = BROWSER_MODULES.some((module) => modules[module]);

    const browsers = (
      usesBrowser
        ? list(
            await ask(
              `Browsers, comma-separated (${BROWSERS.join(", ")})`,
              "chromium",
              isBrowserList,
            ),
          )
        : ["chromium"]
    ) as Answers["browsers"];

    const environments: Answers["environments"] = {};

    for (const { name, fallback } of ENVIRONMENTS) {
      const webBaseUrl = await ask(
        `${name}: web URL ("${SKIP}" to skip)`,
        fallback,
        (value) => (value === SKIP ? undefined : isUrl(value)),
      );

      if (webBaseUrl === SKIP) continue;

      const apiBaseUrl = await ask(
        `${name}: API URL`,
        `${webBaseUrl.replace(/\/$/, "")}/api`,
        isUrl,
      );
      const database =
        modules.database &&
        (await confirm(
          `${name}: allow direct database access (dedicated test database only)`,
          false,
        ));
      const destructive =
        database &&
        (await confirm(`${name}: allow destructive database reset`, false));
      const performance = await confirm(
        `${name}: allow performance measurement`,
        false,
      );

      environments[name] = {
        webBaseUrl,
        apiBaseUrl,
        allow: { database, destructive, performance },
      };
    }

    if (Object.keys(environments).length === 0) {
      throw new Error(
        "At least one environment needs a URL. Run npm run setup again and enter the staging or local URL.",
      );
    }

    const secrets: Secrets = {};

    if (Object.values(environments).some(({ allow }) => allow.database)) {
      secrets.databaseUrl =
        (await askSecret(
          "DATABASE_URL of the dedicated test database (hidden, Enter to skip)",
          isDatabaseUrl,
        )) || undefined;
    }

    const aiTools = (await ask(
      `AI coding tool (${AI_TOOLS.join(", ")})`,
      "none",
      isAiTool,
    )) as NonNullable<Answers["aiTools"]>;

    return {
      answers: {
        appName,
        environments,
        modules,
        browsers,
        aiTools,
      },
      secrets,
    };
  } finally {
    rl.close();
  }
}

function buildFrameworkConfig(answers: Answers): FrameworkConfig {
  return {
    modules: answers.modules,
    browsers: answers.browsers,
    execution: { ciRetries: 2, ciWorkers: "50%" },
    auth: answers.auth ?? {
      api: { strategy: "none" },
      browser: { strategy: "none" },
    },
    roles: Object.fromEntries(
      (answers.roles ?? []).map((role) => [
        role,
        {
          usernameEnv: `${roleEnvPrefix(role)}_USERNAME`,
          passwordEnv: `${roleEnvPrefix(role)}_PASSWORD`,
        },
      ]),
    ),
  };
}

function buildEnvExample(answers: Answers, config: FrameworkConfig): string {
  const lines = [
    "# Copy to .env and fill in. .env is git-ignored.",
    `TEST_ENV=${defaultEnvironment(answers)}`,
    "",
  ];

  if (Object.keys(config.roles).length === 0) {
    lines.push(
      "# Test accounts: add one USERNAME/PASSWORD pair per role after configuring",
      "# login and roles (template-fw/docs/FIRST_TESTS_PROMPT.md, step 1).",
    );
  }

  for (const [role, { usernameEnv, passwordEnv }] of Object.entries(
    config.roles,
  )) {
    lines.push(
      `# ${role} role test account`,
      `${usernameEnv}=`,
      `${passwordEnv}=`,
    );
  }

  if (answers.modules.database) {
    lines.push("", "# Dedicated test database only", "DATABASE_URL=");
  }

  if (answers.modules.ai) {
    lines.push("", "# AI failure analysis and test design", "OPENAI_API_KEY=");
  }

  return `${lines.join("\n")}\n`;
}

function defaultEnvironment(answers: Answers): string {
  return "staging" in answers.environments
    ? "staging"
    : Object.keys(answers.environments)[0];
}

type ProjectFiles = {
  reference: string[];
  templateOnly: string[];
  scripts: string[];
};

const within = (file: string, entries: string[]) =>
  entries.some((entry) => file === entry || file.startsWith(`${entry}/`));

// Files of the template that belong in a project: everything except the UPEX
// reference implementation and the files that only build or test the template.
// Uncommitted files are included so a change can be verified before a commit.
function projectFileList(): string[] {
  const excluded: ProjectFiles = JSON.parse(
    fs.readFileSync(sourcePath(PROJECT_FILES), "utf8"),
  );

  return execSync("git ls-files --cached --others --exclude-standard", {
    cwd: ROOT,
  })
    .toString()
    .split("\n")
    .filter(
      (file) =>
        file &&
        fs.existsSync(templatePath(file)) &&
        !within(file, [...excluded.reference, ...excluded.templateOnly]),
    );
}

function copyFromTemplate(from: string, project: string, to = from): void {
  const target = path.join(project, to);

  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(sourcePath(from), target);
}

function copyDirectory(from: string, project: string): string[] {
  const copied: string[] = [];
  const walk = (directory: string) => {
    for (const entry of fs.readdirSync(sourcePath(path.join(from, directory)), {
      withFileTypes: true,
    })) {
      const relative = path.join(directory, entry.name);

      if (entry.isDirectory()) {
        walk(relative);
      } else {
        copyFromTemplate(path.join(from, relative), project, relative);
        copied.push(relative);
      }
    }
  };

  walk("");
  return copied;
}

// A new folder next to the template, or the template folder itself
// (--in-place, for a repository created with "Use this template").
function prepareProject(target: string, inPlace: boolean): void {
  const files = projectFileList();

  if (inPlace) {
    const keep = new Set(files);
    const all = execSync("git ls-files --cached --others --exclude-standard", {
      cwd: ROOT,
    })
      .toString()
      .split("\n")
      .filter((file) => file && fs.existsSync(templatePath(file)));

    for (const file of all.filter((file) => !keep.has(file))) {
      fs.rmSync(templatePath(file), { force: true });
    }
    removeEmptyDirectories(ROOT);
    return;
  }

  if (fs.existsSync(target) && fs.readdirSync(target).length > 0) {
    throw new Error(
      `${target} already exists and is not empty. Choose another project name or remove the folder.`,
    );
  }

  for (const file of files) copyFromTemplate(file, target);
}

function removeEmptyDirectories(directory: string): void {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (!entry.isDirectory() || [".git", "node_modules"].includes(entry.name)) {
      continue;
    }

    const child = path.join(directory, entry.name);
    removeEmptyDirectories(child);
    if (fs.readdirSync(child).length === 0) fs.rmdirSync(child);
  }
}

function installStarterFiles(project: string, answers: Answers): void {
  copyDirectory(STARTER_DIR, project);

  if (!answers.modules.performance) {
    fs.rmSync(path.join(project, ".github/workflows/performance.yml"));
  }
  if (answers.modules.ai) {
    copyFromTemplate(".github/workflows/ai-failure-analysis.yml", project);
  }
}

// Instructions and the /first-tests command for the chosen AI tools. AGENTS.md
// stays the single source of rules for every tool.
function installAiTools(
  project: string,
  choice: NonNullable<Answers["aiTools"]>,
): void {
  const tools =
    choice === "both"
      ? ["copilot", "claude"]
      : choice === "none"
        ? []
        : [choice];

  if (!tools.includes("copilot")) {
    fs.rmSync(path.join(project, ".github/copilot-instructions.md"), {
      force: true,
    });
  }

  for (const tool of tools)
    copyDirectory(path.join(AI_TOOLS_DIR, tool), project);
}

function updatePackageFiles(project: string, appName: string): void {
  const excluded: ProjectFiles = JSON.parse(
    fs.readFileSync(sourcePath(PROJECT_FILES), "utf8"),
  );
  const packageFile = path.join(project, "package.json");
  const packageJson = JSON.parse(fs.readFileSync(packageFile, "utf8"));

  packageJson.name = appName;
  for (const script of excluded.scripts) delete packageJson.scripts[script];
  fs.writeFileSync(packageFile, `${JSON.stringify(packageJson, null, 2)}\n`);

  const lockFile = path.join(project, "package-lock.json");
  const lock = JSON.parse(fs.readFileSync(lockFile, "utf8"));

  lock.name = appName;
  if (lock.packages?.[""]) lock.packages[""].name = appName;
  fs.writeFileSync(lockFile, `${JSON.stringify(lock, null, 2)}\n`);
}

function buildReadme(answers: Answers): string {
  return `# ${answers.appName}

Playwright tests created from the SDET framework template.

## Structure

| Folder | Owner | Contents |
| --- | --- | --- |
| \`src/\` | this project | schemas, API clients, factories, Page Objects, components, mocks, fixtures |
| \`tests/\` | this project | specs |
| \`config/\` | this project | \`framework.config.ts\`, environments, \`approved-examples.json\` |
| \`template-fw/\` | template | framework core, golden templates, tools and documentation; change it in the template |

Imports use the \`@app/\` (\`src/\`) and \`@framework/\` (\`template-fw/framework/\`) aliases.

## Commands

\`\`\`bash
./install.sh                  # teammates: dependencies, .env, browsers, doctor
npm run doctor                # configuration, reachability and login checks
npx playwright test           # all enabled projects
npm run lint:architecture     # layer and import rules
npm run qa:sync-ci-secrets    # role and database secrets for GitHub Actions
\`\`\`

Rules for people and AI tools: [AGENTS.md](AGENTS.md). First tests: [template-fw/docs/FIRST_TESTS_PROMPT.md](template-fw/docs/FIRST_TESTS_PROMPT.md).
`;
}

function approvedExamples(): string {
  return `${JSON.stringify(
    {
      $comment:
        "Project golden examples: reviewed, green implementations from this project. They take precedence over the generic templates in template-fw/index.json for the same responsibility. Project-owned; template updates never change this file.",
      examples: [],
    },
    null,
    2,
  )}\n`;
}

// .env is git-ignored, so it is the only place setup writes a secret to. An
// existing .env is kept; only its database URL is updated when one was given.
function writeEnvFile(
  project: string,
  envExample: string,
  secrets: Secrets,
): string {
  const envFile = path.join(project, ".env");
  const databaseLine = secrets.databaseUrl
    ? `DATABASE_URL=${secrets.databaseUrl}`
    : undefined;

  if (!fs.existsSync(envFile)) {
    fs.writeFileSync(
      envFile,
      databaseLine
        ? envExample.replace(/^DATABASE_URL=$/m, databaseLine)
        : envExample,
    );

    return `Created .env from .env.example${databaseLine ? " with DATABASE_URL" : ""}.`;
  }

  if (!databaseLine) {
    return ".env already exists and was left unchanged; compare it with .env.example.";
  }

  const current = fs.readFileSync(envFile, "utf8");
  fs.writeFileSync(
    envFile,
    /^DATABASE_URL=.*$/m.test(current)
      ? current.replace(/^DATABASE_URL=.*$/m, databaseLine)
      : `${current.replace(/\n?$/, "\n")}${databaseLine}\n`,
  );

  return ".env already exists; its DATABASE_URL was updated.";
}

function databaseWarnings(
  answers: Answers,
  secrets: Secrets,
  envStatus: string,
): string {
  if (!answers.modules.database) return "";

  const warnings: string[] = [];
  const allowed = Object.entries(answers.environments)
    .filter(([, environment]) => environment.allow.database)
    .map(([name]) => name);

  if (allowed.length === 0) {
    warnings.push(
      "Database tests are enabled, but no environment allows database access, so they will not run. Set allow.database in config/environments/environments.json for the dedicated test environment.",
    );
  } else if (!secrets.databaseUrl && !envStatus.startsWith(".env already")) {
    warnings.push(
      "DATABASE_URL is empty in .env. Add the dedicated test database URL before running database tests.",
    );
  }

  warnings.push(
    "CI/CD: database tests in GitHub Actions need the DATABASE_URL repository secret (Settings → Secrets and variables → Actions).",
  );

  return `\n${warnings.map((warning) => `⚠ ${warning}`).join("\n")}\n`;
}

function assertCleanWorkingTree(force: boolean): void {
  if (force) return;

  const status = execSync("git status --porcelain", { cwd: ROOT }).toString();

  if (status.trim()) {
    throw new Error(
      "The working tree has uncommitted changes. Commit or stash them first, or rerun with --force.",
    );
  }
}

// The project gets its own history, unconnected to the template repository.
function initialiseGit(project: string): string {
  try {
    execSync("git init -q -b main", { cwd: project });
    execSync("git add -A", { cwd: project });
    execSync(
      'git commit -q -m "Initial setup from the SDET framework template"',
      {
        cwd: project,
        stdio: "pipe",
      },
    );

    return "Created a git repository with an initial commit.";
  } catch {
    return "Created a git repository; commit the files yourself (git config user.name/user.email were not available).";
  }
}

// ../my-project reads better than an absolute path next to the template.
function displayPath(target: string): string {
  const relative = path.relative(process.cwd(), target);

  return relative.startsWith(`..${path.sep}..`) ? target : relative || ".";
}

function option(args: string[], name: string): string | undefined {
  const index = args.indexOf(name);

  return index >= 0 ? args[index + 1] : undefined;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const answersFile = option(args, "--answers");
  const inPlace = args.includes("--in-place");

  assertSupportedNode();
  if (inPlace) assertCleanWorkingTree(args.includes("--force"));

  // Non-interactive runs take the database URL from the environment.
  const { answers, secrets }: { answers: unknown; secrets: Secrets } =
    answersFile
      ? {
          answers: JSON.parse(
            fs.readFileSync(path.resolve(answersFile), "utf8"),
          ),
          secrets: { databaseUrl: process.env.DATABASE_URL || undefined },
        }
      : await askAnswers();

  try {
    validateSchema(answersSchema, answers);
  } catch (error) {
    throw new Error(`Invalid setup answers:\n${describeSchemaError(error)}`);
  }

  const errors = semanticErrors(answers);
  if (errors.length > 0) {
    throw new Error(
      `Invalid setup answers:\n${errors.map((error) => `  - ${error}`).join("\n")}`,
    );
  }

  const frameworkConfig = buildFrameworkConfig(answers);
  validateSchema(frameworkConfigSchema, frameworkConfig);

  const project = inPlace
    ? ROOT
    : path.resolve(
        option(args, "--target") ?? path.join(ROOT, "..", answers.appName),
      );
  const secretNames = ciSecretNames(frameworkConfig);
  const aiTools = answers.aiTools ?? "none";

  if (inPlace) stageResources();
  prepareProject(project, inPlace);
  installStarterFiles(project, answers);
  syncWorkflowSecrets(project, secretNames);
  installAiTools(project, aiTools);

  await writeFormatted(
    project,
    "config/environments/environments.json",
    JSON.stringify(answers.environments),
  );
  await writeFormatted(
    project,
    "config/framework.config.ts",
    `import { defineFrameworkConfig } from "../template-fw/framework/config/frameworkConfigSchema";\n\nexport default defineFrameworkConfig(${JSON.stringify(frameworkConfig)});\n`,
  );
  fs.writeFileSync(
    path.join(project, "config/approved-examples.json"),
    approvedExamples(),
  );
  await writeFormatted(project, "README.md", buildReadme(answers));
  updatePackageFiles(project, answers.appName);

  const envExample = buildEnvExample(answers, frameworkConfig);
  fs.writeFileSync(path.join(project, ".env.example"), envExample);
  const envStatus = writeEnvFile(project, envExample, secrets);
  const gitStatus = inPlace ? "" : `\n${initialiseGit(project)}`;

  // install.sh continues in the project folder.
  if (process.env.QA_SETUP_RESULT) {
    fs.writeFileSync(process.env.QA_SETUP_RESULT, project);
  }

  const loginConfigured = Object.keys(frameworkConfig.roles).length > 0;
  const firstTests = {
    copilot: "run /first-tests in GitHub Copilot Chat (agent mode)",
    claude: "run /first-tests in Claude Code",
    both: "run /first-tests in GitHub Copilot Chat (agent mode) or Claude Code",
    none: "follow template-fw/docs/FIRST_TESTS_PROMPT.md with your AI tool or by hand",
  }[aiTools];
  const steps = [
    ...(inPlace ? [] : [`cd ${displayPath(project)}`]),
    "npm run doctor   (checks the configuration and that the URLs are reachable)",
    loginConfigured
      ? "Add the role test accounts to .env and run npm run doctor again."
      : `Configure login and roles, then write the first tests: ${firstTests}.`,
  ];

  console.log(`
Created ${answers.appName} in ${project}.
${envStatus}${gitStatus}

Next steps:
${steps.map((step, index) => `  ${index + 1}. ${step}`).join("\n")}
${databaseWarnings(answers, secrets, envStatus)}
${describeCiSettings(defaultEnvironment(answers), secretNames)}
${inPlace ? "" : "\nTo publish it: create an empty GitHub repository, then git remote add origin <url> && git push -u origin main\n"}`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
