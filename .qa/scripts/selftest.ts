import { execSync, spawn, type ChildProcess } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { parse } from "yaml";

const ROOT = path.resolve(__dirname, "../..");
const SELFTEST_DIR = ".qa/selftest";

function run(command: string, cwd: string, env: NodeJS.ProcessEnv = {}): void {
  console.log(`\n$ ${command}`);
  execSync(command, { cwd, stdio: "inherit", env: { ...process.env, ...env } });
}

// Copies the working tree, including uncommitted files, so a change can be
// verified before it is committed.
function copyTemplate(target: string): void {
  const files = execSync("git ls-files --cached --others --exclude-standard", {
    cwd: ROOT,
  })
    .toString()
    .split("\n")
    .filter((file) => file && fs.existsSync(path.join(ROOT, file)));

  for (const file of files) {
    fs.mkdirSync(path.dirname(path.join(target, file)), { recursive: true });
    fs.copyFileSync(path.join(ROOT, file), path.join(target, file));
  }

  fs.symlinkSync(
    path.join(ROOT, "node_modules"),
    path.join(target, "node_modules"),
  );
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`Self-test failed: ${message}`);
}

function ciPlan(project: string): string {
  return execSync("npx tsx .qa/scripts/ci-plan.ts", {
    cwd: project,
    env: { ...process.env, TEST_ENV: "selftest", GITHUB_OUTPUT: "" },
  }).toString();
}

function assertPlan(project: string, expected: string[]): void {
  const plan = ciPlan(project);

  assert(
    plan.includes(JSON.stringify(expected)),
    `unexpected CI plan: ${plan.trim()}`,
  );
  console.log(`✔ CI plan is ${JSON.stringify(expected)}`);
}

// Validates the workflows setup installed: parseable YAML, the managed secrets
// block listing exactly the expected secrets, and the container image matching
// the installed Playwright version.
function checkWorkflows(project: string, expectedSecrets: string[]): void {
  const read = (file: string) =>
    fs.readFileSync(path.join(project, file), "utf8");
  const playwrightVersion: string = JSON.parse(
    read("node_modules/@playwright/test/package.json"),
  ).version;

  const functional = parse(read(".github/workflows/playwright.yml"));
  assert(
    functional.jobs.tests.container.image ===
      `mcr.microsoft.com/playwright:v${playwrightVersion}-noble`,
    `tests container image does not match Playwright ${playwrightVersion}`,
  );

  const performance = parse(read(".github/workflows/performance.yml"));
  const browserPerformanceEnv = performance.jobs["browser-performance"].env;
  assert(
    browserPerformanceEnv?.TEST_ENV === "${{ inputs.environment }}",
    "browser-performance job does not select TEST_ENV",
  );

  for (const [file, env] of [
    [".github/workflows/playwright.yml", functional.jobs.tests.env],
    [".github/workflows/performance.yml", browserPerformanceEnv],
  ]) {
    assert(
      read(file).includes("# @qa:secrets:start") &&
        read(file).includes("# @qa:secrets:end"),
      `${file} lost its managed secrets markers`,
    );

    const secrets = Object.keys(env ?? {}).filter((name) =>
      String(env[name]).startsWith("${{ secrets."),
    );
    assert(
      JSON.stringify(secrets) === JSON.stringify(expectedSecrets),
      `${file} injects ${JSON.stringify(secrets)}, expected ${JSON.stringify(expectedSecrets)}`,
    );

    for (const secret of expectedSecrets) {
      assert(
        env[secret] === `\${{ secrets.${secret} }}`,
        `${file} does not read ${secret} from secrets`,
      );
    }
  }

  for (const removed of [
    ".github/workflows/ghcr-cleanup.yml",
    "docker-compose.yml",
    ".qa/selftest",
    ".qa/scripts/selftest.ts",
  ]) {
    assert(
      !fs.existsSync(path.join(project, removed)),
      `${removed} was not removed`,
    );
  }

  console.log(
    `✔ generated workflows are valid (secrets: ${expectedSecrets.join(", ") || "none"})`,
  );
}

