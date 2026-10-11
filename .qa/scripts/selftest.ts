import { execSync, spawn, type ChildProcess } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { parse } from "yaml";

const ROOT = path.resolve(__dirname, "../..");
const SELFTEST_DIR = ".qa/selftest";

function run(command: string, cwd: string): void {
  console.log(`\n$ ${command}`);
  execSync(command, { cwd, stdio: "inherit" });
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

// Validates the workflows setup installed: parseable YAML, secrets injected for
// each role, and the container image matching the installed Playwright version.
function checkWorkflows(project: string, expectedPlan: string[]): void {
  const read = (file: string) =>
    fs.readFileSync(path.join(project, file), "utf8");
  const playwrightVersion: string = JSON.parse(
    read("node_modules/@playwright/test/package.json"),
  ).version;
  const roleSecrets = ["USER_USERNAME", "USER_PASSWORD"];

  for (const file of [
    ".github/workflows/playwright.yml",
    ".github/workflows/performance.yml",
  ]) {
    assert(!read(file).includes("@qa:secrets"), `${file} still has a marker`);
  }

  const functional = parse(read(".github/workflows/playwright.yml"));
  assert(
    functional.jobs.tests.container.image ===
      `mcr.microsoft.com/playwright:v${playwrightVersion}-noble`,
    `tests container image does not match Playwright ${playwrightVersion}`,
  );

  const performance = parse(read(".github/workflows/performance.yml"));

  for (const env of [
    functional.jobs.tests.env,
    performance.jobs["browser-performance"].env,
  ]) {
    for (const secret of roleSecrets) {
      assert(
        env?.[secret] === `\${{ secrets.${secret} }}`,
        `workflow env is missing ${secret}`,
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

  const plan = execSync("npx tsx .qa/scripts/ci-plan.ts", {
    cwd: project,
    env: { ...process.env, TEST_ENV: "selftest", GITHUB_OUTPUT: "" },
  }).toString();
  assert(
    plan.includes(JSON.stringify(expectedPlan)),
    `unexpected CI plan: ${plan.trim()}`,
  );

  console.log("✔ generated workflows are valid");
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
  expectedPlan: string[];
  needsBrowser: boolean;
};

const SCENARIOS: Scenario[] = [
  {
    name: "full (API + browser)",
    answers: "answers.json",
    expectedPlan: ["api", "accessibility", "chromium"],
    needsBrowser: true,
  },
  {
    name: "API only",
    answers: "answers-api-only.json",
    expectedPlan: ["api"],
    needsBrowser: false,
  },
];

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
    );

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

    // setup removes .qa/selftest from projects, so fixtures come from the template.
    fs.copyFileSync(
      path.join(ROOT, SELFTEST_DIR, "selftest.env"),
      path.join(project, ".env"),
    );

    run("npx prettier --check .", project);
    run("npx tsc --noEmit", project);
    run("npx tsx .qa/scripts/architecture.ts", project);
    run("npx tsx .qa/scripts/templates.ts check", project);
    run("npx playwright test --list", project);
    checkWorkflows(project, scenario.expectedPlan);

    run("npx tsx .qa/scripts/doctor.ts", project);

    if (scenario.needsBrowser && options.skipBrowser) {
      console.log("Skipping starter tests: they need a browser.");
    } else {
      run("npx playwright test --grep @starter --reporter=list", project);
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
