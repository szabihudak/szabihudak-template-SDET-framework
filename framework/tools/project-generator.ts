import { Type, type Static } from "@sinclair/typebox";

import { validateSchema } from "../core/api/SchemaValidator";
import {
  environmentsSchema,
  REQUIRED_URLS,
  type EnvironmentUrl,
} from "../core/config/environmentSchema";
import {
  frameworkConfigSchema,
  type FrameworkConfig,
} from "../core/config/frameworkConfigSchema";

import { ciSecretNames, syncSecretsBlock } from "./ci-secrets";
import { testScripts, withTestScripts } from "./test-scripts";

// The project setup creates from the template, as files: no file system,
// terminal or npm. setup.ts runs it with the template folder as its source,
// the configurator page with a bundle of the same files (ADR-015), so both
// create the same project from the same answers.

export const STARTER_DIR = "framework/setup/starter";
export const AGENTS_DIR = "examples/copilot-agents/.github/agents";

// Local apps usually run on a known address; a staging URL has no sensible
// default.
export const ENVIRONMENTS = [
  { name: "staging", hint: { example: "https://staging.example.com" } },
  { name: "local", hint: { suggested: "http://localhost:3000" } },
] as const;

export const BROWSER_MODULES = [
  "ui",
  "smoke",
  "accessibility",
  "visual",
  "performance",
] as const;

export const MODULES = [
  "api",
  "ui",
  "smoke",
  "accessibility",
  "database",
  "visual",
  "performance",
] as const;

export const MODULE_LABELS: Record<(typeof MODULES)[number], string> = {
  api: "API",
  ui: "UI",
  smoke: "Smoke",
  accessibility: "Accessibility",
  database: "Database",
  visual: "Visual regression",
  performance: "Performance (k6, Lighthouse)",
};

// The optional GitHub Copilot agents of examples/copilot-agents. The planner,
// builder and reviewer hand work to each other, so they come as one choice.
export const AGENTS = [
  "test-planner",
  "test-builder",
  "test-reviewer",
  "test-runner",
  "ci-failure-analyst",
] as const;
export const BUILD_PIPELINE = ["test-planner", "test-builder", "test-reviewer"];

export const answersSchema = Type.Object(
  {
    appName: Type.String({ pattern: "^[a-z0-9][a-z0-9-]*$" }),
    requirementsDoc: Type.Optional(Type.String({ minLength: 1 })),
    uiScenariosDoc: Type.Optional(Type.String({ minLength: 1 })),
    environments: environmentsSchema,
    modules: frameworkConfigSchema.properties.modules,
    browsers: frameworkConfigSchema.properties.browsers,
    // Login is configured after setup; answers files may still provide it.
    auth: Type.Optional(frameworkConfigSchema.properties.auth),
    roles: Type.Optional(
      Type.Array(Type.String({ pattern: "^[a-z][a-zA-Z0-9]*$" }), {
        uniqueItems: true,
      }),
    ),
    agents: Type.Optional(
      Type.Array(Type.Union(AGENTS.map((agent) => Type.Literal(agent))), {
        uniqueItems: true,
      }),
    ),
  },
  { additionalProperties: false },
);

export type Answers = Static<typeof answersSchema>;

export type Validator = (value: string) => string | undefined;

export const isUrl: Validator = (value) => {
  try {
    const url = new URL(value);

    if (
      (url.protocol === "http:" || url.protocol === "https:") &&
      !/[\s[\]()]/.test(value)
    ) {
      return undefined;
    }
  } catch {
    // Fall through to the message below.
  }

  return "Enter a full URL such as https://staging.example.com (no brackets or spaces).";
};

const isPath: Validator = (value) =>
  /^\/[^\s]*$/.test(value)
    ? undefined
    : "Enter a path that starts with /, for example /dashboard.";

export const isProjectName: Validator = (value) =>
  /^[a-z0-9][a-z0-9-]*$/.test(value)
    ? undefined
    : "Use lower-case letters, digits and hyphens, for example my-app-tests.";

