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

import { assertSupportedNode } from "./runtime";

const ROOT = path.resolve(__dirname, "../..");
const STARTER_DIR = ".qa/starter";
const PILOT_PATHS = ".qa/pilot-paths.json";
const STARTER_WORKFLOWS = [
  ".github/workflows/playwright.yml",
  ".github/workflows/performance.yml",
];
const SECRETS_MARKER = /^([ \t]*)# @qa:secrets[ \t]*\n/m;

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
    auth: frameworkConfigSchema.properties.auth,
    roles: Type.Array(Type.String({ pattern: "^[a-z][a-zA-Z0-9]*$" }), {
      uniqueItems: true,
    }),
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

const isFieldName: Validator = (value) =>
  /^[A-Za-z_][A-Za-z0-9_.-]*$/.test(value)
    ? undefined
    : "Enter the NAME of the field in the login request (for example email), not your username or password.";

const isProjectName: Validator = (value) =>
  /^[a-z0-9][a-z0-9-]*$/.test(value)
    ? undefined
    : "Use lower-case letters, digits and hyphens, for example my-app-tests.";

const isNameList =
  (pattern: RegExp, example: string): Validator =>
  (value) =>
    value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean)
      .every((item) => pattern.test(item))
      ? undefined
      : `Enter a comma-separated list such as ${example}.`;

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
  if (answers.auth.api.strategy === "bearer") {
    paths.push(["auth.api.loginPath", answers.auth.api.loginPath]);
  }
  if (answers.auth.browser.strategy === "nextAuth") {
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
    const environmentNames = list(
      await ask(
        "Environments",
        "staging,local",
        isNameList(/^[A-Za-z][A-Za-z0-9_-]*$/, "staging,local"),
      ),
    );

    for (const name of environmentNames) {
      const webBaseUrl = await ask(
        `${name}: web URL`,
        "http://localhost:3000",
        isUrl,
      );
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

    let fieldNames:
      { usernameField: string; passwordField: string } | undefined;
    const askFieldNames = async () => {
      fieldNames ??= {
        usernameField: await ask(
          "Name of the username field in the login request (a field name, not your username)",
          "email",
          isFieldName,
        ),
        passwordField: await ask(
          "Name of the password field in the login request (a field name, not your password)",
          "password",
          isFieldName,
        ),
      };

      return fieldNames;
    };

    const api: Answers["auth"]["api"] = (await confirm(
      "API uses bearer-token login",
      true,
    ))
      ? {
          strategy: "bearer",
          loginPath: await ask("API login path", "/auth/login", isPath),
          ...(await askFieldNames()),
          tokenField: await ask(
            "Token field in the login response",
            "access_token",
            isFieldName,
          ),
        }
      : { strategy: "none" };

    const browser: Answers["auth"]["browser"] =
      usesBrowser &&
      (await confirm(
        "Browser uses NextAuth / Auth.js credentials login",
        false,
      ))
        ? {
            strategy: "nextAuth",
            csrfPath: await ask("CSRF path", "/api/auth/csrf", isPath),
            callbackPath: await ask(
              "Credentials callback path",
              "/api/auth/callback/credentials",
              isPath,
            ),
            landingPath: await ask(
              "Landing path after login",
              "/dashboard",
              isPath,
            ),
            ...(await askFieldNames()),
          }
        : { strategy: "none" };

    // Role credentials serve both API tokens and browser sessions.
    const roles =
      api.strategy === "none" && browser.strategy === "none"
        ? []
        : list(
            await ask(
              "Roles, comma-separated (each gets its own test account in .env)",
              "user",
              isNameList(/^[a-z][a-zA-Z0-9]*$/, "user,admin"),
            ),
          );

    const installStarter = await confirm(
      "Replace the UPEX reference implementation with the starter application layer, tests and CI workflows",
      true,
    );

    return {
      appName,
      environments,
      modules,
      browsers,
      auth: { api, browser },
      roles,
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
    auth: answers.auth,
    roles: Object.fromEntries(
      answers.roles.map((role) => [
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
    `TEST_ENV=${Object.keys(answers.environments)[0]}`,
    "",
  ];

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

function ciSecretNames(answers: Answers, config: FrameworkConfig): string[] {
  const names = Object.values(config.roles).flatMap(
    ({ usernameEnv, passwordEnv }) => [usernameEnv, passwordEnv],
  );

  if (answers.modules.database) names.push("DATABASE_URL");

  return names;
}

// Workflow env blocks cannot read secrets dynamically, so each one is listed.
function injectWorkflowSecrets(file: string, secretNames: string[]): void {
  const workflow = fs.readFileSync(rootPath(file), "utf8");
  const match = workflow.match(SECRETS_MARKER);

  if (!match) return;

  const indent = match[1];
  let updated = workflow.replace(
    SECRETS_MARKER,
    secretNames
      .map((name) => `${indent}${name}: \${{ secrets.${name} }}\n`)
      .join(""),
  );

  // An env key left without entries is invalid workflow syntax.
  updated = updated.replace(/^[ \t]*env:[ \t]*\n[ \t]*\n/m, "");

  fs.writeFileSync(rootPath(file), updated);
}

function ciInstructions(answers: Answers, secretNames: string[]): string {
  const environments = Object.keys(answers.environments);
  const ciEnvironment =
    environments.find((name) => name !== "local") ?? environments[0];

  return `
GitHub Actions (Settings → Secrets and variables → Actions):
  Variable  TEST_ENV = ${ciEnvironment}
${secretNames.map((name) => `  Secret    ${name}`).join("\n") || "  No secrets required."}`;
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

  const secretNames = ciSecretNames(answers, frameworkConfig);

  if (answers.installStarter) {
    console.log(
      "Replacing the UPEX reference implementation with starter files:",
    );
    installStarterFiles();

    for (const workflow of STARTER_WORKFLOWS) {
      if (fs.existsSync(rootPath(workflow))) {
        injectWorkflowSecrets(workflow, secretNames);
      }
    }
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

  console.log(`
Setup complete for ${answers.appName}.

Next steps:
  1. cp .env.example .env   and fill in the credentials
  2. npm run doctor
  3. npm run test:starter
  4. Write tests from the golden templates: .qa/templates/README.md
${answers.installStarter ? ciInstructions(answers, secretNames) : ""}`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
