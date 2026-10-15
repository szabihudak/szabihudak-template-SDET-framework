import {
  execSync,
  spawn,
  spawnSync,
  type ChildProcess,
} from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { parse } from "yaml";

import { readProjectState } from "./next-steps";
import {
  addRoleToConfig,
  addRoleToEnvExample,
  quoteEnvValue,
  readEnvValues,
  setEnvValues,
} from "./onboarding";
import { checkOnboardingFlows } from "./selftest-onboarding";

const ROOT = path.resolve(__dirname, "../..");
const SELFTEST_DIR = "framework/setup/selftest";

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
  return execSync("npx tsx framework/tools/ci-plan.ts", {
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

  const workflows: [string, Record<string, string>][] = [
    [".github/workflows/playwright.yml", functional.jobs.tests.env],
  ];

  // Installed only with the performance module.
  if (fs.existsSync(path.join(project, ".github/workflows/performance.yml"))) {
    const performance = parse(read(".github/workflows/performance.yml"));
    const browserPerformanceEnv = performance.jobs["browser-performance"].env;
    assert(
      browserPerformanceEnv?.TEST_ENV === "${{ inputs.environment }}",
      "browser-performance job does not select TEST_ENV",
    );
    workflows.push([
      ".github/workflows/performance.yml",
      browserPerformanceEnv,
    ]);
  }

  for (const [file, env] of workflows) {
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

  console.log(
    `✔ generated workflows are valid (secrets: ${expectedSecrets.join(", ") || "none"})`,
  );
}

// The project holds the framework, its own application layer and nothing of
// the UPEX reference implementation or the template tooling.
function checkProjectFiles(project: string, scenario: Scenario): void {
  const exists = (file: string) => fs.existsSync(path.join(project, file));

  for (const file of [
    "framework/core/fixtures/framework-fixtures.ts",
    "framework/templates/README.md",
    "framework/templates/index.json",
    "framework/tools/doctor.ts",
    "framework/docs/TESTING_STANDARDS.md",
    "src/fixtures/test-fixtures.ts",
    "config/approved-examples.json",
    "AGENTS.md",
    "install.sh",
    ".github/copilot-instructions.md",
  ]) {
    assert(exists(file), `${file} is missing`);
  }

  for (const file of [
    "src/api/clients/TaskApiClient.ts",
    "tests/api/create-task.spec.ts",
    "framework/setup",
    "framework/tools/setup.ts",
    "framework/tools/selftest.ts",
    "framework/templates/roundtrip",
    "framework/docs/portfolio",
    ".github/workflows/ghcr-cleanup.yml",
    "Dockerfile",
    "docker-compose.yml",
    ...REMOVED_AI_FILES,
  ]) {
    assert(!exists(file), `${file} must not be in a project`);
  }

  // Playwright MCP only with browser tests, OpenAPI MCP when a contract URL is
  // set; the installer's next steps name the same servers.
  const servers = readProjectState(project).mcp.sort();
  assert(
    servers.join() === scenario.mcpServers.join(),
    `.vscode/mcp.json has ${servers.join(", ") || "no servers"}, expected ${scenario.mcpServers.join(", ")}`,
  );

  const config = fs.readFileSync(
    path.join(project, "config/framework.config.ts"),
    "utf8",
  );
  const environmentConfig = JSON.parse(
    fs.readFileSync(
      path.join(project, "config/environments/environments.json"),
      "utf8",
    ),
  );
  assert(
    environmentConfig.selftest.allow.interactiveDiscovery ===
      scenario.interactiveDiscovery,
    `environments.json does not persist interactiveDiscovery=${scenario.interactiveDiscovery}`,
  );
  if (scenario.requirementsDoc) {
    assert(
      config.includes(`requirementsDoc: "${scenario.requirementsDoc}"`),
      `framework.config.ts does not persist requirementsDoc=${scenario.requirementsDoc}`,
    );
  }

  // Folder skeleton for the enabled test types, without any spec yet.
  const specs = fs.existsSync(path.join(project, "tests"))
    ? fs
        .readdirSync(path.join(project, "tests"), { recursive: true })
        .filter((file) => String(file).endsWith(".spec.ts"))
    : [];
  assert(specs.length === 0, `setup installed specs: ${specs.join(", ")}`);
  assert(
    exists("tests/api/README.md") && exists("src/api/clients/README.md"),
    "the API folder skeleton is missing",
  );
  assert(
    exists("tests/ui/README.md") === config.includes("ui: true"),
    "the UI folder skeleton does not follow the ui module",
  );
  assert(
    exists(".github/workflows/performance.yml") ===
      config.includes("performance: true"),
    "the performance workflow does not follow the performance module",
  );

  const packageJson = JSON.parse(
    fs.readFileSync(path.join(project, "package.json"), "utf8"),
  );
  assert(
    !packageJson.scripts.setup && !packageJson.scripts["qa:selftest"],
    "package.json still has template-only scripts",
  );

  // The Lighthouse packages and runner come only with the performance module,
  // and the lockfile follows package.json so npm ci accepts it.
  const performance = config.includes("performance: true");
  const lock = JSON.parse(
    fs.readFileSync(path.join(project, "package-lock.json"), "utf8"),
  );
  for (const name of PERFORMANCE_PACKAGES) {
    assert(
      name in packageJson.devDependencies === performance &&
        `node_modules/${name}` in lock.packages === performance,
      `${name} does not follow the performance module`,
    );
  }
  assert(
    JSON.stringify(lock.packages[""].devDependencies) ===
      JSON.stringify(packageJson.devDependencies),
    "package-lock.json does not match the devDependencies in package.json",
  );
  assert(
    exists("framework/core/performance/lighthouse") === performance,
    "the Lighthouse runner does not follow the performance module",
  );
  assert(
    fs
      .readFileSync(path.join(project, "README.md"), "utf8")
      .startsWith(`# ${packageJson.name}`),
    "README.md does not describe the project",
  );

  const env = fs.readFileSync(path.join(project, ".env"), "utf8");
  for (const line of [
    "TEST_ENV=selftest",
    ...(scenario.plan ? [] : [`DATABASE_URL=${SELFTEST_DATABASE_URL}`]),
  ]) {
    assert(env.includes(line), `setup did not write ${line} to .env`);
  }

  console.log("✔ project contains only project files");
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
  } = JSON.parse(
    fs.readFileSync(path.join(ROOT, "framework/templates/index.json"), "utf8"),
  );
  const replaceTokens = (text: string) =>
    Object.entries(RENDER_VALUES).reduce(
      (result, [token, value]) => result.replaceAll(token, value),
      text,
    );

  for (const id of RENDERED_TEMPLATES) {
    const entry = index.templates.find((template) => template.id === id);
    assert(entry, `template ${id} is not in framework/templates/index.json`);

    const source = fs
      .readFileSync(path.join(ROOT, entry.template), "utf8")
      .replace(/^[ \t]*\/\/ @template\b.*(?:\r?\n|$)/gm, "");
    const output = path.join(project, replaceTokens(entry.output));

    fs.mkdirSync(path.dirname(output), { recursive: true });
    fs.writeFileSync(output, replaceTokens(source));
  }

  console.log(`✔ rendered ${RENDERED_TEMPLATES.length} golden templates`);
}

// Values npm run onboard writes must read back unchanged from .env.
function checkEnvQuoting(): void {
  const envFile = path.join(os.tmpdir(), `qa-selftest-env-${process.pid}`);
  const values = {
    USER_USERNAME: "qa+user@example.com",
    USER_PASSWORD: `p#ss w'rd"$HOME`,
  };
  try {
    fs.writeFileSync(envFile, "TEST_ENV=staging\nUSER_USERNAME=\n");
    assert(
      setEnvValues(envFile, values).length === 0,
      "setEnvValues rejected a quotable value",
    );
    const written = readEnvValues(envFile);
    assert(
      written.TEST_ENV === "staging" &&
        Object.entries(values).every(
          ([name, value]) => written[name] === value,
        ),
      ".env values did not read back unchanged",
    );
  } finally {
    fs.rmSync(envFile, { force: true });
  }
  assert(
    quoteEnvValue("line\nbreak") === undefined,
    "a line break was accepted",
  );
}

// Login is configured after setup; adding a role and synchronising the CI
// secrets is the step a project takes once its accounts exist (npm run
// onboard does the same).
function addUserRole(project: string): void {
  assert(
    addRoleToConfig(path.join(project, "config/framework.config.ts")),
    "generated config has no empty roles object",
  );
  addRoleToEnvExample(path.join(project, ".env.example"));
  assert(
    /^USER_USERNAME=$/m.test(
      fs.readFileSync(path.join(project, ".env.example"), "utf8"),
    ),
    ".env.example does not list the user role",
  );
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
  // Transforms a copy of the template instead of creating a new folder.
  inPlace: boolean;
  // MCP servers .vscode/mcp.json must list, sorted.
  mcpServers: string[];
  interactiveDiscovery: boolean;
  requirementsDoc?: string;
  // Category scripts setup adds for the enabled modules and browsers, and the
  // ones that list self-test specs once the tests are in place.
  testScripts: { all: string[]; withTests: string[] };
};

const PERFORMANCE_PACKAGES = ["@lhci/cli", "chrome-launcher", "lighthouse"];
const ROLE_SECRETS = ["USER_USERNAME", "USER_PASSWORD"];
// AI files setup no longer installs: the earlier Claude Code and /first-tests
// setup, and the Copilot agent pipeline (ADR-010; examples/copilot-agents).
const REMOVED_AI_FILES = [
  "CLAUDE.md",
  ".claude",
  ".mcp.json",
  ".github/prompts",
  ".github/agents",
  "framework/prompts",
  "framework/tools/plan.ts",
  "framework/tools/pipeline.ts",
  "examples",
];
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
    inPlace: false,
    mcpServers: ["playwright"],
    interactiveDiscovery: false,
    testScripts: {
      all: [
        "test:api",
        "test:database",
        "test:accessibility",
        "test:ui",
        "test:smoke",
        "test:chromium",
      ],
      withTests: [],
    },
  },
  {
    name: "login configured (API + browser)",
    answers: "answers.json",
    secrets: ROLE_SECRETS,
    plan: ["api", "accessibility", "chromium"],
    needsBrowser: true,
    inPlace: false,
    mcpServers: ["openapi", "playwright"],
    interactiveDiscovery: true,
    requirementsDoc: "docs/acceptance-criteria.md",
    testScripts: {
      all: [
        "test:api",
        "test:accessibility",
        "test:performance",
        "test:ui",
        "test:smoke",
        "test:chromium",
      ],
      withTests: [
        "test:api",
        "test:accessibility",
        "test:smoke",
        "test:chromium",
      ],
    },
  },
  {
    name: "login configured (API only)",
    answers: "answers-api-only.json",
    secrets: ROLE_SECRETS,
    plan: ["api"],
    needsBrowser: false,
    inPlace: true,
    mcpServers: ["openapi"],
    interactiveDiscovery: true,
    testScripts: { all: ["test:api"], withTests: ["test:api"] },
  },
];

