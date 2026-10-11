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

const ROOT = path.resolve(__dirname, "../..");
const STARTER_DIR = ".qa/starter";
const PILOT_PATHS = ".qa/pilot-paths.json";

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
    removeExamples: Type.Boolean(),
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

async function askAnswers(): Promise<Answers> {
  // Lines are pulled on demand so piped answers are not dropped between
  // questions, which readline's question() does with non-TTY input.
  const rl = createInterface({ input: stdin, terminal: false });
  const lines = rl[Symbol.asyncIterator]();

  const ask = async (question: string, fallback: string) => {
    stdout.write(`? ${question} (${fallback}): `);
    const { value, done } = await lines.next();
    const answer = done ? "" : String(value).trim();

    if (!stdin.isTTY) stdout.write(`${answer}\n`);

    return answer || fallback;
  };
  const confirm = async (question: string, fallback: boolean) =>
    /^y/i.test(await ask(`${question} [y/n]`, fallback ? "y" : "n"));
  const list = (value: string) =>
    value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);

  try {
    const appName = await ask("Project name", "my-app-tests");

    const environments: Answers["environments"] = {};
    for (const name of list(await ask("Environments", "staging,local"))) {
      const webBaseUrl = await ask(`${name}: web URL`, "http://localhost:3000");
      const apiBaseUrl = await ask(`${name}: API URL`, `${webBaseUrl}/api`);
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

    const browsers = list(
      await ask(`Browsers (${BROWSERS.join(", ")})`, "chromium"),
    ) as Answers["browsers"];

    const usernameField = await ask("Login username field", "email");
    const passwordField = await ask("Login password field", "password");

    const api: Answers["auth"]["api"] = (await confirm(
      "API uses bearer-token login",
      true,
    ))
      ? {
          strategy: "bearer",
          loginPath: await ask("API login path", "/auth/login"),
          usernameField,
          passwordField,
          tokenField: await ask(
            "Token field in login response",
            "access_token",
          ),
        }
      : { strategy: "none" };

    const browser: Answers["auth"]["browser"] = (await confirm(
      "Browser uses NextAuth / Auth.js credentials login",
      false,
    ))
      ? {
          strategy: "nextAuth",
          csrfPath: await ask("CSRF path", "/api/auth/csrf"),
          callbackPath: await ask(
            "Credentials callback path",
            "/api/auth/callback/credentials",
          ),
          landingPath: await ask("Landing path after login", "/dashboard"),
          usernameField,
          passwordField,
        }
      : { strategy: "none" };

    const roles = list(await ask("Roles", "user"));

    const removeExamples = await confirm(
      "Remove the UPEX example application code and tests",
      true,
    );

    return {
      appName,
      environments,
      modules,
      browsers,
      auth: { api, browser },
      roles,
      removeExamples,
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

function removeExamples(): void {
  const pilot: { paths: string[]; scripts: string[] } = JSON.parse(
    fs.readFileSync(rootPath(PILOT_PATHS), "utf8"),
  );

  for (const pilotPath of pilot.paths) {
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

  const frameworkConfig = buildFrameworkConfig(answers);
  validateSchema(frameworkConfigSchema, frameworkConfig);

  if (answers.removeExamples) {
    console.log("Removing UPEX example code:");
    removeExamples();
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
  4. Write tests from the golden templates: .qa/templates/README.md`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