export const isDatabaseUrl: Validator = (value) =>
  value === "" || /^postgres(ql)?:\/\/\S+$/.test(value)
    ? undefined
    : "Enter a PostgreSQL URL such as postgresql://user:password@host:5432/test_db, or leave it empty.";

export const isRequirementsSource: Validator = (value) => {
  if (!isUrl(value)) return undefined;
  if (
    value.includes("://") ||
    value.startsWith("/") ||
    value.includes("\\") ||
    value
      .split("/")
      .some((part) => part === ".." || part === "." || part === "")
  ) {
    return "Enter an HTTPS/HTTP URL or a repository-relative path without '..'.";
  }
  return undefined;
};

// The modules that make an environment URL required (REQUIRED_URLS).
export const modulesNeeding = (
  url: EnvironmentUrl,
  modules: Answers["modules"],
) =>
  REQUIRED_URLS[url].filter(
    (module) => modules[module as keyof typeof modules],
  );

function describeSchemaError(error: unknown): string {
  const details = String(
    error instanceof Error ? error.message : error,
  ).replace(/^Schema validation failed:\n/, "");

  try {
    const errors: { instancePath: string; message: string }[] =
      JSON.parse(details);

    return errors
      .map(
        ({ instancePath, message }) => `  - ${instancePath || "/"} ${message}`,
      )
      .join("\n");
  } catch {
    return details;
  }
}

// Checks the answers file mode cannot express through the schema alone.
function semanticErrors(answers: Answers): string[] {
  const errors: string[] = [];

  for (const key of ["requirementsDoc", "uiScenariosDoc"] as const) {
    const value = answers[key];
    const error = value ? isRequirementsSource(value) : undefined;
    if (error) errors.push(`${key}: ${error}`);
  }

  for (const [name, environment] of Object.entries(answers.environments)) {
    for (const key of ["webBaseUrl", "apiBaseUrl", "openApiUrl"] as const) {
      if (environment[key] === undefined) continue;
      const error = isUrl(environment[key]);
      if (error) errors.push(`environments.${name}.${key}: ${error}`);
    }
    for (const key of ["webBaseUrl", "apiBaseUrl"] as const) {
      const [module] = modulesNeeding(key, answers.modules);
      if (module && !environment[key]) {
        errors.push(
          `environments.${name}.${key}: required because the ${module} module is enabled`,
        );
      }
    }
  }

  const paths: [string, string][] = [];
  if (answers.auth?.api.strategy === "bearer") {
    paths.push(["auth.api.loginPath", answers.auth.api.loginPath]);
  }
  if (answers.auth?.browser.strategy === "nextAuth") {
    paths.push(
      ["auth.browser.csrfPath", answers.auth.browser.csrfPath],
      ["auth.browser.callbackPath", answers.auth.browser.callbackPath],
      ["auth.browser.landingPath", answers.auth.browser.landingPath],
    );
  }
  for (const [key, value] of paths) {
    const error = isPath(value);
    if (error) errors.push(`${key}: ${error}`);
  }

  const agents = answers.agents ?? [];
  const pipeline = BUILD_PIPELINE.filter((agent) =>
    agents.includes(agent as (typeof AGENTS)[number]),
  );
  if (pipeline.length > 0 && pipeline.length < BUILD_PIPELINE.length) {
    errors.push(
      `agents: ${BUILD_PIPELINE.join(", ")} hand work to each other; choose all three or none`,
    );
  }

  return errors;
}

// The answers as setup accepts them, or the reasons it does not.
export function answerErrors(answers: unknown): string[] {
  try {
    validateSchema(answersSchema, answers);
  } catch (error) {
    return describeSchemaError(error).split("\n");
  }

  return semanticErrors(answers).map((error) => `  - ${error}`);
}

export function roleEnvPrefix(role: string): string {
  return role.replace(/([a-z0-9])([A-Z])/g, "$1_$2").toUpperCase();
}

