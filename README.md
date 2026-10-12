# Playwright Enterprise Test Framework Template

A Playwright + TypeScript test automation template for API, UI, database, accessibility, visual regression, and performance testing. It provides a validated framework core, golden templates that humans and AI tools follow, and quality gates that enforce the architecture.

The template was built and validated against [UPEX DOJO](https://dojo.upexgalaxy.com), which remains the reference implementation for its golden templates ([ADR-007](docs/adr/ADR-007-reusable-template-architecture.md)).

## Quick Start

Requirements: Node.js 22.19 or newer (`node -v`; with nvm: `nvm install 22 && nvm use 22`, the repository ships an `.nvmrc`), npm 11.19.1 (`npx npm@11.19.1 ci` if your npm differs), Git.

Setup asks only about your application: name, modules, browsers, staging and local URLs (either can be skipped with `-`), environment permissions and your AI coding tool (GitHub Copilot, Claude Code, both or none). It asks nothing about login: login and roles are configured afterwards, together with the first tests ([docs/FIRST_TESTS_PROMPT.md](docs/FIRST_TESTS_PROMPT.md)). The only secret it asks for is the test database URL, when an environment allows database access: the input is hidden and written only to the git-ignored `.env`. Test-account credentials belong in `.env` and in GitHub secrets, never in prompts.

On macOS or Linux, one script runs the whole installation:

```bash
git clone <your-new-repository> my-app-tests && cd my-app-tests
./install.sh   # npm ci → setup questions → browsers you selected → .env → doctor
# then: configure login and roles and write the first tests (/first-tests, or docs/FIRST_TESTS_PROMPT.md)
```

In a project that is already configured (a teammate's clone), `./install.sh` skips the questions, creates `.env` from `.env.example` and installs the configured browsers. The same steps by hand, for example on Windows:

```bash
npm ci
npm run setup                       # creates .env as well
npx playwright install --with-deps  # or only the browsers you selected
npm run doctor
```

`npm run setup` removes the UPEX reference code by default and adds an empty application layer and generic GitHub Actions workflows; it installs no tests. With the database module enabled, it warns when no environment allows database access or `DATABASE_URL` is empty. It finishes by listing the repository variable (`TEST_ENV`) and secrets (`DATABASE_URL` when the database module is enabled) to add under **Settings → Secrets and variables → Actions**. The chosen AI tool gets a `/first-tests` command (`.github/prompts/` for Copilot, `.claude/commands/` and `CLAUDE.md` for Claude Code); every tool follows `AGENTS.md`. It refuses to run on a working tree with uncommitted changes unless you pass `--force`. For non-interactive use: `npm run setup -- --answers answers.json` (see `.qa/selftest/answers-minimal.json`); the database URL then comes from the `DATABASE_URL` environment variable.

Once login and roles are configured in `config/framework.config.ts`, add the role accounts to `.env`, run `npm run doctor` (it checks that each role logs in) and `npm run qa:sync-ci-secrets` (it adds the role secrets to the workflows and lists the secrets to create in GitHub). CI skips Playwright projects that have no tests yet.

## What You Get

| Capability             | Where                                                                                                                                                             |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Framework core         | `src/framework/`: environment, config, authentication, fixtures, reporters, schema validation, accessibility, visual, database, AI                                |
| Your application layer | `src/app/`: schemas, API clients, factories, Page Objects, components, mocks, fixtures                                                                            |
| Golden templates       | `.qa/templates/` catalogued in `.qa/index.json` and [README](.qa/templates/README.md); VS Code snippets `qa-<id>`                                                 |
| Configuration          | `config/framework.config.ts`, `config/environments/environments.json`                                                                                             |
| Performance            | k6 under `performance/k6/`, Lighthouse under `performance/lighthouse/`                                                                                            |
| CI                     | `.github/workflows/`: quality gate, one test job per enabled project (planned from the config, run in the official Playwright image), manual performance workflow |

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

1. Find the golden example: `.qa-project.json` (your reviewed examples) first, then `.qa/index.json`.
2. Copy the template (or type `qa-<id>` in VS Code), replace the tokens, adapt fields and locators.
3. Validate:

```bash
npx prettier --check .
npm run typecheck
npm run lint:architecture
npm run qa:templates:check
TEST_ENV=staging npx playwright test --project=api
```

With an AI tool, use [docs/FIRST_TESTS_PROMPT.md](docs/FIRST_TESTS_PROMPT.md) for the first tests. Every tool follows [AGENTS.md](AGENTS.md).

## Commands

| Command                        | Purpose                                                       |
| ------------------------------ | ------------------------------------------------------------- |
| `./install.sh`                 | Install dependencies, configure, install browsers, run doctor |
| `npm run setup`                | Configure the template for an application                     |
| `npm run doctor`               | Check configuration, reachability, credentials and login      |
| `npm run qa:sync-ci-secrets`   | Add the configured role and database secrets to the workflows |
| `npm run lint:architecture`    | Enforce layer and import rules                                |
| `npm run qa:templates:check`   | Verify golden templates, catalogue and snippets               |
| `npm run qa:templates:build`   | Regenerate the catalogue and snippets from `.qa/index.json`   |
| `npm run qa:templates:extract` | Re-extract templates after an intended canonical change       |
| `npm run qa:selftest`          | Run setup in a temporary copy and verify the result           |
| `npm run db:test:reset`        | Reset the dedicated test database (reference implementation)  |

## Documentation

- [AGENTS.md](AGENTS.md): rules for humans and AI tools
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md): layers, execution boundaries, CI
- [docs/TESTING_STANDARDS.md](docs/TESTING_STANDARDS.md): implementation standards per layer and test type
- [docs/AI_ASSISTED_QA_WORKFLOW.md](docs/AI_ASSISTED_QA_WORKFLOW.md): AI-assisted engineering boundaries
- [docs/adr/](docs/adr/): architecture decisions

## Reference Implementation

The UPEX DOJO implementation in `src/app/` and `tests/` is the canonical source of the golden templates. The original framework before the template restructuring is preserved on `main` at commit `06e4b5f` (tag `upex-original-v1.0`).
