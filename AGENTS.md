# Agent Instructions

These rules apply to every AI tool and every human contributor. This file holds the rules you must not break and where to look; `framework/docs/ARCHITECTURE.md` explains the reasoning behind them.

## Read Before Changing Code

For every change that follows a golden pattern:

1. `config/approved-examples.json`: this project's reviewed golden examples. Use them first.
2. `framework/templates/index.json`: the generic golden templates and when to use each.
3. The `framework/docs/TESTING_STANDARDS.md` section each template you use links to (its `rules` field).

A test plan designs its cases by the Test Design Standard in `TESTING_STANDARDS.md`.

Only when a change has no golden pattern, or alters a layer responsibility, an execution boundary, authentication, environment permissions, CI or a quality gate, also read `framework/docs/ARCHITECTURE.md`, the relevant `TESTING_STANDARDS.md` sections and `framework/docs/adr/` (ADR-007 for the template architecture, ADR-008 for AI-assisted engineering).

## Workflow

```text
understand the behavior
→ find the golden example for the same responsibility (config/approved-examples.json, then framework/templates/index.json)
→ identify the layers and the execution project
→ reuse → extend → create (only what is missing)
→ propose, and wait for human review
→ implement from the golden template
→ validate (commands below)
→ human approval
```

Do not start by generating code. Do not create an abstraction for hypothetical reuse or symmetry. Implementing from a golden template means the same structure, naming, assertion placement and style, not only the same behavior. Name files and symbols after their domain responsibility (`OrderApiClient`, `createOrder`, `OrdersPage`); a new kind of file without a template follows the naming of the closest one.

## Ask First

Stop and ask the user before:

- adding a new abstraction, layer or dependency;
- creating or changing a visual baseline;
- using database access, reset or performance measurement on an environment for the first time;
- quarantining a test.

## Ownership

```text
framework/     template-owned. Do not edit it in a project; change it in the template.
  core/        the framework itself (login, fixtures, schema validation, reporting)
  templates/   golden templates and their catalogue (index.json)
  tools/       doctor, lint, ci-plan, sync-ci-secrets
  docs/        standards, architecture, ADRs
src/           project-owned application layer: schemas, clients, factories,
               pages, components, mocks, fixtures.
tests/         project-owned specs.
config/        project-owned configuration and approved examples.
```

Import the framework as `@framework/...` and the application layer as `@app/...` (aliases in `tsconfig.json`). `framework/core` never imports `src` or `tests`, and `src` never imports `tests`.

## Layer Rules

The golden templates show what each layer owns. This table lists what it must never do.

| Layer                   | Never                                                                                                                          |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Schema (TypeBox)        | duplicate TypeScript interfaces                                                                                                |
| API client              | assertions                                                                                                                     |
| Factory                 | API calls, UI, assertions, lifecycle; importing Playwright, API or database clients, Page/Component Objects, fixtures or mocks |
| Fixture                 | assertions; hiding a single line of code                                                                                       |
| Page / Component Object | assertions; reuse across `Page` instances; importing API or database clients or fixtures (data setup belongs in fixtures)      |
| Domain database client  | assertions; string-interpolated SQL                                                                                            |
| Mock                    | inventing states the UI does not support                                                                                       |
| Spec                    | raw locators, raw SQL, fixed waits, boolean-wrapped assertions, request data with several fields written inline                |

The framework's Lighthouse policy (`framework/core/performance/`) is the one helper that asserts: its thresholds decide the result.

## Hard Rules