export function buildFrameworkConfig(answers: Answers): FrameworkConfig {
  return {
    ...(answers.requirementsDoc
      ? { requirementsDoc: answers.requirementsDoc }
      : {}),
    ...(answers.uiScenariosDoc
      ? { uiScenariosDoc: answers.uiScenariosDoc }
      : {}),
    modules: answers.modules,
    browsers: answers.browsers,
    execution: { ciRetries: 2, ciWorkers: "50%" },
    auth: answers.auth ?? {
      api: { strategy: "none" },
      browser: { strategy: "none" },
    },
    roles: Object.fromEntries(
      (answers.roles ?? []).map((role) => [
        role,
        {
          usernameEnv: `${roleEnvPrefix(role)}_USERNAME`,
          passwordEnv: `${roleEnvPrefix(role)}_PASSWORD`,
        },
      ]),
    ),
  };
}

export function defaultEnvironment(answers: Answers): string {
  return "staging" in answers.environments
    ? "staging"
    : Object.keys(answers.environments)[0];
}

export function buildEnvExample(
  answers: Answers,
  config: FrameworkConfig,
): string {
  const lines = [
    "# Copy to .env and fill in. .env is git-ignored.",
    `TEST_ENV=${defaultEnvironment(answers)}`,
    "",
  ];

  if (Object.keys(config.roles).length === 0) {
    lines.push(
      "# Test accounts: add one USERNAME/PASSWORD pair per role after configuring",
      "# login and roles (README.md, Configure login).",
    );
  }

  for (const [role, { usernameEnv, passwordEnv }] of Object.entries(
    config.roles,
  )) {
    lines.push(
      `# ${role} role test account`,
      `${usernameEnv}=`,
      `${passwordEnv}=`,
    );
  }

  if (answers.modules.database) {
    lines.push("", "# Dedicated test database only", "DATABASE_URL=");
  }

  return `${lines.join("\n")}\n`;
}

export type ProjectFiles = {
  reference: string[];
  templateOnly: string[];
  scripts: string[];
  performance: { files: string[]; devDependencies: string[] };
};

export const within = (file: string, entries: string[]) =>
  entries.some((entry) => file === entry || file.startsWith(`${entry}/`));

// Empty folders for the enabled test types, each with a README naming what
// belongs there and the golden templates that start it, so the layout is
// visible before the first test exists.
const SKELETON: Record<(typeof MODULES)[number], string[]> = {
  api: [
    "src/api/constants",
    "src/api/schemas",
    "src/api/clients",
    "src/data",
    "tests/api",
  ],
  ui: ["src/pages", "src/components", "src/mocks", "tests/ui"],
  smoke: ["src/pages", "tests/smoke"],
  accessibility: ["src/pages", "tests/accessibility"],
  database: ["src/database/clients", "tests/database"],
  visual: ["src/pages", "tests/visual"],
  performance: ["src/pages", "tests/performance", "tests/performance/k6"],
};

const FOLDER_PURPOSE: Record<string, string> = {
  "src/api/constants":
    "Domain constants such as supported statuses, with derived types.",
  "src/api/schemas":
    "TypeBox request and response schemas: the provider contracts.",
  "src/api/clients":
    "API clients: HTTP requests and raw responses, no assertions.",
  "src/data": "Factories: valid default payloads with overrides.",
  "src/pages":
    "Page Objects: locators and user actions for one page, no assertions.",
  "src/components": "Component Objects for shared UI parts such as navigation.",
  "src/mocks": "Network mocks for the states a scenario needs.",
  "src/database/clients":
    "Domain database clients: parameterized SQL and record mapping.",
  "tests/api": "API specs.",
  "tests/ui": "UI specs.",
  "tests/smoke":
    "Smoke specs: short checks that the main pages load. Follow the ui-spec template.",
  "tests/accessibility":
    "Accessibility specs using the accessibility fixtures and the central WCAG policy.",
  "tests/database":
    "Database specs (only where the environment allows database access).",
  "tests/visual": "Visual regression specs with toHaveScreenshot().",
  "tests/performance": "Lighthouse browser performance specs.",
  "tests/performance/k6": "k6 API workloads.",
};

