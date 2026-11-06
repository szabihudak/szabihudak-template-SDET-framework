import type { Answers } from "./project-generator";
import { isTemplateOwned, type TemplateStamp } from "./template-stamp";

// npm run setup -- --update <project> [--write] [--force] (ADR-019)
//
// Brings the template-owned files of an existing project (framework/,
// AGENTS.md, the Copilot instructions, the agents and skills it has) to the
// template's current version, and adds the package.json scripts and
// dependencies the new version needs. It never touches what the project
// owns: src/, tests/, config/, test plans and reviews, README, workflows,
// .env. The project's stamp (.sdet-template.json) holds the hash of every
// template-owned file as setup last wrote it, so a file the project changed
// since is kept rather than overwritten, unless --force.

export type FileAction = {
  file: string;
  action: "add" | "update" | "remove" | "skip";
  reason: string;
};

export type UpdatePlan = {
  actions: FileAction[];
  unchanged: number;
  // The stamp's files after the update: the new hash of every file written,
  // the old one of every file kept.
  stampFiles: Record<string, string>;
};

// Decides, file by file, what an update does. All hashes are SHA-256 hex;
// `current` has the hash of every template-owned file now in the project,
// `stamped` the stamp's (undefined for a project without a stamp).
export function planUpdate(input: {
  generated: Record<string, string>;
  current: Record<string, string>;
  stamped?: Record<string, string>;
  force: boolean;
}): UpdatePlan {
  const { generated, current, stamped, force } = input;
  const actions: FileAction[] = [];
  const stampFiles: Record<string, string> = {};
  let unchanged = 0;

  const files = [
    ...new Set([
      ...Object.keys(generated),
      ...Object.keys(stamped ?? {}),
      ...(stamped ? [] : Object.keys(current)),
    ]),
  ]
    .filter(isTemplateOwned)
    .sort();

  for (const file of files) {
    const next = generated[file];
    const now = current[file];
    const before = stamped?.[file];
    const keep = (reason: string) => {
      actions.push({ file, action: "skip", reason });
      if (before !== undefined) stampFiles[file] = before;
    };

    if (next !== undefined) {
      if (now === next) {
        unchanged++;
        stampFiles[file] = next;
      } else if (now === undefined) {
        if (before !== undefined && !force) {
          keep("deleted in the project; --force adds it again");
        } else {
          actions.push({ file, action: "add", reason: "new in the template" });
          stampFiles[file] = next;
        }
      } else if (!stamped) {
        actions.push({
          file,
          action: "update",
          reason:
            "the project has no stamp, so a local change cannot be told apart; check git diff",
        });
        stampFiles[file] = next;
      } else if (now === before || force) {
        actions.push({
          file,
          action: "update",
          reason:
            now === before
              ? "changed in the template"
              : before === undefined
                ? "not written by setup; overwritten (--force)"
                : "local change overwritten (--force)",
        });
        stampFiles[file] = next;
      } else {
        keep(
          before === undefined
            ? "in the project but not written by setup; --force replaces it"
            : "changed in the project since the last setup or update; --force replaces it",
        );
      }
    } else if (now !== undefined) {
      if (!stamped) {
        if (file.startsWith("framework/")) {
          actions.push({
            file,
            action: "skip",
            reason:
              "no longer in the template; remove it yourself when nothing uses it",
          });
        }
      } else if (before === undefined) {
        // A file the project added itself, such as its own skill.
      } else if (now === before || force) {
        actions.push({
          file,
          action: "remove",
          reason:
            now === before
              ? "no longer in the template, or its agent is not chosen"
              : "no longer in the template; local change discarded (--force)",
        });
      } else {
        keep(
          "no longer in the template, but changed in the project; remove it yourself or use --force",
        );
      }
    }
  }

  return { actions, unchanged, stampFiles };
}

type PackageJson = {
  name?: string;
  scripts?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  [key: string]: unknown;
};

export type PackageChanges = {
  scripts: string[];
  dependencies: string[];
  // Packages whose version differs from the template's; reported, not changed.
  differing: string[];
  packageJson: PackageJson;
};

// Adds the scripts and dependencies the template has and the project lacks.
// Existing entries keep the project's value.
export function packageChanges(
  current: PackageJson,
  template: PackageJson,
): PackageChanges {
  const packageJson: PackageJson = structuredClone(current);
  const scripts: string[] = [];
  const dependencies: string[] = [];
  const differing: string[] = [];

  for (const [name, command] of Object.entries(template.scripts ?? {})) {
    packageJson.scripts ??= {};
    if (!(name in packageJson.scripts)) {
      packageJson.scripts[name] = command;
      scripts.push(name);
    }
  }
  for (const section of ["dependencies", "devDependencies"] as const) {
    for (const [name, version] of Object.entries(template[section] ?? {})) {
      const existing = packageJson[section]?.[name];
      if (existing === undefined) {
        packageJson[section] = { ...packageJson[section], [name]: version };
        dependencies.push(`${name}@${version}`);
      } else if (existing !== version) {
        differing.push(
          `${name}: ${existing} in the project, ${version} in the template`,
        );
      }
    }
  }
  return { scripts, dependencies, differing, packageJson };
}

// The settings setup needs to generate the project again, from the project
// itself: its name, environments, modules and browsers (config may have
// changed since setup) and its agents (from the stamp, or the agent files).
export function projectAnswers(input: {
  packageJson: PackageJson;
  environments: Answers["environments"];
  frameworkConfig: string;
  agentFiles: string[];
  stamp?: TemplateStamp;
  knownAgents: readonly string[];
}): { answers: Answers; inferredAgents: boolean } {
  const object = (pattern: RegExp, what: string) => {
    const match = pattern.exec(input.frameworkConfig);
    if (!match) {
      throw new Error(`config/framework.config.ts: cannot read its ${what}`);
    }
    return JSON.parse(
      match[1]
        .replace(/([{,]\s*)([A-Za-z_$][\w$]*)\s*:/g, '$1"$2":')
        .replace(/,(\s*[}\]])/g, "$1"),
    );
  };
  const agents = input.stamp
    ? input.stamp.agents
    : input.agentFiles
        .map((file) => /^([^/]+)\.agent\.md$/.exec(file)?.[1])
        .filter((agent): agent is string =>
          input.knownAgents.includes(agent ?? ""),
        );

  return {
    answers: {
      appName: input.packageJson.name ?? "project",
      environments: input.environments,
      modules: object(/\bmodules:\s*(\{[^}]*\})/, "modules"),
      browsers: object(/\bbrowsers:\s*(\[[^\]]*\])/, "browsers"),
      ...(agents.length > 0
        ? { agents: agents as NonNullable<Answers["agents"]> }
        : {}),
    },
    inferredAgents: !input.stamp,
  };
}