// Renders golden templates the way a project uses them, so templates without a
// canonical file (and their combination with the starter layer) are compiled.
const RENDERED_TEMPLATES = [
  "domain-constants",
  "request-schema",
  "update-request-schema",
  "response-schema",
  "api-client",
  "factory",
  "page-object",
  "app-fixtures",
];
const RENDER_VALUES: Record<string, string> = {
  __Domain__: "Item",
  __domain__: "item",
  __Domains__: "Items",
  __domains__: "items",
  __DOMAIN__: "ITEM",
  __Page__: "Items",
  __page__: "items",
  __Component__: "ItemCard",
};

function renderTemplates(project: string): void {
  const index: {
    templates: { id: string; template: string; output: string }[];
  } = JSON.parse(fs.readFileSync(path.join(ROOT, ".qa/index.json"), "utf8"));
  const replaceTokens = (text: string) =>
    Object.entries(RENDER_VALUES).reduce(
      (result, [token, value]) => result.replaceAll(token, value),
      text,
    );

  for (const id of RENDERED_TEMPLATES) {
    const entry = index.templates.find((template) => template.id === id);
    assert(entry, `template ${id} is not in .qa/index.json`);

    const source = fs
      .readFileSync(path.join(ROOT, entry.template), "utf8")
      .replace(/^[ \t]*\/\/ @template\b.*(?:\r?\n|$)/gm, "");
    const output = path.join(project, replaceTokens(entry.output));

    fs.mkdirSync(path.dirname(output), { recursive: true });
    fs.writeFileSync(output, replaceTokens(source));
  }

  console.log(`✔ rendered ${RENDERED_TEMPLATES.length} golden templates`);
}

// Login is configured after setup; adding a role and synchronising the CI
// secrets is the step a project takes once its accounts exist.
function addUserRole(project: string): void {
  const configFile = path.join(project, "config/framework.config.ts");
  const config = fs.readFileSync(configFile, "utf8");
  const updated = config.replace(
    /roles: \{\}/,
    'roles: { user: { usernameEnv: "USER_USERNAME", passwordEnv: "USER_PASSWORD" } }',
  );

  assert(updated !== config, "generated config has no empty roles object");
  fs.writeFileSync(configFile, updated);
}

