import fs from "node:fs";
import path from "node:path";

import { categoryScriptNames } from "./test-scripts";

// What the installer tells the user to do once it is done: the rest happens
// in their IDE, so the steps follow the AI tools setup installed.

export type AiTools = { copilot: boolean; claude: boolean };
export type Onboarding = "done" | "incomplete" | "skipped";

export type ProjectState = {
  tools: AiTools;
  // MCP server names from .vscode/mcp.json and .mcp.json.
  mcp: { vscode: string[]; claude: string[] };
  // Category scripts from package.json (test:api, test:ui, test:chromium...).
  testScripts?: string[];
};

export type FinishOptions = ProjectState & {
  // How to reach the project from where the user started, when it is elsewhere.
  cd?: string;
  onboarding: Onboarding;
  doctorOk: boolean;
};

export function installedAiTools(root: string): AiTools {
  return {
    copilot: fs.existsSync(
      path.join(root, ".github/prompts/first-tests.prompt.md"),
    ),
    claude: fs.existsSync(path.join(root, ".claude/commands/first-tests.md")),
  };
}

function mcpServerNames(file: string, key: string): string[] {
  if (!fs.existsSync(file)) return [];

  const config = JSON.parse(fs.readFileSync(file, "utf8"));
  return Object.keys(config[key] ?? {});
}

export function readProjectState(root: string): ProjectState {
  return {
    tools: installedAiTools(root),
    mcp: {
      vscode: mcpServerNames(path.join(root, ".vscode/mcp.json"), "servers"),
      claude: mcpServerNames(path.join(root, ".mcp.json"), "mcpServers"),
    },
    testScripts: categoryScriptNames(
      JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"))
        .scripts ?? {},
    ),
  };
}

const serverList = (names: string[]) => `(${names.join(", ")})`;

function aiToolSteps({ tools, mcp }: ProjectState): string[] {
  if (tools.copilot && tools.claude) {
    const servers = [...new Set([...mcp.vscode, ...mcp.claude])];

    return [
      "Open the project: code . (VS Code with Copilot) or claude (Claude Code)",
      ...(servers.length > 0
        ? [`Start the MCP servers when your tool asks ${serverList(servers)}`]
        : []),
      "Run /first-tests: Copilot Chat -> Agent mode, or the Claude Code prompt",
    ];
  }
  if (tools.copilot) {
    return [
      "code .   (opens the project in VS Code)",
      ...(mcp.vscode.length > 0
        ? [`Start the MCP servers when VS Code asks ${serverList(mcp.vscode)}`]
        : []),
      "Copilot Chat -> Agent mode -> /first-tests",
    ];
  }
  if (tools.claude) {
    return [
      "claude   (starts Claude Code in the project)",
      ...(mcp.claude.length > 0
        ? [
            `Approve the MCP servers when Claude Code asks ${serverList(mcp.claude)}`,
          ]
        : []),
      "/first-tests",
    ];
  }
  return [
    "Open the project in your IDE",
    "Give your AI tool framework/docs/FIRST_TESTS_PROMPT.md, or follow it by hand",
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
    ...aiToolSteps(options),
  ];

  return [
    `${mark} The installer is done. Continue in your IDE:`,
    ...steps.map((step, index) => `   ${index + 1}. ${step}`),
    "",
    `${options.tools.copilot || options.tools.claude ? "/first-tests" : "The prompt"} configures the login, checks it with npm run doctor and`,
    "proposes the first tests. It waits for your approval before writing them.",
    ...(options.testScripts?.length
      ? [
          "",
          "Run one test category: npm run <script>",
          `   ${options.testScripts.join(", ")}`,
        ]
      : []),
  ];
}
