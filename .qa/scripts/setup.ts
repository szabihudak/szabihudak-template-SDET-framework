import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { stdin, stdout } from "node:process";
import { createInterface } from "node:readline/promises";

import { Type, type Static } from "@sinclair/typebox";
import * as prettier from "prettier";

import { validateSchema } from "../../src/framework/api/SchemaValidator";
import { environmentsSchema } from "../../src/framework/config/environmentSchema";
import {
  BROWSERS,
  frameworkConfigSchema,
  type FrameworkConfig,
} from "../../src/framework/config/frameworkConfigSchema";

import {
  ciSecretNames,
  describeCiSettings,
  syncWorkflowSecrets,
} from "./ci-secrets";
import { assertSupportedNode } from "./runtime";

const ROOT = path.resolve(__dirname, "../..");
const STARTER_DIR = ".qa/starter";
const PILOT_PATHS = ".qa/pilot-paths.json";
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
    installStarter: Type.Boolean(),
  },
  { additionalProperties: false },
);

type Answers = Static<typeof answersSchema>;

const rootPath = (file: string) => path.join(ROOT, file);

async function writeFormatted(file: string, content: string): Promise<void> {
  fs.mkdirSync(path.dirname(rootPath(file)), { recursive: true });
  fs.writeFileSync(
    rootPath(file),
    await prettier.format(content, { filepath: rootPath(file) }),
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

async function askAnswers(): Promise<Answers> {
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

  stdout.write(
    "Setup asks about your application. Never type credentials here: after setup, put test-account credentials into .env.\n\n",
  );

  try {
    const appName = await ask("Project name", "my-app-tests", isProjectName);

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
      const database = await confirm(
        `${name}: allow direct database access (dedicated test database only)`,
        false,
      );
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

    const installStarter = await confirm(
      "Replace the UPEX reference implementation with the starter application layer and CI workflows",
      true,
    );

    return {
      appName,
      environments,
      modules,
      browsers,
      installStarter,
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
      "# login and roles (docs/FIRST_TESTS_PROMPT.md, step 1).",
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

function copyDirectory(from: string, to: string): string[] {
  const copied: string[] = [];

  for (const entry of fs.readdirSync(rootPath(from), { withFileTypes: true })) {
    const source = path.join(from, entry.name);
    const target = path.join(to, entry.name);

    if (entry.isDirectory()) {
      copied.push(...copyDirectory(source, target));
    } else {
      fs.mkdirSync(path.dirname(rootPath(target)), { recursive: true });
      fs.copyFileSync(rootPath(source), rootPath(target));
      copied.push(target);
    }
  }

  return copied;
}

function installStarterFiles(): void {
  const pilot: { paths: string[]; templateOnly: string[]; scripts: string[] } =
    JSON.parse(fs.readFileSync(rootPath(PILOT_PATHS), "utf8"));

  for (const pilotPath of [...pilot.paths, ...pilot.templateOnly]) {
    fs.rmSync(rootPath(pilotPath), { recursive: true, force: true });
    console.log(`  removed ${pilotPath}`);
  }

  const packageJson = JSON.parse(
    fs.readFileSync(rootPath("package.json"), "utf8"),
  );
  for (const script of pilot.scripts) delete packageJson.scripts[script];
  fs.writeFileSync(
    rootPath("package.json"),
    `${JSON.stringify(packageJson, null, 2)}\n`,
  );

  for (const file of copyDirectory(STARTER_DIR, ".")) {
    console.log(`  added ${file}`);
  }

  fs.writeFileSync(
    rootPath(".qa-project.json"),
    `${JSON.stringify(
      {
        $comment:
          "Project golden examples: reviewed, green implementations from this project. They take precedence over the generic templates in .qa/index.json for the same responsibility.",
        examples: [],
      },
      null,
      2,
    )}\n`,
  );
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

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const answersIndex = args.indexOf("--answers");
  const force = args.includes("--force");

  assertSupportedNode();
  assertCleanWorkingTree(force);

  const answers: unknown =
    answersIndex >= 0
      ? JSON.parse(
          fs.readFileSync(path.resolve(args[answersIndex + 1]), "utf8"),
        )
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

  const secretNames = ciSecretNames(frameworkConfig);

  if (answers.installStarter) {
    console.log(
      "Replacing the UPEX reference implementation with starter files:",
    );
    installStarterFiles();
    syncWorkflowSecrets(ROOT, secretNames);
  }

  await writeFormatted(
    "config/environments/environments.json",
    JSON.stringify(answers.environments),
  );
  await writeFormatted(
    "config/framework.config.ts",
    `import { defineFrameworkConfig } from "../src/framework/config/frameworkConfigSchema";\n\nexport default defineFrameworkConfig(${JSON.stringify(frameworkConfig)});\n`,
  );
  fs.writeFileSync(
    rootPath(".env.example"),
    buildEnvExample(answers, frameworkConfig),
  );

  const packageJson = JSON.parse(
    fs.readFileSync(rootPath("package.json"), "utf8"),
  );
  packageJson.name = answers.appName;
  fs.writeFileSync(
    rootPath("package.json"),
    `${JSON.stringify(packageJson, null, 2)}\n`,
  );

  const loginConfigured = Object.keys(frameworkConfig.roles).length > 0;

  console.log(`
Setup complete for ${answers.appName}.

Next steps:
  1. cp .env.example .env   (TEST_ENV is preset)
  2. npm run doctor         (checks that the URLs are reachable)
  3. ${
    loginConfigured
      ? "Add the role test accounts to .env and run npm run doctor again."
      : "Configure login and roles, then write the first tests: follow docs/FIRST_TESTS_PROMPT.md with your AI tool (or by hand)."
  }
  4. Write tests from the golden templates: .qa/templates/README.md
${answers.installStarter ? `\n${describeCiSettings(defaultEnvironment(answers), secretNames)}` : ""}`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
