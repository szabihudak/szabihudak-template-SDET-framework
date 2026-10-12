import fs from "node:fs";
import path from "node:path";

import type { FrameworkConfig } from "../core/config/frameworkConfigSchema";

export const CI_WORKFLOWS = [
  ".github/workflows/playwright.yml",
  ".github/workflows/performance.yml",
];

const SECRETS_BLOCK =
  /^([ \t]*)# @qa:secrets:start[^\n]*\n[\s\S]*?^[ \t]*# @qa:secrets:end[^\n]*\n/gm;

export function ciSecretNames(
  config: Pick<FrameworkConfig, "roles" | "modules">,
): string[] {
  const names = Object.values(config.roles).flatMap(
    ({ usernameEnv, passwordEnv }) => [usernameEnv, passwordEnv],
  );

  if (config.modules.database) names.push("DATABASE_URL");

  return names;
}

// Workflow env blocks cannot read secrets dynamically, so each one is listed
// between markers that stay in place for later synchronisation.
export function syncWorkflowSecrets(
  root: string,
  secretNames: string[],
): string[] {
  const updated: string[] = [];

  for (const workflow of CI_WORKFLOWS) {
    const file = path.join(root, workflow);

    if (!fs.existsSync(file)) continue;

    const content = fs.readFileSync(file, "utf8");
    const synced = content.replace(SECRETS_BLOCK, (_block, indent: string) =>
      [
        `${indent}# @qa:secrets:start (managed by npm run qa:sync-ci-secrets)`,
        ...secretNames.map(
          (name) => `${indent}${name}: \${{ secrets.${name} }}`,
        ),
        `${indent}# @qa:secrets:end`,
        "",
      ].join("\n"),
    );

    if (synced !== content) {
      fs.writeFileSync(file, synced);
      updated.push(workflow);
    }
  }

  return updated;
}

export function describeCiSettings(
  ciEnvironment: string | undefined,
  secretNames: string[],
): string {
  return [
    "GitHub Actions (Settings → Secrets and variables → Actions):",
    ...(ciEnvironment ? [`  Variable  TEST_ENV = ${ciEnvironment}`] : []),
    ...(secretNames.length > 0
      ? secretNames.map((name) => `  Secret    ${name}`)
      : [
          "  No secrets yet. After configuring login and roles, run npm run qa:sync-ci-secrets.",
        ]),
  ].join("\n");
}
