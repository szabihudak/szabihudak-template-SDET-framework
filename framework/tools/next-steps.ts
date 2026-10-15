import fs from "node:fs";
import path from "node:path";

import { categoryScriptNames } from "./test-scripts";

// What the installer tells the user to do once it is done: the rest happens
// in the IDE: login, then the first tests (ADR-010).

export type Onboarding = "done" | "incomplete" | "skipped";

export type ProjectState = {
  // MCP server names from .vscode/mcp.json.
  mcp: string[];
  // Category scripts from package.json (test:api, test:ui, test:chromium...).
  testScripts?: string[];
};

export type FinishOptions = ProjectState & {
  // How to reach the project from where the user started, when it is elsewhere.
  cd?: string;
  onboarding: Onboarding;
  doctorOk: boolean;
};

function mcpServerNames(file: string, key: string): string[] {
  if (!fs.existsSync(file)) return [];

  const config = JSON.parse(fs.readFileSync(file, "utf8"));
  return Object.keys(config[key] ?? {});
}

export function readProjectState(root: string): ProjectState {
  return {
    mcp: mcpServerNames(path.join(root, ".vscode/mcp.json"), "servers"),
    testScripts: categoryScriptNames(
      JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"))
        .scripts ?? {},
    ),
  };
}

const serverList = (names: string[]) => `(${names.join(", ")})`;

function agentSteps({ mcp }: ProjectState): string[] {
  return [
    "code .   (opens the project in VS Code)",
    ...(mcp.length > 0
      ? [`Start the MCP servers when VS Code asks ${serverList(mcp)}`]
      : []),
    "Configure login: README.md, Configure login",
    "Write the first tests from the golden templates (AGENTS.md)",
  ];
}

const shellWord = (text: string) =>
  /^[\w@%+=:,./~-]+$/.test(text)
    ? text
    : `"${text.replace(/(["\\$`])/g, "\\$1")}"`;

// What to cd to from the folder the installer was started in: the project's
// name when it is in that folder, ../<name> next to it (the default: next to
// the template), otherwise the absolute path. Undefined when already there.
export function cdTarget(start: string, project: string): string | undefined {
  const from = path.resolve(start);
  const to = path.resolve(project);
  const name = path.basename(to);

  if (from === to) return undefined;
  if (path.dirname(to) === from) return shellWord(name);
  if (path.dirname(to) === path.dirname(from)) return shellWord(`../${name}`);
  return shellWord(to);
}

// mark leads the heading: an emoji on terminals that show one, else ASCII.
export function nextSteps(options: FinishOptions, mark = "->"): string[] {
  const steps = [
    ...(options.cd ? [`cd ${options.cd}`] : []),
    ...(options.doctorOk
      ? []
      : ["Fix what npm run doctor reported above, then run npm run doctor"]),
    ...(options.onboarding === "skipped"
      ? ["npm run onboard   (adds the test account to .env)"]
      : options.onboarding === "incomplete"
        ? ["Fill in the empty values in .env, or run npm run onboard"]
        : []),
    ...agentSteps(options),
  ];

  return [
    `${mark} The installer is done. Continue in your IDE:`,
    ...steps.map((step, index) => `   ${index + 1}. ${step}`),
    ...(options.testScripts?.length
      ? [
          "",
          "Run one test category: npm run <script>",
          `   ${options.testScripts.join(", ")}`,
        ]
      : []),
  ];
}
