# Framework Architecture

## Purpose

This document explains how the framework is structured and why. It is written for people who change the framework or make an architectural decision in a project.

Agents and contributors writing tests follow `AGENTS.md`, the golden templates and the `TESTING_STANDARDS.md` section each template links to. Those hold the rules; this document holds the reasoning behind them. When this document and the code disagree, the code is right and this document is corrected.

## Principles

- Tests describe behavior; reusable technical concerns live in the layer that owns them.
- Provider contracts are schema-first, and runtime data is validated before it is trusted.
- Test data creation, setup and lifecycle, UI interaction and assertions are separate responsibilities.
- A Playwright project represents an execution responsibility, not a copy of the suite per browser.
- Runtime configuration and target selection are separate from the code and from the execution environment.
- Real quality signals (accessibility violations, visual differences, threshold failures) stay visible; they are never suppressed to get a green run.
- Abstractions are introduced for demonstrated reuse or lifecycle value, never for symmetry. Existing patterns are reused, then extended, before anything new is created.

## Ownership

```text
framework/     template-owned; replaced as a whole on a template update
  core/        the framework, imported as @framework/...
  templates/   golden templates and their catalogue (index.json)
  tools/       setup, doctor, onboard, ci-plan, sync-ci-secrets, lint, template checks
  docs/        architecture, testing standards, AI workflow, ADRs
  setup/       starter files, self-test (template only)
examples/      optional Copilot agents to copy into a project (template only)
src/           project-owned application layer, imported as @app/...
tests/         project-owned specs
config/        project-owned configuration and approved examples
```

Dependencies flow from `src` and `tests` to `framework/core`, never the reverse (ADR-007).

In the template repository, `src/` and `tests/` hold the UPEX DOJO reference implementation, the canonical source of the golden templates. `npm run setup` leaves the reference implementation and the template-only files listed in `framework/setup/project-files.json` out of a new project and adds the starter files: an empty application layer, generic workflows and the files of the chosen AI tool.

## Layers

What each layer must never do is defined once, in the Layer Rules table of `AGENTS.md`; the golden templates show what each layer owns. The reasoning:

A TypeBox schema gives both the compile-time type (`Static<typeof schema>`) and the runtime check (`validateSchema()`, AJV). A successful API test therefore asserts the HTTP status, validates the parsed body against the schema, then asserts business values on the typed result. Negative responses are not validated against success schemas.

```text
API:       spec → fixture → factory → API client → HTTP status → validateSchema() → business assertions
UI:        spec → fixture → Page Object / Component Object → Playwright Page
Database:  spec → fixture → domain database client → DatabaseClient (pg pool) → persistence assertions
```

There is deliberately no base API client, service layer, generic factory or repository layer: none has demonstrated reuse.

## Configuration and Environments

`config/framework.config.ts` is validated against a TypeBox schema when it is loaded. It selects the modules (`api`, `ui`, `smoke`, `database`, `accessibility`, `visual`, `performance`), the browsers, the CI retries and workers, the authentication strategies and the roles.

`config/environments/environments.json` is the runtime-neutral source of target data: `webBaseUrl` (required when a browser module is enabled), `apiBaseUrl` (required when `api` or `performance` is), optional `openApiUrl` and the permissions `allow.database`, `allow.destructive`, `allow.performance` and `allow.interactiveDiscovery`. The latter gates planner API invocation and UI form submissions for exploratory discovery; destructive or irreversible actions remain prohibited. `config/framework.config.ts` may point to an optional requirements document with `requirementsDoc` and to optional UI/E2E scenarios with `uiScenariosDoc` (HTTP(S) URL or repository-relative path). `getCurrentEnvironment()` stops with the module's name when an enabled module's URL is missing, and `requireUrl()` gives a URL or an error naming it. Playwright reads environment settings through `framework/core/utils/env.ts`; the performance workflow and Lighthouse configuration read the same file directly.

`TEST_ENV` selects the environment and has no default, so a run never silently targets a shared deployment. Guards check permissions, not environment names: `assertEnvironmentAllows()` protects direct database access, the destructive reset and Lighthouse measurement.

## Authentication

API and browser authentication are separate mechanisms and are never interchanged.

