import { execSync, spawn, type ChildProcess } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

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

async function main(): Promise<void> {
  const keep = process.argv.includes("--keep");
  const skipBrowser = process.argv.includes("--skip-browser");
  const project = fs.mkdtempSync(path.join(os.tmpdir(), "qa-selftest-"));
  let app: ChildProcess | undefined;

  try {
    copyTemplate(project);

    run(
      `npx tsx .qa/scripts/setup.ts --answers ${SELFTEST_DIR}/answers.json --force`,
      project,
    );

    for (const leftover of ["src/app/api", "tests/api", ".qa/roundtrip"]) {
      if (fs.existsSync(path.join(project, leftover))) {
        throw new Error(`setup left example path behind: ${leftover}`);
      }
    }

    fs.copyFileSync(
      path.join(project, SELFTEST_DIR, "selftest.env"),
      path.join(project, ".env"),
    );

    run("npx prettier --check .", project);
    run("npx tsc --noEmit", project);
    run("npx tsx .qa/scripts/templates.ts check", project);
    run("npx playwright test --list", project);

    app = spawn("node", [path.join(SELFTEST_DIR, "mock-app.mjs")], {
      cwd: project,
      stdio: "inherit",
    });
    await waitForApp("http://localhost:4510");

    run("npx tsx .qa/scripts/doctor.ts", project);

    if (!skipBrowser) {
      run("npx playwright test --grep @starter --reporter=list", project);
    }

    console.log("\n✔ Template self-test passed");
  } finally {
    app?.kill();

    if (keep) {
      console.log(`Self-test project kept at ${project}`);
    } else {
      fs.rmSync(project, { recursive: true, force: true });
    }
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
