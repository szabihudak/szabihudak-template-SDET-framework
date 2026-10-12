# Playwright Enterprise Test Framework Template

A Playwright + TypeScript test automation template for API, UI, database, accessibility, visual regression, and performance testing. It provides a validated framework core, golden templates that humans and AI tools follow, and quality gates that enforce the architecture.

The template was built and validated against [UPEX DOJO](https://dojo.upexgalaxy.com), which remains the reference implementation for its golden templates ([ADR-007](template-fw/docs/adr/ADR-007-reusable-template-architecture.md)).

## Quick Start

Requirements: Node.js 22.19 or newer (`node -v`; with nvm: `nvm install 22 && nvm use 22`, the repository ships an `.nvmrc`), npm 11.19.1 (`npx npm@11.19.1 ci` if your npm differs), Git.

Setup asks only about your application: name, modules, browsers, staging and local URLs (either can be skipped with `-`), environment permissions and your AI coding tool (GitHub Copilot, Claude Code, both or none). It asks nothing about login: login and roles are configured afterwards, together with the first tests ([template-fw/docs/FIRST_TESTS_PROMPT.md](template-fw/docs/FIRST_TESTS_PROMPT.md)). The only secret it asks for is the test database URL, when an environment allows database access: the input is hidden and written only to the git-ignored `.env`. Test-account credentials belong in `.env` and in GitHub secrets, never in prompts.

On macOS or Linux, one script creates a new project next to the template:

```bash
git clone https://github.com/szabihudak/szabihudak-template-SDET-framework.git
cd szabihudak-template-SDET-framework
./install.sh   # questions → ../<project name> with its own git → npm ci → browsers → .env → doctor
cd ../<project name>
# then: configure login and roles and write the first tests (/first-tests, or template-fw/docs/FIRST_TESTS_PROMPT.md)
```

The template folder stays unchanged, so the next project starts from the same clone. The project contains:

```text
<project name>/
├── template-fw/   framework core, golden templates, tools, docs (template-owned)
├── src/           application layer: schemas, clients, factories, Page Objects, fixtures
├── tests/         specs
├── config/        framework.config.ts, environments, approved-examples.json
├── .github/       CI workflows and AI tool instructions
├── AGENTS.md, README.md, install.sh, .env
└── package.json, playwright.config.ts, tsconfig.json
```

It leaves out the UPEX reference implementation, the setup tooling and the workflows of modules you did not enable. A teammate who clones the project runs `./install.sh` there: it skips the questions, creates `.env` from `.env.example` and installs the configured browsers.

Without the script, for example on Windows: `npm ci`, `npm run setup`, then `npm ci`, `npx playwright install --with-deps` and `npm run doctor` in the new project folder. `npm run setup -- --target <folder>` chooses another location; `--in-place` turns the current folder into the project, for a repository created with GitHub's **Use this template** (it refuses to run on uncommitted changes unless you pass `--force`). For non-interactive use: `--answers answers.json` (see `template-fw/setup/selftest/answers-minimal.json`); the database URL then comes from the `DATABASE_URL` environment variable.

Setup adds an empty application layer and generic GitHub Actions workflows; it installs no tests. With the database module enabled, it warns when no environment allows database access or `DATABASE_URL` is empty. It finishes by listing the repository variable (`TEST_ENV`) and secrets (`DATABASE_URL` when the database module is enabled) to add under **Settings → Secrets and variables → Actions**. The chosen AI tool gets a `/first-tests` command (`.github/prompts/` for Copilot, `.claude/commands/` and `CLAUDE.md` for Claude Code); every tool follows `AGENTS.md`.

Once login and roles are configured in `config/framework.config.ts`, add the role accounts to `.env`, run `npm run doctor` (it checks that each role logs in) and `npm run qa:sync-ci-secrets` (it adds the role secrets to the workflows and lists the secrets to create in GitHub). CI skips Playwright projects that have no tests yet.

## What You Get

| Capability             | Where                                                                                                                                                                     |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Framework core         | `template-fw/framework/` (imported as `@framework/...`): environment, config, authentication, fixtures, reporters, schema validation, accessibility, visual, database, AI |
| Your application layer | `src/` (imported as `@app/...`): schemas, API clients, factories, Page Objects, components, mocks, fixtures                                                               |
| Golden templates       | `template-fw/templates/` catalogued in `template-fw/index.json` and [README](template-fw/templates/README.md); VS Code snippets `qa-<id>`                                 |
| Configuration          | `config/framework.config.ts`, `config/environments/environments.json`                                                                                                     |
| Performance            | k6 under `tests/performance/k6/`, Lighthouse under `template-fw/framework/performance/lighthouse/`                                                                        |
| CI                     | `.github/workflows/`: quality gate, one test job per enabled project (planned from the config, run in the official Playwright image), manual performance workflow         |

## Configuration

`config/framework.config.ts` (validated at load time):

- `modules`: enables Playwright projects (`api`, `ui`, `smoke`, `database`, `accessibility`, `visual`, `performance`, `ai`).
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

## Writing Tests

1. Find the golden example: `config/approved-examples.json` (your reviewed examples) first, then `template-fw/index.json`.
2. Copy the template (or type `qa-<id>` in VS Code), replace the tokens, adapt fields and locators.
3. Validate:

```bash
npx prettier --check .
npm run typecheck
npm run lint:architecture
npm run qa:templates:check
TEST_ENV=staging npx playwright test --project=api
```

With an AI tool, use [template-fw/docs/FIRST_TESTS_PROMPT.md](template-fw/docs/FIRST_TESTS_PROMPT.md) for the first tests. Every tool follows [AGENTS.md](AGENTS.md).

## Commands

| Command                        | Purpose                                                             |
| ------------------------------ | ------------------------------------------------------------------- |
| `./install.sh`                 | Create a project (template) or install it (project)                 |
| `npm run setup`                | Create a project folder for an application                          |
| `npm run doctor`               | Check configuration, reachability, credentials and login            |
| `npm run qa:sync-ci-secrets`   | Add the configured role and database secrets to the workflows       |
| `npm run lint:architecture`    | Enforce layer and import rules                                      |
| `npm run qa:templates:check`   | Verify golden templates, catalogue and snippets                     |
| `npm run qa:templates:build`   | Regenerate the catalogue and snippets from `template-fw/index.json` |
| `npm run qa:templates:extract` | Re-extract templates after an intended canonical change             |
| `npm run qa:selftest`          | Create projects in temporary folders and verify them                |
| `npm run db:test:reset`        | Reset the dedicated test database (reference implementation)        |

## Documentation

- [AGENTS.md](AGENTS.md): rules for humans and AI tools
- [template-fw/docs/ARCHITECTURE.md](template-fw/docs/ARCHITECTURE.md): layers, execution boundaries, CI
- [template-fw/docs/TESTING_STANDARDS.md](template-fw/docs/TESTING_STANDARDS.md): implementation standards per layer and test type
- [template-fw/docs/AI_ASSISTED_QA_WORKFLOW.md](template-fw/docs/AI_ASSISTED_QA_WORKFLOW.md): AI-assisted engineering boundaries
- [template-fw/docs/adr/](template-fw/docs/adr): architecture decisions

## Reference Implementation

The UPEX DOJO implementation in `src/` and `tests/` is the canonical source of the golden templates. The original framework before the template restructuring is preserved on `main` at commit `06e4b5f` (tag `upex-original-v1.0`).