| Strategy           | Configured in `auth`                                                    | Provided by                                                                                           |
| ------------------ | ----------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| API `bearer`       | `loginPath`, username and password fields, `tokenField`                 | `apiTokenFor(role)`: logs in once per test and reuses the token                                       |
| Browser `nextAuth` | `csrfPath`, `callbackPath`, `landingPath`, username and password fields | `authenticatedPageFor(credentials)`: a new context with a programmatic session, closed after the test |
| `none` (either)    | nothing                                                                 | the helpers throw if called                                                                           |

`roles` maps each role name to the environment variables holding its test-account credentials; `getRoleCredentials(role)` reads them. Credentials live only in the git-ignored `.env` and in CI secrets. `npm run doctor` checks that every role's credentials are set and, for each configured strategy, that the role logs in. UI login is used only when login is the behavior under test.

The UPEX reference implementation registers a fresh user per test instead of using role accounts (`testUserData`, `registeredTestUser`, `authenticatedTestUser`, `authenticatedPage` in its `src/fixtures/test-fixtures.ts`). Golden templates derived from it carry those names; a project replaces them with role-based fixtures from the `app-fixtures` template.

## Execution Model

`buildProjects()` in `framework/core/config/playwrightProjects.ts` generates the Playwright projects from the enabled modules and browsers:

| Project                         | Specs                           | Browser                 | Notes                                                              |
| ------------------------------- | ------------------------------- | ----------------------- | ------------------------------------------------------------------ |
| `api`                           | `tests/api/**`                  | none                    | browser-independent, runs once                                     |
| `database`                      | `tests/database/**`             | none                    | `retries: 0`, so a failed run keeps its state for investigation    |
| `accessibility`                 | `tests/accessibility/**`        | Chromium                | runs once                                                          |
| `visual`                        | `tests/visual/**`               | Chromium                | runs once against one canonical baseline set                       |
| `performance`                   | `tests/performance/**`          | Chromium                | `retries: 0`, 90 s timeout; Lighthouse repeats measurements itself |
| `chromium`, `firefox`, `webkit` | `tests/ui/**`, `tests/smoke/**` | each configured browser | cross-browser UI coverage                                          |

k6 workloads in `tests/performance/k6/` are not Playwright projects; they run in the k6 runtime.

`playwright.config.ts` adds retries and workers on CI from the config, traces on the first retry, screenshots and videos on failure, and the list, HTML, JSON and GitHub summary reporters.

## Capabilities

**Accessibility.** `AccessibilityScanner` runs axe with the central WCAG 2.2 AA tag policy (`WCAG_AA_TAGS`) against the `Page` it was built from; `formatAccessibilityViolations()` only formats. The framework provides the `accessibility` fixture for the default `page`; a scanner for an authenticated page is a project fixture built from that page. Specs own the assertion that there are no violations. Automated axe coverage is not full WCAG conformance.

**Visual regression.** Native `toHaveScreenshot()` with the shared `VISUAL_COMPARISON_OPTIONS` (animations disabled, caret hidden), on deterministic state set up through the existing factories, clients, fixtures and Page Objects. Baselines are version-controlled next to their spec, generated in the Linux Playwright image that CI uses and approved by a human. CI compares only; it never updates baselines.

**Database.** The `databaseClient` fixture requires `allow.database` and `DATABASE_URL`, and closes the pool after the test. Domain database clients own the SQL. Normal runs keep the data they create. `resetTestDatabase(hooks)` in the core is the guarded destructive reset: it requires `allow.destructive`, a postgres `DATABASE_URL` and `CONFIRM_DB_RESET=true`, recreates the `public` schema, then calls the project's `restoreBaseline` and `verifyBaseline` hooks. The application owns its schema and seed data; the reference implementation wires the hooks in `src/database/resetTestDatabase.ts` (`npm run db:test:reset`), which setup does not copy into projects.

**Performance.** Two runtimes, chosen by what is measured:

- API workload: k6 in the pinned `grafana/k6` image, target from `apiBaseUrl` passed as `TARGET_BASE_URL`, setup and teardown outside the measured operation, native k6 thresholds and the k6 HTML dashboard export.
- Browser: Lighthouse. Standalone LHCI audits `webBaseUrl` (`lighthouseConfig.js`); authenticated scenarios use the `performance` project to establish state through existing fixtures, then `LighthouseRunner` measures several runs and evaluates the median against the shared `lighthouseThresholds.json` policy (`error` fails, `warn` reports).