function skeletonReadme(
  folder: string,
  index: { templates: { id: string; need: string; output: string }[] },
): string {
  const templates = index.templates.filter(
    (template) =>
      template.output.slice(0, template.output.lastIndexOf("/")) === folder,
  );

  return [
    `# ${folder}`,
    "",
    FOLDER_PURPOSE[folder],
    "",
    ...(templates.length > 0
      ? [
          "Start from these golden templates (`framework/templates/index.json`):",
          "",
          ...templates.map(({ id, need }) => `- \`${id}\`: ${need}`),
        ]
      : []),
    "",
  ].join("\n");
}

// Versions are pinned: the servers run through npx on the developer's machine.
const PLAYWRIGHT_MCP = "@playwright/mcp@0.0.83";
const OPENAPI_MCP = "@ivotoby/openapi-mcp-server@1.16.1";

// MCP servers for AI tools in the IDE: OpenAPI dynamic mode exposes contract
// discovery and invocation tools; AGENTS.md gates invocation by environment.
function mcpServers(answers: Answers): Record<string, string[]> {
  const servers: Record<string, string[]> = {};
  const environment = answers.environments[defaultEnvironment(answers)];

  if (BROWSER_MODULES.some((module) => answers.modules[module])) {
    servers.playwright = ["-y", PLAYWRIGHT_MCP];
  }
  if (
    answers.modules.api &&
    environment.apiBaseUrl &&
    environment.openApiUrl &&
    environment.allow.interactiveDiscovery === true
  ) {
    servers.openapi = [
      "-y",
      OPENAPI_MCP,
      "--api-base-url",
      environment.apiBaseUrl,
      "--openapi-spec",
      environment.openApiUrl,
      "--tools",
      "dynamic",
    ];
  }

  return servers;
}

function aiToolsSection(agents: string[]): string {
  const included =
    agents.length > 0
      ? `This project includes GitHub Copilot agents in \`.github/agents/\`: ${agents.map((agent) => `\`${agent}\``).join(", ")}. Select one in Copilot Chat; each file says what it does and what it changes.`
      : "No GitHub Copilot agents were chosen when this project was created. The planner, builder and reviewer (one choice), the test runner and the CI failure analyst can be included by creating the project again with them, with setup or the configurator; their files go into `.github/agents/`.";

  return `\`AGENTS.md\` holds the rules, and \`.github/copilot-instructions.md\` makes GitHub Copilot load it; \`.vscode/mcp.json\` adds the Playwright and OpenAPI MCP servers when the project has them. The checks in \`AGENTS.md\` and CI apply to every change, whoever wrote it.

${included}`;
}