const GENERAL_TEST_SCRIPTS = ["test", "test:list", "test:headed", "test:debug"];

// Setup adds a script per enabled category next to the general test scripts,
// and the installer's next steps name them.
function checkTestScripts(project: string, scenario: Scenario): void {
  const scripts: Record<string, string> = JSON.parse(
    fs.readFileSync(path.join(project, "package.json"), "utf8"),
  ).scripts;
  const testNames = Object.keys(scripts).filter((name) =>
    name.startsWith("test"),
  );
  const expected = [...GENERAL_TEST_SCRIPTS, ...scenario.testScripts.all];

  assert(
    JSON.stringify(testNames) === JSON.stringify(expected),
    `package.json has the test scripts ${JSON.stringify(testNames)}, expected ${JSON.stringify(expected)}`,
  );
  assert(
    JSON.stringify(readProjectState(project).testScripts) ===
      JSON.stringify(scenario.testScripts.all),
    "the next steps do not list the category scripts",
  );
  console.log(`✔ test scripts: ${scenario.testScripts.all.join(", ")}`);
}

// Every category script selects an existing project or folder: Playwright
// rejects an unknown project. Categories with self-test specs list them.
function listTestScripts(project: string, scenario: Scenario): void {
  for (const script of scenario.testScripts.all) {
    const output = execSync(
      `npm run --silent ${script} -- --list --pass-with-no-tests`,
      { cwd: project, env: { ...process.env, TEST_ENV: "selftest" } },
    ).toString();
    const total = Number(/Total: (\d+) tests?/.exec(output)?.[1] ?? 0);

    assert(
      total > 0 === scenario.testScripts.withTests.includes(script),
      `npm run ${script} lists ${total} tests:\n${output}`,
    );
  }
  console.log(
    `✔ test scripts select their tests (${scenario.testScripts.withTests.join(", ")})`,
  );
}

