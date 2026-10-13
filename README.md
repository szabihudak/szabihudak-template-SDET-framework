# Playwright Enterprise Test Framework Template

A Playwright + TypeScript test automation template for API, UI, database, accessibility, visual regression, and performance testing. It provides a validated framework core, golden templates that humans and AI tools follow, and quality gates that enforce the architecture.

The template was built and validated against [UPEX DOJO](https://dojo.upexgalaxy.com), which remains the reference implementation for its golden templates ([ADR-007](framework/docs/adr/ADR-007-reusable-template-architecture.md)).

## Quick Start

Requirements: Node.js 22.19 or newer (`node -v`; with nvm: `nvm install 22 && nvm use 22`, the repository ships an `.nvmrc`), npm 11.19.1 (`npx npm@11.19.1 ci` if your npm differs), Git.

Setup asks only about your application, with menus for every choice (arrow keys, space to select, Enter to confirm): project name, test types, browsers, environments (staging, local) with their URLs and permissions, a public OpenAPI (Swagger) URL when API tests are enabled (optional), and your AI coding tool (GitHub Copilot, Claude Code, both or none). An interactive run needs a terminal; scripts use `--answers`. It asks nothing about login: the test account is the optional stage 2 below, and the login method is configured afterwards, together with the first tests ([First Tests](#first-tests)). The only secret it asks for is the test database URL, when an environment allows database access: the input is masked and written only to the git-ignored `.env`. Test-account credentials belong in `.env` and in GitHub secrets, never in prompts.

On macOS or Linux, one script creates a new project next to the template, in two stages. Stage 1, framework setup, asks the setup questions, installs the project and runs `npm run doctor`. Stage 2, first tests, is optional: it asks whether to set up the test account now and, if so, for its username and password (masked). Use a dedicated test account registered in the application, never a personal or production login. The account becomes the `user` role (`USER_USERNAME` and `USER_PASSWORD`), its values go only into the git-ignored `.env`, and doctor runs again with it. Skip it, or leave a field empty, and the installer says how to add it later: `npm run onboard` runs stage 2 on its own at any time. Stage 2 never asks anything without a terminal, in CI or with `--answers`; CI takes the credentials from its secrets. On a terminal the installer shows the two stages and their steps as a small flow, with the line where the installer stops and your IDE takes over, and ends with a finish box. Every run ends with the next steps for the AI tool you chose, for example `cd ../<project name>`, `code .`, starting the MCP servers and `/first-tests` in Copilot Chat (agent mode), with `npm run onboard` first if you skipped stage 2. On a terminal the output uses text colors (none with `NO_COLOR`) and a few emoji marks, shown as ASCII (`[x]`, `[-]`, `[!]`, `>>`, `->`, `\m/`) when the locale is not UTF-8.

```bash
git clone https://github.com/szabihudak/szabihudak-template-SDET-framework.git
cd szabihudak-template-SDET-framework
./install.sh   # stage 1: questions → ../<project name> with its own git → npm ci → browsers → .env → doctor
               # stage 2 (optional): test account → .env
cd ../<project name>
# then: /first-tests in your AI tool (see First Tests below)
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

Setup adds an empty application layer and generic GitHub Actions workflows; it installs no tests. With the database module enabled, it warns when no environment allows database access or `DATABASE_URL` is empty. It finishes by listing the repository variable (`TEST_ENV`) and secrets (`DATABASE_URL` when the database module is enabled) to add under **Settings → Secrets and variables → Actions**. The chosen AI tool gets a `/first-tests` command (`.github/prompts/` for Copilot, `.claude/commands/` and `CLAUDE.md` for Claude Code) and an MCP configuration (`.vscode/mcp.json` or `.mcp.json`) with Playwright MCP for browser tests and the OpenAPI MCP server when an OpenAPI URL was given, so `/first-tests` can discover the login flow and the API contract itself; every tool follows `AGENTS.md`.

Once login and roles are configured in `config/framework.config.ts`, add the role accounts to `.env` (`npm run onboard` asks for them), run `npm run doctor` (it checks that each role logs in) and `npm run qa:sync-ci-secrets` (it adds the role secrets to the local workflow files and lists the secrets to create in GitHub; it uploads nothing). `/first-tests` runs both itself after configuring the login, and does not ask for an account that is already in `.env`. CI skips Playwright projects that have no tests yet.

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

For API-only testing, enable only the `api` module: setup then skips browser questions and CI runs only the `api` project.

`config/environments/environments.json` defines each target environment:

```json
"staging": {
  "webBaseUrl": "https://staging.example.com",
  "apiBaseUrl": "https://staging.example.com/api",
  "allow": { "database": false, "destructive": false, "performance": true }
}
```

`TEST_ENV` is required; there is no default target. `allow` controls direct database access, destructive database reset and performance measurement, and is enforced by the framework.

## First Tests

After `npm run doctor` passes, two commands configure the login and create the first tests: at most 2 API tests and at most 2 UI tests, which become the project's own golden examples. Setup installs them for the AI tool you chose (Claude Code: `.claude/commands/`, GitHub Copilot Chat in agent mode: `.github/prompts/`).

| Command              | What it does                                                                                                                                                                            | Changes files |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------- |
| `/first-tests`       | Reads the project configuration, the API contract (OpenAPI MCP) and the login flow and pages (Playwright MCP), then proposes the login setup and the tests, and stops for your approval | No            |
| `/first-tests-build` | Implements the approved proposal from the golden templates, checks the login with `npm run doctor` and runs the validation commands                                                     | Yes           |

Both commands run the task file `framework/prompts/first-tests.md` with `AGENTS.md` in the AI's context: Claude Code loads it through `CLAUDE.md`, and the Copilot prompts link it. Edit tools are disabled while `/first-tests` runs. Write hints after the command to skip questions, for example `/first-tests UI: open the events list and one event; API: events list and get one`. Without a supported tool, give your AI tool `AGENTS.md` and `framework/prompts/first-tests.md` and approve the proposal before it builds.

Credentials never go into a prompt or the chat. The AI reads only variable names from `.env`; `npm run doctor` tells it whether each role's account is set, and `npm run onboard` asks for a missing one (masked). Start the MCP servers when your tool asks; without them the AI reads the contract over HTTP.

Afterwards, register the accepted tests in `config/approved-examples.json`. From then on they are the first reference for the same responsibility:

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

With an AI tool, follow [AGENTS.md](AGENTS.md); for the first tests of a new project use `/first-tests` ([First Tests](#first-tests)).

## Commands

| Command                        | Purpose                                                                     |
| ------------------------------ | --------------------------------------------------------------------------- |
| `./install.sh`                 | Create a project (template) or install it (project)                         |
| `npm run setup`                | Create a project folder for an application                                  |
| `npm run doctor`               | Check configuration, reachability, credentials and login                    |
| `npm run onboard`              | Stage 2: put the test account into `.env` (optional, rerunnable)            |
| `npm run qa:sync-ci-secrets`   | Add the configured role and database secrets to the workflows               |
| `npm run lint:architecture`    | Enforce layer and import rules                                              |
| `npm run qa:templates:check`   | Verify golden templates, catalogue and snippets                             |
| `npm run qa:templates:build`   | Regenerate the catalogue and snippets from `framework/templates/index.json` |
| `npm run qa:templates:extract` | Re-extract templates after an intended canonical change                     |
| `npm run qa:selftest`          | Create projects in temporary folders and verify them                        |
| `npm run db:test:reset`        | Reset the dedicated test database (reference implementation)                |

## Documentation

- [AGENTS.md](AGENTS.md): rules for humans and AI tools, and what to read for each kind of change
- [framework/docs/ARCHITECTURE.md](framework/docs/ARCHITECTURE.md): how the framework is structured and why (for framework and architectural changes)
- [framework/docs/TESTING_STANDARDS.md](framework/docs/TESTING_STANDARDS.md): implementation standards per layer and test type
- [framework/docs/adr/ADR-008-ai-assisted-engineering.md](framework/docs/adr/ADR-008-ai-assisted-engineering.md): how AI agents are used: review first, evidence by source
- [framework/docs/adr/](framework/docs/adr): architecture decisions

## Reference Implementation

The UPEX DOJO implementation in `src/` and `tests/` is the canonical source of the golden templates. The original framework before the template restructuring is preserved on `main` at commit `06e4b5f` (tag `upex-original-v1.0`).
