# Playwright Enterprise Test Framework Template

A Playwright + TypeScript test automation template for API, UI, database, accessibility, visual regression, and performance testing. It provides a validated framework core, golden templates that humans and AI tools follow, and quality gates that enforce the architecture.

The template was built and validated against [UPEX DOJO](https://dojo.upexgalaxy.com), which remains the reference implementation for its golden templates ([ADR-007](docs/adr/ADR-007-reusable-template-architecture.md)).

## Quick Start

Requirements: Node.js 22.19 or newer (`node -v`; with nvm: `nvm install 22 && nvm use 22`, the repository ships an `.nvmrc`), npm 11.19.1 (`npx npm@11.19.1 ci` if your npm differs), Git.

Setup asks only about your application (URLs, modules, login endpoints and field names). Never type credentials into setup: put test-account credentials into `.env` afterwards.

```bash
git clone <this-template> my-app-tests && cd my-app-tests
npm ci
npx playwright install --with-deps
npm run setup          # URLs, environments, modules, browsers, login, roles
cp .env.example .env   # fill in test account credentials
npm run doctor         # verifies configuration, reachability and login
npm run test:starter   # app-agnostic starter tests
```

`npm run setup` removes the UPEX reference code by default and adds an empty application layer, starter tests and generic GitHub Actions workflows. It finishes by listing the repository variable (`TEST_ENV`) and secrets (role credentials, `DATABASE_URL` when the database module is enabled) to add under **Settings → Secrets and variables → Actions**. It refuses to run on a working tree with uncommitted changes unless you pass `--force`. For non-interactive use: `npm run setup -- --answers answers.json` (see `.qa/selftest/answers.json`).

## What You Get

| Capability             | Where                                                                                                                                                             |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Framework core         | `src/framework/`: environment, config, authentication, fixtures, reporters, schema validation, accessibility, visual, database, AI                                |
| Your application layer | `src/app/`: schemas, API clients, factories, Page Objects, components, mocks, fixtures                                                                            |
| Golden templates       | `.qa/templates/` catalogued in `.qa/index.json` and [README](.qa/templates/README.md); VS Code snippets `qa-<id>`                                                 |
| Configuration          | `config/framework.config.ts`, `config/environments/environments.json`                                                                                             |
| Starter tests          | `@starter`: home page health, login per role, home page accessibility                                                                                             |
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

For API-only testing, enable only the `api` module: setup then skips browser questions, CI runs only the `api` project, and the starter tests check that each role receives an API token.

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

| Command                        | Purpose                                                      |
| ------------------------------ | ------------------------------------------------------------ |
| `npm run setup`                | Configure the template for an application                    |
| `npm run doctor`               | Check configuration, reachability, credentials and login     |
| `npm run test:starter`         | Run the starter tests                                        |
| `npm run lint:architecture`    | Enforce layer and import rules                               |
| `npm run qa:templates:check`   | Verify golden templates, catalogue and snippets              |
| `npm run qa:templates:build`   | Regenerate the catalogue and snippets from `.qa/index.json`  |
| `npm run qa:templates:extract` | Re-extract templates after an intended canonical change      |
| `npm run qa:selftest`          | Run setup in a temporary copy and verify the result          |
| `npm run db:test:reset`        | Reset the dedicated test database (reference implementation) |

## Documentation

- [AGENTS.md](AGENTS.md): rules for humans and AI tools
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md): layers, execution boundaries, CI
- [docs/TESTING_STANDARDS.md](docs/TESTING_STANDARDS.md): implementation standards per layer and test type
- [docs/AI_ASSISTED_QA_WORKFLOW.md](docs/AI_ASSISTED_QA_WORKFLOW.md): AI-assisted engineering boundaries
- [docs/adr/](docs/adr/): architecture decisions

## Reference Implementation

The UPEX DOJO implementation in `src/app/` and `tests/` is the canonical source of the golden templates. The original framework before the template restructuring is preserved on `main` at commit `06e4b5f` (tag `upex-original-v1.0`).
