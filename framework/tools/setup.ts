import { execSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { stdin } from "node:process";

import * as prettier from "prettier";

import type { EnvironmentUrl } from "../core/config/environmentSchema";
import { BROWSERS } from "../core/config/frameworkConfigSchema";

import { describeCiSettings } from "./ci-secrets";
import {
  AGENTS,
  AGENTS_DIR,
  answerErrors,
  BROWSER_MODULES,
  BUILD_PIPELINE,
  defaultEnvironment,
  ENVIRONMENTS,
  generateProject,
  isDatabaseUrl,
  isProjectName,
  isRequirementsSource,
  isUrl,
  MODULE_LABELS,
  MODULES,
  modulesNeeding,
  SKILLS_DIR,
  STARTER_DIR,
  within,
  type Answers,
  type ProjectFiles,
  type TemplateSource,
  type Validator,
} from "./project-generator";
import { packageChanges, planUpdate, projectAnswers } from "./project-update";
import { assertSupportedNode } from "./runtime";
import {
  isTemplateOwned,
  sha256,
  STAMP_COMMENT,
  STAMP_FILE,
  type TemplateStamp,
} from "./template-stamp";

const ROOT = path.resolve(__dirname, "../..");
const PROJECT_FILES = "framework/setup/project-files.json";

// Secrets are never part of the answers, so an answers file stays shareable.
type Secrets = { databaseUrl?: string };

const templatePath = (file: string) => path.join(ROOT, file);

// Menus for choices, text fields for names and URLs. @clack/prompts is an ES
// module, so it is loaded with import().
async function askAnswers(): Promise<{ answers: Answers; secrets: Secrets }> {
  if (!stdin.isTTY) {
    throw new Error(
      "Interactive setup needs a terminal. For non-interactive use, pass --answers answers.json.",
    );
  }

  const prompts = await import("@clack/prompts");
  const answer = <T>(value: T): Exclude<T, symbol> => {
    if (prompts.isCancel(value)) {
      prompts.cancel("Setup cancelled. Nothing was created.");
      process.exit(130);
    }

    // Every prompt resolves to its value or the cancel symbol handled above.
    return value as Exclude<T, symbol>;
  };
  const validateWith = (validator: Validator) => (value: string | undefined) =>
    validator((value ?? "").trim());
  // Every text field starts empty and shows its suggestion in grey: Enter
  // accepts a suggested value, typing replaces it. A field without a
  // suggestion shows an "e.g." example and must be filled in.
  const ask = async (
    message: string,
    validator: Validator,
    hint: { suggested: string } | { example: string },
  ) => {
    const suggested = "suggested" in hint ? hint.suggested : undefined;
    const value = answer(
      await prompts.text({
        message,
        placeholder:
          suggested ?? `e.g. ${"example" in hint ? hint.example : ""}`,
        defaultValue: suggested,
        validate: (input) =>
          validateWith(validator)((input ?? "").trim() || suggested),
      }),
    ).trim();

    return value || suggested || "";
  };
  // An optional field: Enter leaves it empty.
  const askOptional = async (
    message: string,
    validator: Validator,
    example: string,
  ) =>
    answer(
      await prompts.text({
        message: `${message} (leave empty if none)`,
        placeholder: `e.g. ${example}`,
        validate: (input) => {
          const value = (input ?? "").trim();
          return value === "" ? undefined : validator(value);
        },
      }),
    ).trim() || undefined;
  const confirm = async (message: string) =>
    answer(await prompts.confirm({ message, initialValue: false }));

  prompts.intro("SDET framework setup");
  prompts.log.info(
    "Setup creates a new project folder next to the template. It asks nothing about login: the test account comes in the optional stage 2 (npm run onboard). The only secret here is the test database URL (masked, written only to the git-ignored .env).",
  );

  const appName = await ask(
    "Project name (also the folder name)",
    isProjectName,
    { suggested: "my-app-tests" },
  );

  const selectedModules = answer(
    await prompts.multiselect({
      message: "Which test types do you need?",
      options: MODULES.map((module) => ({
        value: module,
        label: MODULE_LABELS[module],
      })),
      initialValues: ["api", "ui"] as (typeof MODULES)[number][],
      required: true,
    }),
  );
  const modules: Answers["modules"] = {
    ...Object.fromEntries(MODULES.map((module) => [module, false])),
    ...Object.fromEntries(selectedModules.map((module) => [module, true])),
  } as Answers["modules"];

  // API-only projects never launch a browser, so the browser menu is skipped.
  const browsers = BROWSER_MODULES.some((module) => modules[module])
    ? answer(
        await prompts.multiselect({
          message: "Browsers",
          options: BROWSERS.map((browser) => ({ value: browser })),
          initialValues: ["chromium"] as Answers["browsers"],
          required: true,
        }),
      )
    : (["chromium"] as Answers["browsers"]);

  const environmentNames = answer(
    await prompts.multiselect({
      message: "Which environments will the tests run against?",
      options: ENVIRONMENTS.map(({ name }) => ({ value: name })),
      initialValues: ["staging"] as (typeof ENVIRONMENTS)[number]["name"][],
      required: true,
    }),
  );

  // General requirements first, then the UI and the API sources: every
  // question is asked, and a URL is required only when an enabled module
  // needs it (REQUIRED_URLS).
  const requirementsDoc = await askOptional(
    "Requirements or acceptance-criteria document URL or repository-relative path, if available",
    isRequirementsSource,
    "docs/requirements/login.md",
  );
  const uiScenariosDoc = await askOptional(
    "UI/E2E scenario document (user journeys, UI acceptance criteria) URL or repository-relative path, if available",
    isRequirementsSource,
    "docs/e2e/checkout-journeys.md",
  );

  const environments: Answers["environments"] = {};

  for (const { name, hint } of ENVIRONMENTS) {
    if (!environmentNames.includes(name)) continue;

    const askUrl = (
      url: EnvironmentUrl,
      message: string,
      urlHint: { suggested: string } | { example: string },
      optionalMessage = message,
    ) =>
      modulesNeeding(url, modules).length
        ? ask(message, isUrl, urlHint)
        : askOptional(
            optionalMessage,
            isUrl,
            "suggested" in urlHint ? urlHint.suggested : urlHint.example,
          );

    const webBaseUrl = await askUrl("webBaseUrl", `${name}: web URL`, hint);
    const apiBaseUrl = await askUrl(
      "apiBaseUrl",
      `${name}: API URL`,
      webBaseUrl
        ? { suggested: `${webBaseUrl.replace(/\/$/, "")}/api` }
        : { example: "https://staging.example.com/api" },
      `${name}: API URL, if UI tests log in or set up data through the API`,
    );
    const openApiUrl = await askOptional(
      `${name}: public OpenAPI (Swagger) JSON or YAML URL, if there is one`,
      isUrl,
      `${(apiBaseUrl ?? "https://staging.example.com/api").replace(/\/$/, "")}/openapi.json`,
    );
    const database =
      modules.database &&
      (await confirm(
        `${name}: allow direct database access (dedicated test database only)?`,
      ));
    const destructive =
      database && (await confirm(`${name}: allow destructive database reset?`));
    const performance =
      modules.performance &&
      (await confirm(`${name}: allow performance measurement?`));
    const interactiveDiscovery =
      (modules.api || BROWSER_MODULES.some((module) => modules[module])) &&
      (await confirm(
        `${name}: allow planner discovery to submit normal API/UI actions and create or update test data (no deletes/resets)?`,
      ));

    environments[name] = {
      ...(webBaseUrl ? { webBaseUrl } : {}),
      ...(apiBaseUrl ? { apiBaseUrl } : {}),
      ...(openApiUrl ? { openApiUrl } : {}),
      allow: { database, destructive, performance, interactiveDiscovery },
    };
  }

  // The planner, builder and reviewer hand work to each other: one choice.
  const agentChoices = answer(
    await prompts.multiselect({
      message: "GitHub Copilot agents to include (optional)",
      options: [
        {
          value: "pipeline",
          label: "Build pipeline",
          hint: "test-planner, test-builder, test-reviewer",
        },
        { value: "test-runner", label: "test-runner" },
        { value: "ci-failure-analyst", label: "ci-failure-analyst" },
        {
          value: "pr-opener",
          label: "pr-opener",
          hint: "commits reviewed tests and opens a draft pull request",
        },
      ],
      initialValues: [] as string[],
      required: false,
    }),
  );
  const agents = AGENTS.filter((agent) =>
    agentChoices.includes(BUILD_PIPELINE.includes(agent) ? "pipeline" : agent),
  );

  const secrets: Secrets = {};

  if (Object.values(environments).some(({ allow }) => allow.database)) {
    secrets.databaseUrl =
      answer(
        await prompts.password({
          message:
            "DATABASE_URL of the dedicated test database (leave empty to add it to .env later)",
          validate: validateWith(isDatabaseUrl),
        }),
      ).trim() || undefined;
  }

  prompts.outro(`Creating ${appName}…`);

  return {
    answers: {
      appName,
      ...(requirementsDoc ? { requirementsDoc } : {}),
      ...(uiScenariosDoc ? { uiScenariosDoc } : {}),
      environments,
      modules,
      browsers,
      ...(agents.length > 0 ? { agents } : {}),
    },
    secrets,
  };
}

const trackedFiles = (): string[] =>
  execSync("git ls-files --cached --others --exclude-standard", { cwd: ROOT })
    .toString()
    .split("\n")
    .filter((file) => file && fs.existsSync(templatePath(file)));

// The template folder as the generator's source: the project files
// (everything except the UPEX reference implementation and the files that
// only build or test the template), the starter files and the example
// agents. Uncommitted files are included so a change can be verified before a
// commit. Everything is read before an in-place setup removes anything.
export function readTemplateSource(): TemplateSource {
  const exclusions: ProjectFiles = JSON.parse(
    fs.readFileSync(templatePath(PROJECT_FILES), "utf8"),
  );
  const all = trackedFiles();
  const projectFiles = all.filter(
    (file) =>
      !within(file, [...exclusions.reference, ...exclusions.templateOnly]),
  );
  const extra = all.filter((file) =>
    within(file, [STARTER_DIR, AGENTS_DIR, SKILLS_DIR]),
  );
  const executable = execSync("git ls-files -s", { cwd: ROOT })
    .toString()
    .split("\n")
    .filter((line) => line.startsWith("100755 "))
    .map((line) => line.split("\t")[1]);

  // The short commit, as the configurator names its bundle; a folder without
  // a commit (an in-place setup's fresh repository) has no version.
  const git = (command: string) =>
    execSync(command, { cwd: ROOT, stdio: ["ignore", "pipe", "ignore"] })
      .toString()
      .trim();
  let version = "unknown";
  try {
    version = `${git("git rev-parse --short HEAD")}${git("git status --porcelain") ? "-dirty" : ""}`;
  } catch {
    // No commit yet.
  }

  return {
    version,
    files: Object.fromEntries(
      [...new Set([...projectFiles, ...extra])].map((file) => [
        file,
        fs.readFileSync(templatePath(file), "utf8"),
      ]),
    ),
    projectFiles,
    executable,
    exclusions,
    packageLock: async (packageJson) => {
      const folder = fs.mkdtempSync(path.join(os.tmpdir(), "qa-lock-"));

      try {
        fs.writeFileSync(path.join(folder, "package.json"), packageJson);
        fs.copyFileSync(
          templatePath("package-lock.json"),
          path.join(folder, "package-lock.json"),
        );
        execSync(
          `${npmCommand()} install --package-lock-only --ignore-scripts --no-audit --no-fund`,
          { cwd: folder, stdio: "inherit" },
        );
        return fs.readFileSync(path.join(folder, "package-lock.json"), "utf8");
      } finally {
        fs.rmSync(folder, { recursive: true, force: true });
      }
    },
  };
}

export const formatWithPrettier = (content: string, file: string) =>
  prettier.format(content, { filepath: file });

// A new folder next to the template, or the template folder itself
// (--in-place, for a repository created with "Use this template"), where
// every file the project does not contain is removed first.
function writeProject(
  project: string,
  inPlace: boolean,
  files: Record<string, string>,
  executable: string[],
): void {
  if (inPlace) {
    for (const file of trackedFiles().filter((file) => !(file in files))) {
      fs.rmSync(templatePath(file), { force: true });
    }
    removeEmptyDirectories(ROOT);
  } else if (fs.existsSync(project) && fs.readdirSync(project).length > 0) {
    throw new Error(
      `${project} already exists and is not empty. Choose another project name or remove the folder.`,
    );
  }

  for (const [file, content] of Object.entries(files)) {
    const target = path.join(project, file);

    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, content);
    if (executable.includes(file)) fs.chmodSync(target, 0o755);
  }
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

// The npm that runs setup (install.sh pins the version from packageManager).
function npmCommand(): string {
  const npmCli = process.env.npm_execpath;

  return npmCli && path.basename(npmCli) === "npm-cli.js"
    ? `"${process.execPath}" "${npmCli}"`
    : "npm";
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

// The punk robot, for a terminal only: CI logs and the self-test stay clean.
// install.sh prints it first and sets QA_BANNER_SHOWN.
function printBanner(): void {
  if (!process.stdout.isTTY || process.env.QA_BANNER_SHOWN) return;

  const lines = fs
    .readFileSync(templatePath("framework/setup/banner.txt"), "utf8")
    .trimEnd()
    .split(/\r?\n/);
  const color = !process.env.NO_COLOR && process.stdout.hasColors();
  const style = (code: number, line: string) =>
    color ? `\x1b[${code}m${line}\x1b[0m` : line;

  console.log(
    lines
      .map((line, index) =>
        index < 3
          ? style(35, line)
          : line.includes("SDET FRAMEWORK")
            ? style(1, line)
            : line,
      )
      .join("\n"),
  );
}

function option(args: string[], name: string): string | undefined {
  const index = args.indexOf(name);

  return index >= 0 ? args[index + 1] : undefined;
}

// Every file under a folder, as project paths, without .git and node_modules.
function filesUnder(project: string, folder: string): string[] {
  const absolute = path.join(project, folder);
  if (!fs.existsSync(absolute)) return [];
  return fs
    .readdirSync(absolute, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) =>
      path
        .relative(project, path.join(entry.parentPath, entry.name))
        .split(path.sep)
        .join("/"),
    )
    .filter((file) => !/(^|\/)(node_modules|\.git)\//.test(file));
}

// npm run setup -- --update <project> [--write] [--force] (ADR-019): a dry
// run by default; --write needs a git repository with a clean working tree,
// so git diff shows the update and git checkout undoes it.
async function updateProject(
  project: string,
  write: boolean,
  force: boolean,
): Promise<void> {
  const read = (file: string) =>
    fs.readFileSync(path.join(project, file), "utf8");
  const exists = (file: string) => fs.existsSync(path.join(project, file));
  for (const file of [
    "package.json",
    "config/framework.config.ts",
    "config/environments/environments.json",
  ]) {
    if (!exists(file)) {
      throw new Error(
        `${project} is not a project created by npm run setup: ${file} is missing.`,
      );
    }
  }
  if (path.resolve(project) === ROOT) {
    throw new Error("--update takes a project folder, not the template.");
  }
  if (write) {
    let status: string;
    try {
      status = execSync("git status --porcelain", { cwd: project }).toString();
    } catch {
      throw new Error(
        `${project} is not a git repository; --write needs one so the update can be reviewed and undone.`,
      );
    }
    if (status.trim()) {
      throw new Error(
        "The project has uncommitted changes. Commit or stash them first, then run the update again.",
      );
    }
  }

  const stamp: TemplateStamp | undefined = exists(STAMP_FILE)
    ? JSON.parse(read(STAMP_FILE))
    : undefined;
  const packageJson = JSON.parse(read("package.json"));
  const { answers, inferredAgents } = projectAnswers({
    packageJson,
    environments: JSON.parse(read("config/environments/environments.json")),
    frameworkConfig: read("config/framework.config.ts"),
    agentFiles: fs.existsSync(path.join(project, ".github/agents"))
      ? fs.readdirSync(path.join(project, ".github/agents"))
      : [],
    stamp,
    knownAgents: AGENTS,
  });

  const source = readTemplateSource();
  const generated = await generateProject(
    answers,
    // The update never changes package-lock.json; npm install does.
    { ...source, packageLock: async () => source.files["package-lock.json"] },
    formatWithPrettier,
  );

  const owned = Object.keys(generated.files).filter(isTemplateOwned);
  const hashes = async (files: string[], content: (file: string) => string) =>
    Object.fromEntries(
      await Promise.all(
        files.map(async (file) => [file, await sha256(content(file))] as const),
      ),
    );
  const onDisk = [
    "AGENTS.md",
    ".github/copilot-instructions.md",
    ...filesUnder(project, "framework"),
    ...filesUnder(project, ".github/agents"),
    ...filesUnder(project, ".github/skills"),
  ].filter(exists);
  const plan = planUpdate({
    generated: await hashes(owned, (file) => generated.files[file]),
    current: await hashes(onDisk, read),
    stamped: stamp?.files,
    force,
  });
  const pkg = packageChanges(
    packageJson,
    JSON.parse(generated.files["package.json"]),
  );

  const enabled = (record: Record<string, boolean>) =>
    Object.entries(record)
      .filter(([, on]) => on)
      .map(([name]) => name)
      .join(", ") || "none";
  console.log(`Project: ${project}
Template: ${stamp?.template ?? "no stamp (created before .sdet-template.json)"} → ${source.version}
Agents: ${(answers.agents ?? []).join(", ") || "none"}${inferredAgents ? " (from .github/agents; the stamp records them from now on)" : ""}
Modules: ${enabled(answers.modules)} · Browsers: ${answers.browsers.join(", ")} (from config/framework.config.ts)
`);
  const labels = { add: "+", update: "~", remove: "-", skip: "!" } as const;
  for (const { file, action, reason } of plan.actions) {
    console.log(`${labels[action]} ${action.padEnd(6)} ${file}: ${reason}`);
  }
  console.log(`  ${plan.unchanged} template-owned files already current.`);
  for (const script of pkg.scripts) console.log(`+ script ${script}`);
  for (const dependency of pkg.dependencies) {
    console.log(`+ package ${dependency}`);
  }
  for (const difference of pkg.differing) {
    console.log(`! package ${difference} (kept)`);
  }

  if (!write) {
    console.log(
      "\nDry run: nothing changed. Run again with --write to apply it.",
    );
    return;
  }

  for (const { file, action } of plan.actions) {
    const target = path.join(project, file);
    if (action === "remove") {
      fs.rmSync(target, { force: true });
    } else if (action === "add" || action === "update") {
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, generated.files[file]);
      if (generated.executable.includes(file)) fs.chmodSync(target, 0o755);
    }
  }
  if (pkg.scripts.length > 0 || pkg.dependencies.length > 0) {
    fs.writeFileSync(
      path.join(project, "package.json"),
      `${JSON.stringify(pkg.packageJson, null, 2)}\n`,
    );
  }
  fs.writeFileSync(
    path.join(project, STAMP_FILE),
    await formatWithPrettier(
      JSON.stringify({
        $comment: STAMP_COMMENT,
        template: source.version ?? "unknown",
        agents: answers.agents ?? [],
        files: plan.stampFiles,
      }),
      STAMP_FILE,
    ),
  );
  console.log(`
Updated. Next:
  1. git diff                      (review the update)
  ${pkg.dependencies.length > 0 ? "2. npm install                   (new packages)" : "2. npm ci                        (only if package-lock.json changed)"}
  3. npx prettier --check . && npm run typecheck && npm run lint:architecture
  4. git commit -am "Update the SDET framework to ${source.version}"`);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const updateTarget = option(args, "--update");
  if (args.includes("--update")) {
    assertSupportedNode();
    if (!updateTarget || updateTarget.startsWith("--")) {
      throw new Error(
        "Usage: npm run setup -- --update <project folder> [--write] [--force]",
      );
    }
    await updateProject(
      path.resolve(updateTarget),
      args.includes("--write"),
      args.includes("--force"),
    );
    return;
  }
  const answersFile = option(args, "--answers");
  const inPlace = args.includes("--in-place");

  printBanner();
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

  const errors = answerErrors(answers);
  if (errors.length > 0) {
    throw new Error(`Invalid setup answers:\n${errors.join("\n")}`);
  }

  const valid = answers as Answers;
  const project = inPlace
    ? ROOT
    : path.resolve(
        option(args, "--target") ?? path.join(ROOT, "..", valid.appName),
      );
  const generated = await generateProject(
    valid,
    readTemplateSource(),
    formatWithPrettier,
  );

  writeProject(project, inPlace, generated.files, generated.executable);

  const envStatus = writeEnvFile(
    project,
    generated.files[".env.example"],
    secrets,
  );
  const gitStatus = inPlace ? "" : `\n${initialiseGit(project)}`;

  // install.sh continues in the project folder.
  if (process.env.QA_SETUP_RESULT) {
    fs.writeFileSync(process.env.QA_SETUP_RESULT, project);
  }

  const loginConfigured = Object.keys(generated.config.roles).length > 0;
  const steps = [
    ...(inPlace ? [] : [`cd ${displayPath(project)}`]),
    "npm run doctor   (checks the configuration and that the URLs are reachable)",
    loginConfigured
      ? "npm run onboard  (puts the role test accounts into .env), then npm run doctor again."
      : "Optional: npm run onboard  (adds the first role and test account). Then configure login (README.md, Configure login).",
  ];
  // install.sh continues with the installation and stage 2.
  const nextSteps = process.env.QA_SETUP_RESULT
    ? ""
    : `\nNext steps:\n${steps.map((step, index) => `  ${index + 1}. ${step}`).join("\n")}`;

  console.log(`
Created ${valid.appName} in ${project}.
${envStatus}${gitStatus}
${nextSteps}
${databaseWarnings(valid, secrets, envStatus)}
${describeCiSettings(defaultEnvironment(valid), generated.secretNames)}
${inPlace ? "" : "\nTo publish it: create an empty GitHub repository, then git remote add origin <url> && git push -u origin main\n"}`);
}

// The configurator's bundle imports this module for readTemplateSource; only
// a direct run of setup.ts starts the setup.
if (require.main === module) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