function buildReadme(
  answers: Answers,
  config: FrameworkConfig,
  agents: string[],
): string {
  const scripts = Object.entries(testScripts(config));
  const width = Math.max(
    "npx playwright test".length,
    ...scripts.map(([name]) => `npm run ${name}`.length),
  );
  const command = (text: string, comment: string) =>
    `${text.padEnd(width + 2)}# ${comment}`;
  const testCommands = [
    command("npx playwright test", "all enabled projects"),
    ...scripts.map(([name, script]) =>
      command(`npm run ${name}`, script.replace("playwright test ", "")),
    ),
  ].join("\n");

  return `# ${answers.appName}

Playwright tests created from the SDET framework template.

## Getting started

1. \`npm run doctor\`: checks the configuration and that the application is reachable.
2. Optional: register a dedicated test account in the application, then run \`npm run onboard\` to put it into \`.env\` (stage 2 of \`./install.sh\` offers the same step). You can skip this and fill in \`.env\` later.
3. Configure login: see [Configure login](#configure-login).
4. Put the accounts of any further roles into \`.env\` yourself (never into a prompt), then run \`npm run doctor\`, which signs in with them, and \`npm run qa:sync-ci-secrets\`.
5. Write the first tests: follow \`AGENTS.md\`, starting from the golden template for each file (\`framework/templates/index.json\`). Any AI tool in your IDE can follow \`AGENTS.md\`; see [Writing tests with AI tools](#writing-tests-with-ai-tools).
6. Register reviewed tests in \`config/approved-examples.json\`: they become the examples for the next tests.

## Configure login

Setup configures no login, because it depends on the application. Set it in \`config/framework.config.ts\`:

- \`auth.api\`: \`{ strategy: "bearer", loginPath, usernameField, passwordField, tokenField }\` when the API issues a bearer token from a login request, otherwise \`{ strategy: "none" }\`.
- \`auth.browser\`: \`{ strategy: "nextAuth", csrfPath, callbackPath, landingPath, usernameField, passwordField }\` for a NextAuth credentials login, otherwise \`{ strategy: "none" }\`.
- \`roles\`: one entry per role, naming its \`.env\` variables, such as \`user: { usernameEnv: "USER_USERNAME", passwordEnv: "USER_PASSWORD" }\` (\`npm run onboard\` adds the first one).

Take the paths and field names from the API contract or the login request the application sends. Then run \`npm run doctor\`: it signs in with every role and reports what fails.

## Structure

| Folder | Owner | Contents |
| --- | --- | --- |
| \`framework/\` | template | \`core/\` (the framework, imported as \`@framework/...\`), \`templates/\`, \`tools/\`, \`docs/\`; change it in the template |
| \`src/\` | this project | schemas, API clients, factories, Page Objects, components, mocks, fixtures (imported as \`@app/...\`) |
| \`tests/\` | this project | specs |
| \`config/\` | this project | \`framework.config.ts\`, environments, \`approved-examples.json\` |

Each folder under \`src/\` and \`tests/\` has a README naming what belongs there and its golden templates.

## Writing tests with AI tools

${aiToolsSection(agents)}

## Commands

\`\`\`bash
./install.sh                  # teammates: dependencies, .env, browsers, doctor, test account
npm run onboard               # test account into .env (optional; rerunnable)
npm run doctor                # configuration, reachability and login checks
npm run lint:architecture     # layer and import rules
npm run qa:sync-ci-secrets    # role and database secrets for GitHub Actions
\`\`\`

## Running tests

Each enabled module and browser has its own script:

\`\`\`bash
${testCommands}
\`\`\`

If you enable a module or browser later in \`config/framework.config.ts\`, add its script the same way.

Rules for people and AI tools: [AGENTS.md](AGENTS.md).
`;
}

function approvedExamples(): string {
  return `${JSON.stringify(
    {
      $comment:
        "Project golden examples: reviewed, green implementations from this project. They take precedence over the generic templates in framework/templates/index.json for the same responsibility. Project-owned; template updates never change this file.",
      examples: [],
    },
    null,
    2,
  )}\n`;
}

// Where the project's files come from. setup.ts reads the template folder;
// the configurator reads a bundle of the same files.
export type TemplateSource = {
  // Every template file a project may contain, by its template path: the
  // project files, the starter files and the example agents.
  files: Record<string, string>;
  // The template paths of the project files (project-files.json applied).
  projectFiles: string[];
  // Template files that are executable (git mode 100755).
  executable: string[];
  exclusions: ProjectFiles;
  // package-lock.json for a package.json without the given devDependencies.
  packageLock: (
    packageJson: string,
    removedPackages: string[],
  ) => Promise<string>;
};

// Formats a file as prettier does for its path.
export type Formatter = (content: string, file: string) => Promise<string>;

export type GeneratedProject = {
  answers: Answers;
  config: FrameworkConfig;
  secretNames: string[];
  // File contents by project path.
  files: Record<string, string>;
  executable: string[];
};