- Successful API responses: HTTP assertion → `validateSchema()` → business assertions. Never cast `response.json()`.
- Negative responses are not validated against success schemas.
- API authentication (bearer token) and browser authentication (session) are separate; use UI login only when login is the behavior under test. A project uses role fixtures, `apiTokenFor(role)` and `authenticatedPageFor(getRoleCredentials(role))`. Golden templates come from the UPEX reference, which registers fresh users (`authenticatedTestUser`, `authenticatedPage`); in a project, replace those with role fixtures as in the `app-fixtures` template.
- `TEST_ENV` selects the target. Database access, destructive reset and performance measurement run only where `config/environments/environments.json` allows them. Never weaken those permissions to make a test run.
- Accessibility: scan through `AccessibilityScanner` and the central WCAG policy: the `accessibility` fixture for the default page, or a project fixture that builds the scanner from the authenticated page. Never suppress violations.
- Visual: native `toHaveScreenshot()` with the shared options. Never run `--update-snapshots` to make a failure pass; baselines are generated in the Docker/Linux runtime and approved by a human.
- Performance: never change thresholds or Lighthouse severities to make an unexplained failure pass. Keep setup traffic outside the measured operation.
- Never weaken an assertion, skip a test, or suppress a real failure to get a green run. Report it. A test skips itself only for a runtime condition it names: `test.skip(condition, "reason")`.
- Retries are diagnostics, not a fix. A test that passes only on retry is flaky and is investigated; a temporary quarantine needs a reason, an owner and a way back, written above it as `// quarantine: <reason>; owner: <name>; exit: <issue or condition>`.
- Never invent provider behavior. When evidence is missing or conflicting, say so.
- Expected results come from the requirements and the provider contract, never from the actual response. When a response contradicts them, do not change the expected result, the schema or the assertion to match it: stop and report the difference with the evidence. Where neither defines a value, model the observed response and mark it `observed` in the plan's Source.
- Report evidence by source (provider contract, repository, running application) and mark anything not verified as UNVERIFIED.
- Exploratory API calls and UI form submissions are allowed only when the selected environment has `allow.interactiveDiscovery: true` and the task requires the interaction. Limit calls to the supplied scenario and use test-owned data. Never invoke DELETE endpoints, destructive resets or irreversible actions during planning; stop for explicit human approval if discovery needs them. OpenAPI MCP contract reads and Playwright inspection may run with discovery permission off, but must remain read-only.
- In failure analysis, state which evidence you actually inspected (error message, error context, trace, screenshot). Never present an unopened artifact as evidence, or uncertain evidence as a confirmed defect.
- Never commit secrets, and never read, ask for or print passwords or tokens. Credentials come from `.env` (git-ignored) or CI secrets.

## Playwright Rules

- Every test is independent: it creates its own data, never relies on test order or another test's data, and can run in parallel.
- Every test asserts an observable outcome of user-visible behavior; an action without an assertion proves nothing, and implementation details are not asserted.
- Await every action and assertion. Use retrying, web-first assertions (`await expect(locator).toBeVisible()`, `toHaveText`, `toHaveCount`, `toHaveURL`); never `expect(await locator.count())`, `expect(await locator.isVisible())`, `waitForSelector`, `networkidle`, `{ force: true }` or a fixed wait such as `waitForTimeout`.
- Locate by user-facing attributes: role, then label, then test id; never by position, CSS chains or XPath. Scope locators to a container and filter by content (`filter({ hasText })`, `filter({ has })`) instead of using an index. `locator()` takes only a test id attribute selector, for a match `getByTestId` cannot express (such as a prefix).
- Raise an assertion timeout only for a known slow operation, never to make a flaky test pass.
- Never leave `test.only` in the code.
- Group the tests of every spec in `test.describe()`, even a single test. Do not use `test.step()`; the test and its Page Object methods express the steps.
- Give every `test.describe()` a concise suite title naming the behavior/component and test level. In planned API/UI specs, every `test()` title starts with its exact plan case ID followed by `: ` and a concise behavior, for example `T001_Login_API: accepts valid credentials` or `T002_Login_E2E: shows the signed-in navigation`. Use the same case ID once only in its spec; for table-driven tests, store a distinct `caseId` on every scenario and interpolate it into the generated test title. This keeps case results directly searchable in Playwright reports.

## Validation

Run before considering work complete:

```bash
npx prettier --check .
npm run typecheck
npm run lint:architecture
npm run qa:templates:check
npx playwright test --project=<affected project>
```

`npm run lint:architecture` runs ESLint (the rules in `framework/tools/eslint.config.mjs` and `framework/tools/eslint-plugin/`, including the test plan format), then the plan-to-spec checks; the VS Code ESLint extension shows the same problems while you edit. Run the affected tests against the target environment. Do not claim a command passed unless it ran and passed. If it could not run, say so.

## Golden Template Changes

Generic templates in `framework/templates/` are derived from canonical files in the reference application and must reproduce them exactly (`npm run qa:templates:check`). Change a pattern in the canonical file first, then run `npm run qa:templates:extract -- <id>` and `npm run qa:templates:build`.

In a project, register reviewed examples in `config/approved-examples.json` instead of editing `framework/templates/`.

## Documentation

Update the documentation when a change alters a layer responsibility, a golden pattern, an execution boundary, authentication, environment permissions, CI ownership or a quality gate. Consider an ADR for an architectural decision. Routine tests that follow an existing pattern need no documentation change.