function staticChecks(project: string, hasTests: boolean): void {
  run("npx prettier --check .", project);
  run("npx tsc --noEmit", project);
  run("npx tsx framework/tools/architecture.ts", project);
  run("npx tsx framework/tools/templates.ts check", project);
  if (hasTests) run("npx playwright test --list", project);
}

async function runScenario(
  scenario: Scenario,
  options: { keep: boolean; skipBrowser: boolean },
): Promise<void> {
  console.log(`\n=== Scenario: ${scenario.name} ===`);
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), "qa-selftest-"));
  const project = scenario.inPlace
    ? workspace
    : path.join(workspace, "project");
  const answers = path.join(ROOT, SELFTEST_DIR, scenario.answers);
  // CI runners have no git identity; setup commits the new project with it.
  const env = {
    DATABASE_URL: scenario.plan ? "" : SELFTEST_DATABASE_URL,
    GIT_AUTHOR_NAME: "Template Self-Test",
    GIT_AUTHOR_EMAIL: "selftest@example.com",
    GIT_COMMITTER_NAME: "Template Self-Test",
    GIT_COMMITTER_EMAIL: "selftest@example.com",
  };

  try {
    if (scenario.inPlace) {
      copyTemplate(project);
      // Projects are git repositories; the architecture check lists files through git.
      execSync("git init -q", { cwd: project });
      run(
        `npx tsx framework/tools/setup.ts --answers ${answers} --in-place --force`,
        project,
        env,
      );
    } else {
      // The template itself must stay untouched.
      const before = execSync("git status --porcelain", {
        cwd: ROOT,
      }).toString();
      run(
        `npx tsx framework/tools/setup.ts --answers ${answers} --target ${project}`,
        ROOT,
        env,
      );
      assert(
        execSync("git status --porcelain", { cwd: ROOT }).toString() === before,
        "setup changed the template folder",
      );
      assert(
        execSync("git log --oneline", { cwd: project }).toString().trim(),
        "the new project has no initial commit",
      );
      fs.symlinkSync(
        path.join(ROOT, "node_modules"),
        path.join(project, "node_modules"),
      );
    }

    checkProjectFiles(project, scenario);
    checkTestScripts(project, scenario);

    // setup removes framework/setup/selftest from projects, so fixtures come from the template.
    fs.copyFileSync(
      path.join(ROOT, SELFTEST_DIR, "selftest.env"),
      path.join(project, ".env"),
    );

    checkWorkflows(project, scenario.secrets);
    assertPlan(project, []);

    if (!scenario.plan) {
      run("npx tsx framework/tools/doctor.ts", project);

      checkEnvQuoting();
      await checkOnboardingFlows(project);
      addUserRole(project);
      run("npx tsx framework/tools/sync-ci-secrets.ts", project);
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
    listTestScripts(project, scenario);
    assertPlan(project, scenario.plan);
    run("npx tsx framework/tools/doctor.ts", project);

    if (scenario.needsBrowser && options.skipBrowser) {
      console.log("Skipping login tests: they need a browser.");
    } else {
      run("npx playwright test --grep @selftest --reporter=list", project);
    }
  } finally {
    if (options.keep) {
      console.log(`Self-test project kept at ${project}`);
    } else {
      fs.rmSync(workspace, { recursive: true, force: true });
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