export async function generateProject(
  answers: Answers,
  source: TemplateSource,
  format: Formatter,
): Promise<GeneratedProject> {
  const config = buildFrameworkConfig(answers);
  validateSchema(frameworkConfigSchema, config);

  const files: Record<string, string> = {};
  const executable = new Set<string>();
  const copy = (from: string, to = from) => {
    files[to] = source.files[from];
    if (source.executable.includes(from)) executable.add(to);
  };
  const write = async (file: string, content: string) => {
    files[file] = await format(content, file);
  };

  for (const file of source.projectFiles) copy(file);

  const starterPrefix = `${STARTER_DIR}/`;
  for (const file of Object.keys(source.files).filter((file) =>
    file.startsWith(starterPrefix),
  )) {
    copy(file, file.slice(starterPrefix.length));
  }

  if (!answers.modules.performance) {
    for (const file of Object.keys(files)) {
      if (
        file === ".github/workflows/performance.yml" ||
        within(file, source.exclusions.performance.files)
      ) {
        delete files[file];
        executable.delete(file);
      }
    }
  }

  for (const agent of answers.agents ?? []) {
    copy(`${AGENTS_DIR}/${agent}.agent.md`, `.github/agents/${agent}.agent.md`);
  }

  const secretNames = ciSecretNames(config);
  for (const file of Object.keys(files)) {
    if (file.startsWith(".github/workflows/")) {
      files[file] = syncSecretsBlock(files[file], secretNames);
    }
  }

  const servers = Object.entries(mcpServers(answers));
  if (servers.length > 0) {
    await write(
      ".vscode/mcp.json",
      JSON.stringify({
        servers: Object.fromEntries(
          servers.map(([name, args]) => [
            name,
            { type: "stdio", command: "npx", args },
          ]),
        ),
      }),
    );
  }

  const index = JSON.parse(files["framework/templates/index.json"]);
  const folders = new Set(
    MODULES.filter((module) => answers.modules[module]).flatMap(
      (module) => SKELETON[module],
    ),
  );
  for (const folder of folders) {
    await write(`${folder}/README.md`, skeletonReadme(folder, index));
  }

  await write(
    "config/environments/environments.json",
    JSON.stringify(answers.environments),
  );
  await write(
    "config/framework.config.ts",
    `import { defineFrameworkConfig } from "../framework/core/config/frameworkConfigSchema";\n\nexport default defineFrameworkConfig(${JSON.stringify(config)});\n`,
  );
  files["config/approved-examples.json"] = approvedExamples();
  await write("README.md", buildReadme(answers, config, answers.agents ?? []));

  // Without the performance module, the Lighthouse packages (and their audit
  // warnings) stay out of the project, and package-lock.json is regenerated so
  // npm ci still matches package.json. Category scripts (test:api, test:ui,
  // test:chromium...) are added for the enabled modules and browsers only.
  const packageJson = JSON.parse(files["package.json"]);
  const removedPackages = answers.modules.performance
    ? []
    : source.exclusions.performance.devDependencies;

  packageJson.name = answers.appName;
  for (const script of source.exclusions.scripts) {
    delete packageJson.scripts[script];
  }
  packageJson.scripts = withTestScripts(packageJson.scripts, config);
  for (const name of removedPackages) delete packageJson.devDependencies[name];
  files["package.json"] = `${JSON.stringify(packageJson, null, 2)}\n`;

  const lock = JSON.parse(
    removedPackages.length > 0
      ? await source.packageLock(files["package.json"], removedPackages)
      : files["package-lock.json"],
  );
  lock.name = answers.appName;
  if (lock.packages?.[""]) lock.packages[""].name = answers.appName;
  files["package-lock.json"] = `${JSON.stringify(lock, null, 2)}\n`;

  files[".env.example"] = buildEnvExample(answers, config);

  return {
    answers,
    config,
    secretNames,
    files,
    executable: [...executable].sort(),
  };
}
