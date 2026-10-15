import fs from "node:fs";
import path from "node:path";
import { stdin, stdout } from "node:process";

import * as prettier from "prettier";

import { getFrameworkConfig } from "../core/config/frameworkConfig";

import {
  ciSecretNames,
  describeCiSettings,
  syncWorkflowSecrets,
} from "./ci-secrets";
import {
  addRoleToConfig,
  addRoleToEnvExample,
  DEFAULT_ROLE,
  readEnvValues,
  setEnvValues,
} from "./onboarding";
import { assertSupportedNode } from "./runtime";

// Stage 2 of the installer, and rerunnable on its own: puts the test account
// for the first tests into the git-ignored .env. Optional at every step.
// install.sh reads the outcome (done, incomplete or skipped) from
// QA_ONBOARD_RESULT.

const ROOT = path.resolve(__dirname, "../..");
const file = (name: string) => path.join(ROOT, name);

type Outcome = "done" | "incomplete" | "skipped";
type Role = { name: string; usernameEnv: string; passwordEnv: string };

function finish(outcome: Outcome): void {
  if (process.env.QA_ONBOARD_RESULT) {
    fs.writeFileSync(process.env.QA_ONBOARD_RESULT, outcome);
  }
}

function firstTestsCommand(): string {
  return "configure login (README.md, Configure login) and write the first tests";
}

function laterInstructions(roles: Role[]): string {
  return [
    "Add the test account later, whenever it exists:",
    "  - run npm run onboard (it asks only for the account), or",
    roles.length > 0
      ? `  - put ${roles.flatMap((role) => [role.usernameEnv, role.passwordEnv]).join(" and ")} into .env yourself.`
      : "  - add the roles in config/framework.config.ts (README.md, Configure login), then fill in their USERNAME/PASSWORD pairs in .env.",
    "Then run npm run doctor. For CI, add the same names as GitHub Actions secrets.",
  ].join("\n");
}

async function main(): Promise<void> {
  assertSupportedNode();

  if (fs.existsSync(file("framework/tools/setup.ts"))) {
    throw new Error(
      "npm run onboard runs in a project. Create one with ./install.sh first.",
    );
  }

  const config = getFrameworkConfig();
  const configured: Role[] = Object.entries(config.roles).map(
    ([name, role]) => ({ name, ...role }),
  );

  if (
    !stdin.isTTY ||
    !stdout.isTTY ||
    process.env.CI ||
    process.env.QA_NONINTERACTIVE
  ) {
    console.log(
      `Stage 2 (first tests) asks questions only on a terminal, never in CI or with --answers, so it was skipped.\n${laterInstructions(configured)}`,
    );
    finish("skipped");
    return;
  }

  const prompts = await import("@clack/prompts");
  const answer = <T>(value: T): Exclude<T, symbol> => {
    if (prompts.isCancel(value)) {
      prompts.cancel(`Stage 2 skipped.\n${laterInstructions(configured)}`);
      finish("skipped");
      process.exit(0);
    }

    // Every prompt resolves to its value or the cancel symbol handled above.
    return value as Exclude<T, symbol>;
  };

  prompts.intro("Stage 2: First tests (optional)");
  prompts.log.info(
    [
      "The first tests sign in with a test account. Register one in the application under test now or later:",
      "use a dedicated test account, never a personal or production login.",
      "The values go only into .env, which git ignores. Nothing here is required.",
    ].join("\n"),
  );

  const roles = configured.length > 0 ? configured : [DEFAULT_ROLE];
  const proceed = answer(
    await prompts.confirm({
      message:
        configured.length > 0
          ? `Enter the test account${roles.length > 1 ? "s" : ""} for ${roles.map(({ name }) => `"${name}"`).join(", ")} now?`
          : "Set up the test account for the first tests now?",
      active: "Yes",
      inactive: "Skip",
      initialValue: true,
    }),
  );

  if (!proceed) {
    prompts.outro(`Skipped.\n${laterInstructions(configured)}`);
    finish("skipped");
    return;
  }

  const envFile = file(".env");
  if (!fs.existsSync(envFile)) {
    fs.copyFileSync(file(".env.example"), envFile);
  }

  if (configured.length === 0) {
    const configFile = file("config/framework.config.ts");

    if (!addRoleToConfig(configFile)) {
      prompts.cancel(
        `config/framework.config.ts has no empty roles object, so the role could not be added. Add roles.${DEFAULT_ROLE.name} yourself, then run npm run onboard again.`,
      );
      finish("skipped");
      process.exit(1);
    }

    fs.writeFileSync(
      configFile,
      await prettier.format(fs.readFileSync(configFile, "utf8"), {
        filepath: configFile,
      }),
    );
    // .env was copied from .env.example before the role existed.
    addRoleToEnvExample(file(".env.example"));
    addRoleToEnvExample(envFile);
    syncWorkflowSecrets(
      ROOT,
      ciSecretNames({
        modules: config.modules,
        roles: {
          [DEFAULT_ROLE.name]: {
            usernameEnv: DEFAULT_ROLE.usernameEnv,
            passwordEnv: DEFAULT_ROLE.passwordEnv,
          },
        },
      }),
    );
    prompts.log.success(
      `Added the "${DEFAULT_ROLE.name}" role to config/framework.config.ts, .env.example and the CI workflows.`,
    );
  }

  const current = readEnvValues(envFile);
  const values: Record<string, string> = {};

  for (const role of roles) {
    const keep = (name: string) =>
      current[name] ? " (leave empty to keep the current one)" : "";
    const username = answer(
      await prompts.text({
        message: `"${role.name}" username or email${keep(role.usernameEnv) || " (leave empty to add it later)"}`,
      }),
    ).trim();
    const password = answer(
      await prompts.password({
        message: `"${role.name}" password${keep(role.passwordEnv) || " (leave empty to add it later)"}`,
      }),
    );

    if (username) values[role.usernameEnv] = username;
    if (password) values[role.passwordEnv] = password;
  }

  const rejected = setEnvValues(envFile, values);
  for (const name of rejected) {
    prompts.log.warn(
      `${name} contains a line break or every quote character, so it was not written. Add it to .env yourself.`,
    );
  }

  const missing = roles
    .flatMap((role) => [role.usernameEnv, role.passwordEnv])
    .filter((name) => !readEnvValues(envFile)[name]);
  const outcome: Outcome = missing.length === 0 ? "done" : "incomplete";

  prompts.log.message(
    describeCiSettings(
      undefined,
      ciSecretNames({
        modules: config.modules,
        roles: Object.fromEntries(
          roles.map(({ name, ...role }) => [name, role]),
        ),
      }),
    ),
  );
  prompts.outro(
    [
      outcome === "done"
        ? "The test account is in .env."
        : `Still empty in .env: ${missing.join(", ")}. Fill them in, then run npm run doctor (or run npm run onboard again).`,
      `Next: ${firstTestsCommand()}.`,
    ].join("\n"),
  );
  finish(outcome);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  finish("skipped");
  process.exit(1);
});
