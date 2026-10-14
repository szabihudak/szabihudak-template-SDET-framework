import { execSync, spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { cdTarget, nextSteps, type Onboarding } from "./next-steps";
import { readEnvValues } from "./onboarding";

// Stage 2 of the installer (npm run onboard) and the installer's stage
// output, driven the way a person uses them: on a pseudo-terminal, with
// keystrokes sent once the expected prompt is on screen. Runs in a project
// created by setup; every file it touches is restored afterwards.

const ENTER = "\r";
const RIGHT = "\x1b[C";
const PASSWORD = "Pa55#word with 'quotes' $HOME";

type Step = { expect: string; send: string };
type Run = { output: string; raw: string; code: number | null };

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`Self-test failed (onboarding): ${message}`);
}

const plain = (text: string) =>
  text
    .replace(/\x1b\[[0-9;?]*[ -/]*[@-~]/g, "")
    .replace(/\r/g, "")
    .replace(/[ \t]+/g, " ");

// Color codes (SGR); cursor movement from the prompts is not color.
const COLOR_CODE = /\x1b\[[0-9;]*m/;
const EMOJI = /[\u2705\u23ed\u274c\u{1f449}\u{1f680}\u{1f918}\u{1f9ea}]/u;
// The installer decides on emoji from the locale name alone.
const UTF8_LOCALE = process.platform === "darwin" ? "en_US.UTF-8" : "C.UTF-8";

const shellQuote = (value: string) => `'${value.replace(/'/g, "'\\''")}'`;

// util-linux script on Linux, BSD script on macOS. A wide terminal keeps the
// prompts on one line each.
function terminalCommand(command: string): [string, string[]] {
  const inner = `stty cols 160 rows 50; ${command}`;

  return process.platform === "darwin"
    ? ["script", ["-q", "/dev/null", "sh", "-c", inner]]
    : ["script", ["-qefc", inner, "/dev/null"]];
}

async function interact(
  command: string,
  cwd: string,
  steps: Step[],
  env: NodeJS.ProcessEnv = {},
): Promise<Run> {
  const [file, args] = terminalCommand(command);
  const child = spawn(file, args, {
    cwd,
    env: { ...process.env, CI: "", NO_COLOR: "1", ...env },
    stdio: ["pipe", "pipe", "pipe"],
  });
  let output = "";
  const exited = new Promise<number | null>((resolve) =>
    child.on("close", resolve),
  );

  child.stdout.on("data", (chunk: Buffer) => (output += chunk.toString()));
  child.stderr.on("data", (chunk: Buffer) => (output += chunk.toString()));

  let seen = 0;
  for (const step of steps) {
    const deadline = Date.now() + 60_000;
    let index = -1;

    while ((index = plain(output).indexOf(step.expect, seen)) === -1) {
      assert(
        Date.now() < deadline && child.exitCode === null,
        `"${step.expect}" did not appear. Output:\n${plain(output)}`,
      );
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    seen = index + step.expect.length;
    // Let the prompt finish rendering before typing into it.
    await new Promise((resolve) => setTimeout(resolve, 300));
    child.stdin.write(step.send);
  }

  const timeout = setTimeout(() => child.kill(), 120_000);
  const code = await exited;
  clearTimeout(timeout);
  child.stdin.end();

  return { output: plain(output), raw: output, code };
}

const onboard = "npx tsx framework/tools/onboard.ts";

function snapshot(project: string, files: string[]): () => void {
  const saved = files.map((file) => {
    const target = path.join(project, file);
    return [
      target,
      fs.existsSync(target) ? fs.readFileSync(target) : null,
    ] as const;
  });

  return () => {
    for (const [target, content] of saved) {
      if (content === null) fs.rmSync(target, { force: true });
      else fs.writeFileSync(target, content);
    }
  };
}

function read(project: string, file: string): string {
  return fs.readFileSync(path.join(project, file), "utf8");
}

function resultOf(file: string): string {
  const result = fs.readFileSync(file, "utf8");
  fs.rmSync(file);
  return result;
}

// Every file except .env and node_modules: the password must not be in any.
function filesContaining(root: string, text: string): string[] {
  const found: string[] = [];

  const walk = (directory: string) => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const target = path.join(directory, entry.name);
      if (entry.name === "node_modules" || entry.name === ".git") continue;
      if (entry.isDirectory()) walk(target);
      else if (
        entry.isFile() &&
        target !== path.join(root, ".env") &&
        fs.readFileSync(target, "utf8").includes(text)
      ) {
        found.push(path.relative(root, target));
      }
    }
  };

  walk(root);
  return found;
}

async function checkSkip(project: string, result: string): Promise<void> {
  const before = [".env", ".env.example", "config/framework.config.ts"].map(
    (file) => read(project, file),
  );
  const run = await interact(
    onboard,
    project,
    [
      {
        expect: "Set up the test account for the first tests now?",
        send: RIGHT + ENTER,
      },
    ],
    { QA_ONBOARD_RESULT: result },
  );

  assert(run.code === 0, `skipping exited with ${run.code}`);
  assert(resultOf(result) === "skipped", "skipping did not report skipped");
  assert(
    run.output.includes("npm run onboard"),
    "skipping did not say how to run it later",
  );
  assert(
    [".env", ".env.example", "config/framework.config.ts"].every(
      (file, index) => read(project, file) === before[index],
    ),
    "skipping changed a file",
  );
  console.log(
    "✔ onboarding: Skip changes nothing and says how to run it later",
  );
}

async function checkIncomplete(project: string, result: string): Promise<void> {
  const run = await interact(
    onboard,
    project,
    [
      {
        expect: "Set up the test account for the first tests now?",
        send: ENTER,
      },
      { expect: "username or email", send: `qa-user@example.com${ENTER}` },
      { expect: "password", send: ENTER },
    ],
    { QA_ONBOARD_RESULT: result },
  );

  assert(run.code === 0, `the incomplete run exited with ${run.code}`);
  assert(
    resultOf(result) === "incomplete",
    "an empty password did not report incomplete",
  );
  assert(
    run.output.includes("Still empty in .env: USER_PASSWORD"),
    "the missing password was not named",
  );

  const env = readEnvValues(path.join(project, ".env"));
  assert(env.USER_USERNAME === "qa-user@example.com", ".env has no username");
  assert(!env.USER_PASSWORD, ".env has a password nobody entered");
  assert(
    /roles: \{\s*user: \{ usernameEnv: "USER_USERNAME", passwordEnv: "USER_PASSWORD" \},?\s*\}/.test(
      read(project, "config/framework.config.ts"),
    ),
    "the user role was not added to config/framework.config.ts",
  );
  execSync("npx prettier --check config/framework.config.ts", {
    cwd: project,
    stdio: "pipe",
  });
  assert(
    /^USER_USERNAME=$/m.test(read(project, ".env.example")) &&
      /^USER_PASSWORD=$/m.test(read(project, ".env.example")),
    ".env.example does not list the role with empty values",
  );
  assert(
    read(project, ".github/workflows/playwright.yml").includes(
      "USER_PASSWORD: ${{ secrets.USER_PASSWORD }}",
    ),
    "the CI workflow does not receive the role secrets",
  );
  console.log(
    "✔ onboarding: an empty password reports incomplete; the role is added, values only in .env",
  );
}

async function checkRerun(project: string, result: string): Promise<void> {
  const config = read(project, "config/framework.config.ts");
  const run = await interact(
    onboard,
    project,
    [
      { expect: 'test account for "user" now?', send: ENTER },
      { expect: "leave empty to keep the current one", send: ENTER },
      { expect: "password", send: `${PASSWORD}${ENTER}` },
    ],
    { QA_ONBOARD_RESULT: result },
  );

  assert(run.code === 0, `the rerun exited with ${run.code}`);
  assert(resultOf(result) === "done", "a complete account did not report done");

  const env = readEnvValues(path.join(project, ".env"));
  assert(
    env.USER_USERNAME === "qa-user@example.com",
    "the rerun did not keep the username",
  );
  assert(
    env.USER_PASSWORD === PASSWORD,
    "the password did not read back unchanged from .env",
  );
  assert(!run.output.includes(PASSWORD), "the password was shown on screen");
  assert(
    read(project, "config/framework.config.ts") === config,
    "the rerun changed the config",
  );

  const leaks = filesContaining(project, PASSWORD);
  assert(
    leaks.length === 0,
    `the password is outside .env, in ${leaks.join(", ")}`,
  );
  assert(
    execSync("git check-ignore .env", { cwd: project }).toString().trim() ===
      ".env",
    ".env is not git-ignored",
  );
  console.log(
    "✔ onboarding: a rerun keeps the username, masks the password and writes it only to .env",
  );
}

async function checkUnattended(project: string, result: string): Promise<void> {
  const config = read(project, "config/framework.config.ts");

  for (const env of [{ CI: "true" }, { QA_NONINTERACTIVE: "1" }]) {
    // A terminal is present, so only the variable keeps it from asking.
    const run = await interact(onboard, project, [], {
      ...env,
      QA_ONBOARD_RESULT: result,
    });

    assert(run.code === 0, `the unattended run exited with ${run.code}`);
    assert(
      resultOf(result) === "skipped",
      "the unattended run did not report skipped",
    );
    assert(
      !run.output.includes("Set up the test account"),
      `it prompted with ${Object.keys(env)[0]} set`,
    );
  }

  assert(
    read(project, "config/framework.config.ts") === config,
    "the unattended run changed the config",
  );
  console.log("✔ onboarding: CI and --answers runs never prompt");
}

// npm ci and the browser download are replaced; doctor and onboard run for real.
function stubTools(project: string): string {
  const bin = fs.mkdtempSync(path.join(os.tmpdir(), "qa-selftest-bin-"));
  const npm = execSync("command -v npm").toString().trim();
  const npx = execSync("command -v npx").toString().trim();
  const npmVersion = JSON.parse(
    read(project, "package.json"),
  ).packageManager.split("@")[1];

  fs.writeFileSync(
    path.join(bin, "npm"),
    `#!/usr/bin/env bash
if [ "$1" = -v ]; then echo ${npmVersion}; exit 0; fi
if [ "$1" = run ]; then exec ${shellQuote(npm)} "$@"; fi
echo "[stub] npm $*"
`,
    { mode: 0o755 },
  );
  fs.writeFileSync(
    path.join(bin, "npx"),
    `#!/usr/bin/env bash
if [ "$1" = playwright ]; then echo "[stub] npx $*"; exit 0; fi
exec ${shellQuote(npx)} "$@"
`,
    { mode: 0o755 },
  );

  return bin;
}

// The closing steps with and without MCP servers, with stage 2 done or skipped.
function checkNextSteps(): void {
  const cases = [
    {
      mcp: ["playwright", "openapi"],
      expected: [
        "code .",
        "Start the MCP servers when VS Code asks (playwright, openapi)",
        "Copilot Chat -> select the test-planner agent",
      ],
      absent: [],
    },
    {
      mcp: [],
      expected: ["code .", "Copilot Chat -> select the test-planner agent"],
      absent: ["Start the MCP servers"],
    },
  ];

  for (const { mcp, expected, absent } of cases) {
    for (const onboarding of ["skipped", "done"] as Onboarding[]) {
      const steps = nextSteps({
        mcp,
        onboarding,
        doctorOk: true,
        cd: "../my-project",
      });
      const text = steps.join("\n");
      const label = `MCP ${JSON.stringify(mcp)} with stage 2 ${onboarding}`;

      assert(
        steps[1] === "   1. cd ../my-project",
        `${label}: the first step is not cd:\n${text}`,
      );
      assert(
        text.includes("2. npm run onboard") === (onboarding === "skipped"),
        `${label}: npm run onboard ${onboarding === "skipped" ? "is not step 2" : "is listed"}:\n${text}`,
      );
      for (const line of expected) {
        assert(text.includes(line), `${label}: "${line}" is missing:\n${text}`);
      }
      for (const line of absent) {
        assert(!text.includes(line), `${label}: "${line}" is listed:\n${text}`);
      }
    }
  }

  const failed = nextSteps({
    mcp: [],
    onboarding: "incomplete",
    doctorOk: false,
  }).join("\n");
  assert(
    failed.includes("1. Fix what npm run doctor reported") &&
      failed.includes("2. Fill in the empty values in .env") &&
      !failed.includes("Start the MCP servers") &&
      !failed.includes("cd "),
    `a failed doctor and an incomplete account are not the first steps:\n${failed}`,
  );
  const categories = nextSteps({
    mcp: [],
    testScripts: ["test:api", "test:chromium"],
    onboarding: "done",
    doctorOk: true,
  }).join("\n");
  assert(
    categories.includes("Run one test category: npm run <script>") &&
      categories.includes("test:api, test:chromium"),
    `the next steps do not name the category scripts:\n${categories}`,
  );

  for (const [start, project, expected] of [
    ["/work/template", "/work/my-tests", "../my-tests"],
    ["/work", "/work/my-tests", "my-tests"],
    ["/home/qa", "/work/projects/my-tests", "/work/projects/my-tests"],
    ["/home/qa", "/work/my tests", '"/work/my tests"'],
    ["/work/my-tests", "/work/my-tests", undefined],
  ] as const) {
    const target = cdTarget(start, project);
    assert(
      target === expected,
      `from ${start} to ${project} the cd step is ${target}, not ${expected}`,
    );
  }

  console.log(
    "✔ installer: next steps for the Copilot agents, with and without MCP servers, with stage 2 done, skipped or incomplete; cd by project name next to the template, else the absolute path",
  );
}

async function checkInstaller(project: string): Promise<void> {
  const bin = stubTools(project);
  const env = { PATH: `${bin}:${process.env.PATH}` };

  try {
    const terminal = await interact(
      "bash install.sh",
      project,
      [
        {
          expect: "Set up the test account for the first tests now?",
          send: RIGHT + ENTER,
        },
      ],
      { ...env, NO_COLOR: "", TERM: "xterm-256color", LC_ALL: UTF8_LOCALE },
    );

    assert(
      terminal.code === 0,
      `install.sh exited with ${terminal.code}:\n${terminal.output}`,
    );
    for (const expected of [
      "| STAGE 1 | | STAGE 2 (optional) |",
      "[>] Stage 1: Framework setup ====> [ ] Stage 2: First tests (optional)",
      "| [x] project | -> | [x] install | -> | [x] browsers | -> | doctor |",
      "[x] Stage 1: Framework setup ====> [>] Stage 2: First tests (optional)",
      " INSTALLER | NEXT: IN YOUR IDE",
      "| test account | | | test-planner | -> | review & run |",
      "🚀 STAGE 1 - Framework setup",
      "🧪 STAGE 2 - First tests (optional)",
      "✅ Stage 1 Framework setup done",
      "⏭️ Stage 2 First tests skipped -> run: npm run onboard",
      "🤘\n +=====",
      "| [x] INSTALLER FINISHED |",
      '| "Program testing can show the presence |',
      '| of bugs, never their absence." |',
      "| - Dijkstra |",
      "👉 The installer is done. Continue in your IDE:",
      "1. npm run onboard (adds the test account to .env)",
      "Copilot Chat -> select the test-planner agent",
    ]) {
      assert(
        terminal.output.includes(expected),
        `install.sh did not show "${expected}":\n${terminal.output}`,
      );
    }
    assert(
      /\+=+\+ +\+-+\+/.test(terminal.output),
      "install.sh did not highlight the current step",
    );
    for (const [code, what] of [
      ["\x1b[1;36mSTAGE 1 - Framework setup", "the stage title in bold cyan"],
      ["\x1b[33m(optional)", "optional in yellow"],
      ["\x1b[32m[x]", "finished steps in green"],
      ["\x1b[2mNEXT: IN YOUR IDE", "the IDE side dimmed"],
      ["\x1b[32m+=====", "the finish box border in green"],
      ["\x1b[1m [x] INSTALLER FINISHED", "the finish title in bold"],
      ['\x1b[2;3m "Program testing', "the quote dim and italic"],
    ]) {
      assert(
        terminal.raw.replace(/[ \t]+/g, " ").includes(code),
        `install.sh did not show ${what}`,
      );
    }

    const filled = await interact(
      "bash install.sh",
      project,
      [
        {
          expect: "Set up the test account for the first tests now?",
          send: ENTER,
        },
        { expect: "username or email", send: `qa-user@example.com${ENTER}` },
        { expect: "password", send: `${PASSWORD}${ENTER}` },
      ],
      // NO_COLOR is set; LC_ALL=C cannot show emoji.
      { ...env, TERM: "xterm-256color", LC_ALL: "C" },
    );

    assert(
      filled.code === 0,
      `install.sh with a test account exited with ${filled.code}:\n${filled.output}`,
    );
    for (const expected of [
      // The test-planner agent relies on this doctor line to find the account in .env.
      '✔ credentials for role "user" are set',
      "| [x] test account | | | test-planner | -> | review & run |",
      ">> STAGE 2 - First tests (optional)",
      "[x] Stage 1 Framework setup done",
      "[x] Stage 2 First tests test account in .env -> next: test-planner",
      "\\m/\n +=====",
      "| [x] INSTALLER FINISHED |",
      "-> The installer is done. Continue in your IDE:",
      "1. code . (opens the project in VS Code)",
    ]) {
      assert(
        filled.output.includes(expected),
        `install.sh with a test account did not show "${expected}":\n${filled.output}`,
      );
    }
    assert(
      !filled.output.includes("npm run onboard (adds"),
      "install.sh asked for npm run onboard after the account was entered",
    );
    assert(!filled.output.includes(PASSWORD), "install.sh showed the password");
    assert(
      !COLOR_CODE.test(filled.raw),
      "install.sh printed color codes with NO_COLOR set",
    );
    assert(
      !EMOJI.test(filled.raw),
      "install.sh printed emoji where the locale cannot show them",
    );

    const unattended = execSync("bash install.sh < /dev/null 2>&1", {
      cwd: project,
      env: {
        ...process.env,
        ...env,
        NO_COLOR: "",
        TERM: "xterm-256color",
        LC_ALL: UTF8_LOCALE,
      },
    }).toString();

    assert(
      unattended.includes("=== Stage 2: First tests (optional) ==="),
      "install.sh without a terminal did not name the stages",
    );
    assert(
      /\[-\] Stage 2\s+First tests\s+skipped -> run: npm run onboard/.test(
        unattended,
      ),
      "install.sh without a terminal printed no summary",
    );
    assert(
      !unattended.includes("+===") &&
        !unattended.includes("STAGE 1") &&
        !unattended.includes("NEXT: IN YOUR IDE"),
      "install.sh drew the stage figures without a terminal",
    );
    assert(
      !unattended.includes("INSTALLER FINISHED") &&
        !unattended.includes("Dijkstra"),
      "install.sh drew the finish box without a terminal",
    );
    assert(
      /Continue in your IDE:\n\s+1\. npm run onboard/.test(unattended),
      "install.sh without a terminal did not list the next steps",
    );
    assert(
      !unattended.includes("Set up the test account"),
      "install.sh prompted without a terminal",
    );
    assert(
      !unattended.includes("\x1b") && !EMOJI.test(unattended),
      "install.sh printed color codes or emoji without a terminal",
    );
    console.log(
      "✔ installer: stage overview, split stage 2 flow, colors, emoji (ASCII without UTF-8), finish box and next steps on a terminal; no colors with NO_COLOR; plain text without a terminal",
    );
  } finally {
    fs.rmSync(bin, { recursive: true, force: true });
  }
}

export async function checkOnboardingFlows(project: string): Promise<void> {
  const restore = snapshot(project, [
    ".env",
    ".env.example",
    "config/framework.config.ts",
    ".github/workflows/playwright.yml",
    ".github/workflows/performance.yml",
  ]);
  const result = path.join(os.tmpdir(), `qa-selftest-onboard-${process.pid}`);

  try {
    fs.copyFileSync(
      path.join(project, ".env.example"),
      path.join(project, ".env"),
    );
    await checkUnattended(project, result);
    await checkSkip(project, result);
    await checkIncomplete(project, result);
    await checkRerun(project, result);
  } finally {
    restore();
    fs.rmSync(result, { force: true });
  }

  checkNextSteps();

  try {
    await checkInstaller(project);
  } finally {
    restore();
  }
}