Thresholds come from repeated baseline evidence and are not changed to make an unexplained failure pass.

## CI for Generated Projects

`npm run setup` installs `framework/setup/starter/.github/workflows/`:

```text
playwright.yml
  quality: prettier, typecheck, lint:architecture, qa:templates:check
           → ci-plan.ts: projects from config/framework.config.ts, minus performance,
             projects without specs, and database where TEST_ENV does not allow it
  tests:   one matrix job per planned project, in the official Playwright image,
           against the TEST_ENV repository variable, role secrets from repository secrets
performance.yml (manual, environment input that must allow performance)
  api-performance:     every tests/performance/k6/*.js in the k6 image
  browser-performance: LHCI, then the performance project if it has specs
```

`npm run qa:sync-ci-secrets` writes the role and database secret names between the `@qa:secrets` markers in both workflows; it uploads nothing.

The template repository itself runs the UPEX pipeline instead: images built once and published to GHCR, functional jobs on Docker Compose against `localDocker`, and the setup self-test. ADR-006 documents that pipeline; `.github/workflows/` is its source of truth.

## Quality Gates

Enforced by tools:

- `npm run lint:architecture`: the mechanical subset of the rules in `AGENTS.md` and `TESTING_STANDARDS.md`, such as assertions only in specs, layer import boundaries, no automatic baseline updates, and the shapes of the golden spec templates (response assertion order, whole-object comparison of successful bodies, error-field assertions, factory data, role fixtures, scenario arrays for similar cases). It runs ESLint first: `framework/tools/eslint.config.mjs` configures the standard rules (`eslint-plugin-playwright`, `no-restricted-syntax`, `no-restricted-imports`) and the project's own rules in `framework/tools/eslint-plugin/` (one file and one `RuleTester` test per rule, reading the syntax tree, not text). The same plugin checks the format of the test plans (`plan-*` rules: risks, techniques, coverage, steps) on their Markdown syntax tree through `@eslint/markdown`. Then `framework/tools/architecture.ts` checks what is not one source file: test plans against their specs, automation files, and that every cited rule exists. Each rule cites the documented rule it enforces, every violation names it (for example `(AGENTS.md#layer-rules)`), and the lint fails if a cited section does not exist. TypeScript stays on 6.0 because `typescript-eslint` does not support TypeScript 7 yet (ADR-011).
- `npm run qa:templates:check`: every template reproduces its canonical file, every rules link resolves, approved examples exist, the catalogue and snippets are current.
- `npm run typecheck`, `npx prettier --check .`, and the configuration and environment schemas at load time.

Enforced by review: test intent, golden-template choice, realistic mocks, no invented provider behavior, unchanged permissions and thresholds, approved baselines, and abstractions only where reuse is demonstrated.

## AI-Assisted Engineering

The framework has no AI provider integration (ADR-007) and setup installs no AI agents (ADR-010). Every project gets `AGENTS.md`, `.github/copilot-instructions.md`, which makes GitHub Copilot load it, and `.vscode/mcp.json` with the Playwright and OpenAPI MCP servers it needs. Any AI tool follows `AGENTS.md`; the deterministic gates (`lint:architecture`, `qa:templates:check`, typecheck, the Playwright tests) and CI decide whether a change is accepted, whoever wrote it. Repository rules decide structure; contract and runtime discovery provide application evidence. Optional planner and builder agents for GitHub Copilot are in `examples/copilot-agents/`. ADR-008 records the approach and the validation behind it; ADR-010 records why agents are left to each project.

## Known Gaps

- Golden templates are derived from the UPEX reference and use its fresh-user fixture names; projects adapt them to role-based fixtures (see Authentication).
- `framework/core/performance/k6/k6SummaryReporter.js` reports the reference workload's metric names and thresholds; it is not yet generic.

## Changing the Architecture

Routine tests that follow an existing pattern need no documentation change. Update this document and `TESTING_STANDARDS.md` when a change alters a layer responsibility, a golden pattern, an execution boundary, authentication, environment permissions, CI ownership or a quality gate. Consider an ADR when a change introduces a layer, changes dependency direction, replaces an established pattern, adds a major technology, or changes the authentication or execution architecture.
