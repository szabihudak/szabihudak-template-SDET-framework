# Playwright Enterprise Test Framework Template

A Playwright + TypeScript test automation template for API, UI, database, accessibility, visual regression, and performance testing. It provides a validated framework core, golden templates that humans and AI tools follow, and quality gates that enforce the architecture.

The template was built and validated against [UPEX DOJO](https://dojo.upexgalaxy.com), which remains the reference implementation for its golden templates ([ADR-007](framework/docs/adr/ADR-007-reusable-template-architecture.md)).

## Quick Start

Requirements: Node.js 22.19 or newer (`node -v`; with nvm: `nvm install 22 && nvm use 22`, the repository ships an `.nvmrc`), npm 11.19.1 (`npx npm@11.19.1 ci` if your npm differs), Git.

Setup asks only about your application, with menus for every choice (arrow keys, space to select, Enter to confirm): project name, test types, browsers, environments (staging, local) with their URLs and permissions, and a public OpenAPI (Swagger) URL when API tests are enabled (optional). An interactive run needs a terminal; scripts use `--answers`. It asks nothing about login: the test account is the optional stage 2 below, and the login method is configured afterwards, together with the first tests ([Testing with the Agents](#testing-with-the-agents)). The only secret it asks for is the test database URL, when an environment allows database access: the input is masked and written only to the git-ignored `.env`. Test-account credentials belong in `.env` and in GitHub secrets, never in prompts.

On macOS or Linux, one script creates a new project next to the template, in two stages. Stage 1, framework setup, asks the setup questions, installs the project and runs `npm run doctor`. Stage 2, first tests, is optional: it asks whether to set up the test account now and, if so, for its username and password (masked). Use a dedicated test account registered in the application, never a personal or production login. The account becomes the `user` role (`USER_USERNAME` and `USER_PASSWORD`), its values go only into the git-ignored `.env`, and doctor runs again with it. Skip it, or leave a field empty, and the installer says how to add it later: `npm run onboard` runs stage 2 on its own at any time. Stage 2 never asks anything without a terminal, in CI or with `--answers`; CI takes the credentials from its secrets. On a terminal the installer shows the two stages and their steps as a small flow, with the line where the installer stops and your IDE takes over, and ends with a finish box. Every run ends with the next steps, for example `cd ../<project name>`, `code .`, starting the MCP servers and selecting the **test-planner** agent in Copilot Chat, with `npm run onboard` first if you skipped stage 2. On a terminal the output uses text colors (none with `NO_COLOR`) and a few emoji marks, shown as ASCII (`[x]`, `[-]`, `[!]`, `>>`, `->`, `\m/`) when the locale is not UTF-8.

```bash
git clone https://github.com/szabihudak/szabihudak-template-SDET-framework.git
cd szabihudak-template-SDET-framework
./install.sh   # stage 1: questions → ../<project name> with its own git → npm ci → browsers → .env → doctor
               # stage 2 (optional): test account → .env
cd ../<project name>
# then: open it in VS Code and select the test-planner agent in Copilot Chat
```

The template folder stays unchanged, so the next project starts from the same clone. The project contains:

```text
<project name>/
├── framework/     template-owned: core/ (the framework), templates/, tools/, docs/
├── src/           application layer: schemas, clients, factories, Page Objects, fixtures
├── tests/         specs
├── config/        framework.config.ts, environments, approved-examples.json
├── .github/       CI workflows and AI tool instructions
├── AGENTS.md, README.md, install.sh, .env
└── package.json, playwright.config.ts, tsconfig.json
```

It leaves out the UPEX reference implementation, the setup tooling and the workflows of modules you did not enable. Without performance tests it also leaves out the Lighthouse runner and its packages (`@lhci/cli`, `lighthouse`, `chrome-launcher`), which make up most of the install size and of the `npm audit` warnings. A teammate who clones the project runs `./install.sh` there: it skips the questions, creates `.env` from `.env.example`, installs the configured browsers and offers stage 2 for their own copy of the test accounts.

Without the script, for example on Windows: `npm ci`, `npm run setup`, then `npm ci`, `npx playwright install --with-deps` and `npm run doctor` in the new project folder. `npm run setup -- --target <folder>` chooses another location; `--in-place` turns the current folder into the project, for a repository created with GitHub's **Use this template** (it refuses to run on uncommitted changes unless you pass `--force`). For non-interactive use: `--answers answers.json` (see `framework/setup/selftest/answers-minimal.json`); the database URL then comes from the `DATABASE_URL` environment variable.

Setup adds an empty application layer and generic GitHub Actions workflows; it installs no tests. With the database module enabled, it warns when no environment allows database access or `DATABASE_URL` is empty. It finishes by listing the repository variable (`TEST_ENV`) and secrets (`DATABASE_URL` when the database module is enabled) to add under **Settings → Secrets and variables → Actions**. Every project gets the GitHub Copilot agents (`.github/agents/`) and an MCP configuration (`.vscode/mcp.json`) with Playwright MCP for browser tests. The OpenAPI MCP server is installed only when the default environment has an OpenAPI URL and `allow.interactiveDiscovery` is enabled; otherwise the planner can read the contract without endpoint invocation. The agents follow `AGENTS.md` ([ADR-009](framework/docs/adr/ADR-009-copilot-agent-pipeline.md)).

Once login and roles are configured in `config/framework.config.ts`, add the role accounts to `.env` (`npm run onboard` asks for them), run `npm run doctor` (it checks that each role logs in) and `npm run qa:sync-ci-secrets` (it adds the role secrets to the local workflow files and lists the secrets to create in GitHub; it uploads nothing). The test-builder agent runs both itself after configuring the login, and does not ask for an account that is already in `.env`. CI skips Playwright projects that have no tests yet.

## What You Get

| Capability             | Where                                                                                                                                                              |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Framework core         | `framework/core/` (imported as `@framework/...`): environment, config, authentication, fixtures, reporters, schema validation, accessibility, visual, database, AI |
| Your application layer | `src/` (imported as `@app/...`): schemas, API clients, factories, Page Objects, components, mocks, fixtures                                                        |
| Golden templates       | `framework/templates/` catalogued in `framework/templates/index.json` and [README](framework/templates/README.md); VS Code snippets `qa-<id>`                      |
| Configuration          | `config/framework.config.ts`, `config/environments/environments.json`                                                                                              |
| Performance            | k6 under `tests/performance/k6/`, Lighthouse under `framework/core/performance/lighthouse/`                                                                        |
| CI                     | `.github/workflows/`: quality gate, one test job per enabled project (planned from the config, run in the official Playwright image), manual performance workflow  |

## Configuration

`config/framework.config.ts` (validated at load time):

- `modules`: enables Playwright projects (`api`, `ui`, `smoke`, `database`, `accessibility`, `visual`, `performance`).
- `browsers`: browsers for UI and smoke tests.
- `execution`: CI retries and workers.
- `auth.api`: `bearer` token login or `none`.
- `auth.browser`: `nextAuth` credentials session or `none`.
- `roles`: role names mapped to the environment variables holding their test-account credentials. The same credentials provide API bearer tokens (`apiTokenFor(role)` fixture) and browser sessions (`authenticatedPageFor` fixture).
- `requirementsDoc` (optional): HTTP(S) URL or repository-relative path for requirements or acceptance criteria; when absent, the planner uses exploratory mode.

For API-only testing, enable only the `api` module: setup then skips browser questions and CI runs only the `api` project.

`config/environments/environments.json` defines each target environment:

```json
"staging": {
  "webBaseUrl": "https://staging.example.com",
  "apiBaseUrl": "https://staging.example.com/api",
  "allow": { "database": false, "destructive": false, "performance": true, "interactiveDiscovery": false }
}
```

`TEST_ENV` is required; there is no default target. `allow` controls direct database access, destructive database reset, performance measurement and whether planner discovery may submit non-destructive API/UI interactions. The optional `requirementsDoc` setting in `config/framework.config.ts` points to an HTTP(S) requirements URL or repository-relative document path.

## Testing with the Agents

Generated projects use four GitHub Copilot agents in VS Code ([ADR-009](framework/docs/adr/ADR-009-copilot-agent-pipeline.md)). Select **test-planner** in Copilot Chat and describe the component or tests. It uses configured requirements when present; otherwise it creates explicitly labeled exploratory characterization cases from permitted API/UI discovery. It writes canonical `test-plans/<feature>/plan.json` and generates the human-readable `plan.md` beside it only after validation passes.

| Agent                  | What it does                                                                                                                                                      | Changes files       |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------- |
| **test-planner**       | Uses requirements or exploratory evidence, then writes a validated JSON plan and generated Markdown view; stops for human approval                                | Plan artifacts only |
| **test-builder**       | Implements the Approved scope from the approved examples, golden templates and standards, checks the login with `npm run doctor` and runs the validation commands | Yes                 |
| **test-plan-reviewer** | Subagent of the planner: reviews the plan's evidence, coverage and scope before you see it, and writes `plan-review.json`                                         | Its report only     |
| **test-validator**     | Subagent of the builder: reviews the implementation against the approved plan and the build report, and writes `validation-report.json`                           | Its report only     |

```text
test-planner ⇄ test-plan-reviewer ─(PASS)─▶ you approve: [Build the approved proposal]
  ─▶ test-builder (technical gates, build-report.json) ⇄ test-validator
       implementation findings → builder fixes · plan findings → [Revise the plan] → test-planner
       PASS → you review: [Register approved examples]
```

You make two decisions: approving the reviewed plan and accepting the verified tests; each is a button that waits for your click. The reports are stored under `pipeline-runs/<feature>/<plan-sha256>/` and checked with `npm run qa:pipeline`. The planner may edit plan artifacts only by instruction, and the verifiers write only their report. API invocation and UI form submission require `allow.interactiveDiscovery: true` for the selected environment; destructive and irreversible actions are prohibited. The task logic lives in `framework/prompts/planner.md`, `plan-reviewer.md`, `builder.md` and `validator.md`, and every agent follows `AGENTS.md`.

Credentials never go into a prompt or the chat. The agents read only variable names from `.env`; `npm run doctor` tells them whether each role's account is set, and `npm run onboard` asks for a missing one (masked). Start the MCP servers when VS Code asks; without them the planner reads the contract over HTTP.

When you accept the tests, **Register approved examples** adds them to `config/approved-examples.json`. From then on they are the first reference for the same responsibility:

```json
{
  "examples": [
    {
      "id": "api-spec",
      "need": "Orders API contract and authorization",
      "file": "tests/api/orders.spec.ts"
    }
  ]
}
```

## Writing Tests

1. Find the golden example: `config/approved-examples.json` (your reviewed examples) first, then `framework/templates/index.json`.
2. Copy the template (or type `qa-<id>` in VS Code), replace the tokens, adapt fields and locators.
3. Validate:

```bash
npx prettier --check .
npm run typecheck
npm run lint:architecture
npm run qa:templates:check
TEST_ENV=staging npx playwright test --project=api
```

With the Copilot agents, start with **test-planner** ([Testing with the Agents](#testing-with-the-agents)); any tool follows [AGENTS.md](AGENTS.md).

## Commands

| Command                                  | Purpose                                                                     |
| ---------------------------------------- | --------------------------------------------------------------------------- |
| `./install.sh`                           | Create a project (template) or install it (project)                         |
| `npm run setup`                          | Create a project folder for an application                                  |
| `npm run doctor`                         | Check configuration, reachability, credentials and login                    |
| `npm run onboard`                        | Stage 2: put the test account into `.env` (optional, rerunnable)            |
| `npm run qa:sync-ci-secrets`             | Add the configured role and database secrets to the workflows               |
| `npm run lint:architecture`              | Enforce layer and import rules                                              |
| `npm run qa:plan -- refresh <plan.json>` | Validate a plan JSON and generate its Markdown view                         |
| `npm run qa:plan -- check-all`           | Validate every plan and verify generated Markdown is in sync                |
| `npm run qa:templates:check`             | Verify golden templates, catalogue and snippets                             |
| `npm run qa:templates:build`             | Regenerate the catalogue and snippets from `framework/templates/index.json` |
| `npm run qa:templates:extract`           | Re-extract templates after an intended canonical change                     |
| `npm run qa:selftest`                    | Create projects in temporary folders and verify them                        |
| `npm run db:test:reset`                  | Reset the dedicated test database (reference implementation)                |

## Documentation

- [AGENTS.md](AGENTS.md): rules for humans and AI tools, and what to read for each kind of change
- [framework/docs/ARCHITECTURE.md](framework/docs/ARCHITECTURE.md): how the framework is structured and why (for framework and architectural changes)
- [framework/docs/TESTING_STANDARDS.md](framework/docs/TESTING_STANDARDS.md): implementation standards per layer and test type
- [framework/docs/adr/ADR-008-ai-assisted-engineering.md](framework/docs/adr/ADR-008-ai-assisted-engineering.md): how AI agents are used: review first, evidence by source
- [framework/docs/adr/ADR-009-copilot-agent-pipeline.md](framework/docs/adr/ADR-009-copilot-agent-pipeline.md): the Copilot planner, builder and validator agents
- [framework/docs/adr/](framework/docs/adr): architecture decisions

## Reference Implementation

The UPEX DOJO implementation in `src/` and `tests/` is the canonical source of the golden templates. The original framework before the template restructuring is preserved on `main` at commit `06e4b5f` (tag `upex-original-v1.0`).