async function waitForApp(url: string): Promise<void> {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try {
      await fetch(url);
      return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  throw new Error(`Mock application did not start at ${url}`);
}

type Scenario = {
  name: string;
  answers: string;
  // Secrets the workflows inject right after setup.
  secrets: string[];
  // CI plan once the self-test login tests are in place; null runs the
  // minimal flow instead (no tests, role added later, templates rendered).
  plan: string[] | null;
  needsBrowser: boolean;
  // Files the chosen AI tool installs, and files it must not leave behind.
  aiFiles: { present: string[]; absent: string[] };
};

const ROLE_SECRETS = ["USER_USERNAME", "USER_PASSWORD"];
const COPILOT_FILES = [
  ".github/copilot-instructions.md",
  ".github/prompts/first-tests.prompt.md",
];
const CLAUDE_FILES = ["CLAUDE.md", ".claude/commands/first-tests.md"];
// The minimal scenario enables database tests without an environment that
// allows them; setup must still record the URL and the CI secret.
const SELFTEST_DATABASE_URL = "postgresql://selftest@localhost:5432/selftest";

const SCENARIOS: Scenario[] = [
  {
    name: "minimal (no login, no tests)",
    answers: "answers-minimal.json",
    secrets: ["DATABASE_URL"],
    plan: null,
    needsBrowser: false,
    aiFiles: { present: [], absent: [...COPILOT_FILES, ...CLAUDE_FILES] },
  },
  {
    name: "login configured (API + browser)",
    answers: "answers.json",
    secrets: ROLE_SECRETS,
    plan: ["api", "accessibility", "chromium"],
    needsBrowser: true,
    aiFiles: { present: [...COPILOT_FILES, ...CLAUDE_FILES], absent: [] },
  },
  {
    name: "login configured (API only)",
    answers: "answers-api-only.json",
    secrets: ROLE_SECRETS,
    plan: ["api"],
    needsBrowser: false,
    aiFiles: { present: COPILOT_FILES, absent: CLAUDE_FILES },
  },
];

function staticChecks(project: string, hasTests: boolean): void {
  run("npx prettier --check .", project);
  run("npx tsc --noEmit", project);
  run("npx tsx .qa/scripts/architecture.ts", project);
  run("npx tsx .qa/scripts/templates.ts check", project);
  if (hasTests) run("npx playwright test --list", project);
}

async function runScenario(
  scenario: Scenario,
  options: { keep: boolean; skipBrowser: boolean },
): Promise<void> {
  console.log(`\n=== Scenario: ${scenario.name} ===`);
  const project = fs.mkdtempSync(path.join(os.tmpdir(), "qa-selftest-"));

  try {
    copyTemplate(project);
    // Projects are git repositories; the architecture check lists files through git.
    execSync("git init -q", { cwd: project });

    run(
      `npx tsx .qa/scripts/setup.ts --answers ${path.join(ROOT, SELFTEST_DIR, scenario.answers)} --force`,
      project,
      { DATABASE_URL: scenario.plan ? "" : SELFTEST_DATABASE_URL },
    );

    for (const file of scenario.aiFiles.present) {
      assert(fs.existsSync(path.join(project, file)), `${file} is missing`);
    }
    for (const file of scenario.aiFiles.absent) {
      assert(!fs.existsSync(path.join(project, file)), `${file} is present`);
    }

    const env = fs.readFileSync(path.join(project, ".env"), "utf8");
    for (const line of [
      "TEST_ENV=selftest",
      ...(scenario.plan ? [] : [`DATABASE_URL=${SELFTEST_DATABASE_URL}`]),
    ]) {
      assert(env.includes(line), `setup did not write ${line} to .env`);
    }

    for (const leftover of [
      "src/app/api",
      "tests/api/create-task.spec.ts",
      ".qa/roundtrip",
    ]) {
      assert(
        !fs.existsSync(path.join(project, leftover)),
        `setup left reference path behind: ${leftover}`,
      );
    }

    // tests/ai holds the framework's own AI module tests.
    for (const directory of [
      "tests/api",
      "tests/smoke",
      "tests/accessibility",
    ]) {
      assert(
        !fs.existsSync(path.join(project, directory)),
        `setup installed ${directory}; first tests are written from the golden templates`,
      );
    }

    // setup removes .qa/selftest from projects, so fixtures come from the template.
    fs.copyFileSync(
      path.join(ROOT, SELFTEST_DIR, "selftest.env"),
      path.join(project, ".env"),
    );

    checkWorkflows(project, scenario.secrets);
    assertPlan(project, []);

    if (!scenario.plan) {
      run("npx tsx .qa/scripts/doctor.ts", project);

      addUserRole(project);
      run("npx tsx .qa/scripts/sync-ci-secrets.ts", project);
      checkWorkflows(project, [...ROLE_SECRETS, "DATABASE_URL"]);

      renderTemplates(project);
      run("npx prettier --write --log-level warn src config", project);
      staticChecks(project, false);
      return;
    }

    fs.cpSync(
      path.join(ROOT, SELFTEST_DIR, "tests"),
      path.join(project, "tests"),
      { recursive: true },
    );

    staticChecks(project, true);
    assertPlan(project, scenario.plan);
    run("npx tsx .qa/scripts/doctor.ts", project);

    if (scenario.needsBrowser && options.skipBrowser) {
      console.log("Skipping login tests: they need a browser.");
    } else {
      run("npx playwright test --grep @selftest --reporter=list", project);
    }
  } finally {
    if (options.keep) {
      console.log(`Self-test project kept at ${project}`);
    } else {
      fs.rmSync(project, { recursive: true, force: true });
    }
  }
}

async function main(): Promise<void> {
  const options = {
    keep: process.argv.includes("--keep"),
    skipBrowser: process.argv.includes("--skip-browser"),
  };
  const app: ChildProcess = spawn(
    "node",
    [path.join(ROOT, SELFTEST_DIR, "mock-app.mjs")],
    { stdio: "inherit" },
  );

  try {
    await waitForApp("http://localhost:4510");

    for (const scenario of SCENARIOS) {
      await runScenario(scenario, options);
    }

    console.log("\n✔ Template self-test passed");
  } finally {
    app.kill();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
