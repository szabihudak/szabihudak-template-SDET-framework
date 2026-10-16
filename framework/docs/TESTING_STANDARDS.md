# Testing Standards

## Purpose

The golden templates show how each layer and test type is built. This document holds what a template cannot show: the prohibitions, policies and reasons behind it. Every section is linked from a golden template (the `rules` field in `framework/templates/index.json`) or from another linked section, and `npm run qa:templates:check` fails when a section cannot be reached.

The workflow, the validation commands and the hard rules are in `AGENTS.md`; the reasoning behind the architecture is in `ARCHITECTURE.md`. Examples name the UPEX reference implementation the templates are derived from.

## Test Design Standard

- A test plan covers, for each behavior, the categories that apply: the happy path, boundary values, equivalence classes, business flows and error handling. Invalid and missing input and unauthenticated or unauthorized access are Negative cases in the category of their technique. A category that does not apply is named with the reason.
- A plan (`test-plans/<feature>.md`) has these sections besides Files and Open questions. `npm run lint:architecture` checks each of them on the Markdown syntax tree (`plan-*` rules); whether a technique or a Type fits a case and whether a risk is rated right is decided in review.
  - **Risks:** `| ID | Risk | Impact | Likelihood | Level |`. A risk is something that can go wrong in the behavior under test; a side effect of running the tests (such as accounts left in a shared environment) is an open question, not a risk. Impact and Likelihood are High, Medium or Low; Level follows the matrix below. Every risk is covered by at least one case.
  - **Cases:** at least `| ID | Level | Case | Technique | Type | Steps | Expected result | Risk | Priority | Regression | Source |`.
    - Technique is exactly one of the techniques in the table below; it places the case in its category.
    - Type is `Positive` (the behavior succeeds) or `Negative` (it is rejected), as the category allows.
    - Steps are numbered from 1 in the cell, at least two, separated by `<br>`: `1. Log in<br>2. Check the status`.
    - Risk is exactly one risk ID; Priority is that risk's Level.
    - Regression is `Yes` for a High or Medium risk and `No` for a Low one. A case that differs uses one of these reasons: `No: persistent data without cleanup`, `No: depends on unstable or external state`, `No: manual only`, `Yes: main path, cheap and stable`.
    - Cases are ordered by category, then Positive before Negative, then Priority High, Medium, Low. A new plan numbers its IDs in that order; a case that is already implemented keeps its ID, and a new case takes the next free one.
  - **Coverage:** `| Category | Cases or reason |`, one row for each category in the order below, with the cases its technique places there or `not applicable: <reason>`. Every case is in its own category's row and in no other. Exploratory testing is done by a person, not by a case: its row is `charter: <what, how long, which risk>` or `not applicable: <reason>`.

  | Category            | Technique                                       | Type                 |
  | ------------------- | ----------------------------------------------- | -------------------- |
  | happy path          | happy path                                      | Positive             |
  | boundary values     | boundary value analysis                         | Positive or Negative |
  | equivalence classes | equivalence partitioning                        | Positive or Negative |
  | business flow       | business rule, decision table, state transition | Positive or Negative |
  | error handling      | error guessing                                  | Negative             |
  | exploratory         | a charter, no case                              |                      |

  | Impact \ Likelihood | Low    | Medium | High   |
  | ------------------- | ------ | ------ | ------ |
  | High                | Medium | High   | High   |
  | Medium              | Low    | Medium | High   |
  | Low                 | Low    | Low    | Medium |

- Cases with the same steps that differ only in their data and expected result are one scenario group, built from the `api-scenario-spec` template (see the [Negative API Test Standard](#negative-api-test-standard)).

## API Test Standard

- Cases are designed by the [Test Design Standard](#test-design-standard).
- Every API test title begins with its plan case ID (`Tnnn_Component_API: <behavior>`); keep the ID identical to the plan so Playwright results map directly back to planned coverage.
- The schema-derived type is safe only after `validateSchema()`; use the response fields after it, never before. A successful response is checked in this order: the status, `validateSchema()`, then the fields. `npm run lint:architecture` reports a successful body that is never validated or a field asserted before `validateSchema()`.
- API tests are browser-independent and run once, in the `api` project.
- After the schema, assert as many values as the test can predict:
  - deterministic fields (values from the request, documented defaults, the owner) by exact value. A field that echoes the request is compared with the request value (`expect(body.title).toBe(taskData.title)`); review checks this, the lint does not;
  - generated fields (ids, timestamps) by format, declared in the schema where the contract defines it (for example `format: "uuid"`, `format: "date-time"`), and by relations the contract or an observed response establishes (such as the same id on a later read);
  - a field whose value the contract does not define is covered by its schema type; do not invent an expected value.
- A field left unasserted on purpose is listed above the `test.describe` with its reason, for example `// unasserted: position (the API contract does not define its value on create)`. A nested field is listed by its path (`user.id`). `npm run lint:architecture` checks that every schema field, including those of nested objects, is asserted (directly, or through an enclosing object compared with `toEqual` or `toStrictEqual`), has a format, or is listed this way.
- Compare a successful body or a nested object as a whole with `toEqual` or `toStrictEqual`, not with `expect.objectContaining` or `toMatchObject`, which let missing assertions and unexpected values pass. A partial comparison says why on the line above it: `// partial: <reason>`. `npm run lint:architecture` reports a partial comparison of a validated body without that reason.
- The main success test of an operation covers every field this way; focused scenario tests (boundaries, single-field updates) assert the fields the scenario is about.
- A helper that only one spec needs stays in that spec and may assert, like `getCurrentUser` in the `api-spec` template. A helper that several specs need becomes a fixture or a client setup helper.
- A test that expects an error status follows the [Negative API Test Standard](#negative-api-test-standard).

## Negative API Test Standard

- Assert the status and the error fields.
- Assert the error fields directly: `expect(body.error).toBe(...)`, or `toEqual` on a nested object. Never wrap the check in a function that returns true or false (`expect(isError(body)).toBe(true)`): its failure does not say which field is wrong. `npm run lint:architecture` reports a read error body without a field assertion and any assertion of that shape.
- Cases with the same steps that differ only in data and expected result are one scenario array with a `caseId` per entry, generated with `for (const scenario of ...)` as in the `api-scenario-spec` template. A case that must stay a separate test says why on the line above it: `// separate-test: <reason>`. `npm run lint:architecture` reports tests whose client calls and assertions differ only in strings and numbers.
- Assert an error field or message only when the provider contract or an observed response establishes it.
- Add a reusable error schema only when the provider has a stable, meaningful error contract worth validating, not for symmetry with success schemas.
- A successful response in the same spec follows the [API Test Standard](#api-test-standard).
- Negative API tests stay browser-independent unless browser behavior is part of the scenario.

## API Client Standard

- Add a method to the client that owns the domain, following its request construction. A client owns one domain, named after it (`TaskApiClient`); an operation of another domain goes to that domain's client, created if it does not exist, never to the nearest existing one.
- Keep raw response methods wherever tests need control over the status and negative behavior. Clients contain no assertions.
- Setup helpers (such as `createTaskForUser`) may validate and throw, because successful setup is their contract.
- Do not introduce a generic base client until real duplication demands one.

## Database Test Standard

- Create state through the application (API clients and fixtures), then validate persistence through the domain database client. Do not insert rows to simplify setup when a supported application path exists, and do not repeat the API response assertions.
- No raw SQL or `pg` in specs. Queries are parameterized, never built by interpolating test data. Record types reflect the persisted columns, values and nullability.
- `DatabaseClient` owns the PostgreSQL transport and pool; database fixtures construct the clients and close the pool after the test.
- Only a dedicated, test-owned environment sets `allow.database` (in the reference configuration, `localDocker`). Never enable it for a shared environment because a connection string is available, and never bypass the guard in a fixture.
- The `database` project runs without retries, and normal runs keep the data they create for investigation. Do not add per-test cleanup to make the database look clean.

### Database Reset Standard

- The reset is an explicit, destructive operation for the dedicated disposable test database only. It is never generalized to a shared, staging or production database, and normal test runs never invoke it.
- The framework owns the guarded part, `resetTestDatabase(hooks)`: it requires `allow.destructive`, a postgres `DATABASE_URL` and `CONFIRM_DB_RESET=true`, runs the optional `preflight` hook, recreates the `public` schema, then calls the project's `restoreBaseline` and `verifyBaseline` hooks.
- The application owns its schema and seed data, so the project supplies the hooks and the framework never duplicates them. The UPEX reference wires them in `src/database/resetTestDatabase.ts` (`npm run db:test:reset`); setup does not copy that script into projects.

## Schema Standard

- A TypeBox schema is the single source of a provider contract. Derive the type with `Static<typeof schema>`; never keep a separate interface for the same contract.
- Model the provider behavior the contract defines: required and optional fields, nullable values, formats, enums and server-generated defaults. Where the contract is silent, model the observed response and mark the case `observed` in its plan. When a response contradicts the contract, the schema keeps the contract and the difference is reported (AGENTS.md, Hard Rules).
- One schema per request body and per response body of an operation, named after it (`LoginCredentialsSchema`, `AuthenticationSchema`). Two operations share a schema only when the contract gives them the same component; never widen a schema to fit another operation's body.
- Every `Type.Object`, including nested ones, declares `{ additionalProperties: false }`, so a response with unexpected fields fails validation instead of passing silently.

## Constants Standard

- Extract a constant for reusable, stable domain knowledge, not to avoid a string literal.
- Keep scenario-specific and one-off inputs local.
- Derive domain unions from the canonical constant arrays.

## Factory Standard

- `createX()` returns a complete, domain-valid object with strong types and explicit overrides; `createXPayload()` starts from it and may omit request fields for negative tests.
- Business-invalid values the type allows (`password: "12345"`, `email: ""`) go through normal overrides.
- A request with several fields comes from the factory (`createTask({ title: "..." })`) or a scenario array, never an object literal written into the client call. A single-field partial update (`{ priority: "high" }`) is the scenario itself and stays inline. `npm run lint:architecture` reports the rest.
- A value the type rejects is built locally in the negative test that owns it, with the smallest escape (`"critical" as TaskRequest["priority"]`). Never widen a domain type or add a generic invalid-data factory for it.
- Extend the existing domain factory before creating a new one.

## Fixture Standard

- Create or extend a fixture for reusable setup, state, dependency composition or lifecycle, never to hide trivial construction.
- Order fixtures by their dependency flow, reuse lower-level fixtures, keep each one focused, and clean up what it owns.
- Every test follows the lifecycle create → setup → execute → teardown → cleanup. Create, setup, teardown and cleanup belong in fixtures: the data the test needs, authenticated clients and Pages, and the deletion of what the fixture created. The test body only executes the behavior and asserts it. Data a test creates in its own body is cleaned up by a fixture or listed as a known gap.
- Authenticated fixtures use the role accounts: `apiTokenFor(role)` and `authenticatedPageFor(getRoleCredentials(role))` (see the [Authentication Standard](#authentication-standard)).
- Database fixtures reuse `DatabaseClient`, close the pool, and never bypass the `allow.database` guard.

## Authentication Standard

A project uses role accounts from `config/framework.config.ts`, with credentials from `.env` or CI secrets:

```text
apiTokenFor(role)                              → bearer token, logged in once per test
authenticatedPageFor(getRoleCredentials(role)) → Page with a programmatic session, closed after the test
```

The UPEX reference registers a fresh user per test, and the templates derived from it use its fixture names. In a project, replace them; do not copy the fresh-user registration:

```text
authenticatedTestUser.accessToken            → await apiTokenFor("<role>")
Page Object built from authenticatedPage     → built from authenticatedPageFor(getRoleCredentials("<role>"))
testUserData, registeredTestUser             → only where the application lets tests register users
```

- Objects that act on an authenticated Page are built from that Page, or from a fixture that depends on it.
- Only login specs (a file name containing `login` or `authentication`) call `getRoleCredentials()` or a client's `login()` themselves; every other spec gets its token or Page from the role fixtures. A spec that must sign in itself (for example to test session expiry) says why on the line above the call: `// own-login: <reason>`. `npm run lint:architecture` reports the rest.

## Page Object Standard

- Define locators in the constructor. Actions and queries use them instead of creating new locators; a locator that needs a parameter (such as an id) is a query method.
- Expose meaningful user actions (`login(email, password)`) instead of making specs fill individual fields, unless the field interaction is the behavior under test.
- Include only the sections the page needs.

## Component Object Standard

- Use a Component Object for a reusable UI region that is not a whole page.
- Scope child locators to the component root when the DOM supports it. Content rendered outside the subtree, such as portal dropdowns, dialogs and menus, stays page-scoped: the real DOM decides, not symmetry.

## UI Spec Standard

- Cases are designed by the [Test Design Standard](#test-design-standard).
- Every UI test title begins with its plan case ID (`Tnnn_Component_E2E: <behavior>`); keep the ID identical to the plan so browser results map directly back to planned coverage.
- Give each `test.describe()` a concise suite title naming the component/behavior and test level. Keep every test inside `test.describe()`, including single-test specs (required by `AGENTS.md`).
- Every UI test asserts what the page shows: at least one visible element or text that proves the outcome. A changed URL or a successful network response alone is not enough; they may be asserted in addition. Only the setup self-test specs, tagged `@selftest`, are exempt: they run against any application and cannot know its elements.
- Keep related assertions together, without a blank line between each one. Do not add Arrange/Act/Assert comments; comments explain non-obvious reasons only.
- Tests stay compatible with every browser project that runs them. Browser-specific behavior is added only when it is intentional and documented.

### API/UI Composition

- Prefer API or programmatic setup when UI setup would be slower, more brittle or unrelated to the behavior under test. Do not use a UI flow only because the final assertion is visual.
- A test that uses API setup but verifies UI behavior is a UI test and runs in the browser projects.

## Accessibility Test Standard

- `AccessibilityScanner` applies the central WCAG 2.2 AA policy. Never construct `AxeBuilder` in a spec, and never duplicate, broaden or narrow the WCAG tags for a single test.
- The spec owns the decision. The formatter only makes failures readable: it never removes, suppresses or re-grades a violation.
- The project fixture for an authenticated page builds the scanner from that Page (the UPEX reference calls it `authenticatedAccessibility`). Never scan one Page's state with a scanner built from another.
- A real violation fails the test, without `continue-on-error`; an exception needs an explicit, reviewed policy.
- Scan full pages after the meaningful state is established. Do not add accessibility-specific selectors, test ids or abstractions for hypothetical scoped scanning.
- Accessibility tests run once, in Chromium. Add browsers only for a concrete requirement or observed behavior.
- Automated axe coverage is not complete WCAG conformance; manual testing remains necessary for what rules cannot check.

## Visual Regression Test Standard

- Protect intentional visual state; do not repeat functional assertions that API or UI tests own.
- Establish deterministic state through the existing factories, API setup, fixtures and Page Objects. Control unstable content through data before considering masks or tolerances.
- Choose the smallest screenshot scope that protects the risk. Page-level and component-level contracts complement each other; do not mirror one with the other.
- Use the shared `VISUAL_COMPARISON_OPTIONS`. Do not add per-spec tolerances, global thresholds, masks or ignored regions without a concrete unstable element that cannot be made deterministic, and do not wrap `toHaveScreenshot()` in a helper for symmetry. Such an exception is written above the call as `// visual-exception: <element> (<why it cannot be made deterministic>)`; `npm run lint:architecture` rejects a tolerance or mask without it.
- Baselines are version-controlled next to their spec, never generated on a developer machine, and confirmed by a rerun without updating before they are committed.
- CI compares only. A difference fails until it is reviewed and accepted as intended; otherwise the product or the test instability is fixed.
- Visual tests run once, in Chromium. Browser-specific baselines need a concrete visual requirement that justifies their maintenance.

## API Performance Standard

API workload performance runs in the k6 runtime under `tests/performance/k6/`, not as a Playwright project.

- **Setup and measurement:** prerequisites (such as registering and logging in a performance user) run in `setup` and must succeed before the measured scenario. Their latency never counts toward the workload metric. Data the workload needs is created in setup and deleted in teardown where the provider supports deletion; the measured operation does not create data on every iteration.
- **Transport:** use native k6 HTTP. Do not import Playwright clients, fixtures, request contexts or Node infrastructure into a workload. Runtime-neutral configuration may be shared.
- **Workload:** state the behavior and load model. The reference (`constant-vus`, 2 virtual users, 30 seconds, 1 second pacing) is a controlled baseline against a shared application. Do not call a workload capacity, stress, spike, soak or endurance testing unless it and the environment are designed for that, and do not raise the load on shared infrastructure to look more realistic.
- **Metrics:** the measured operation owns workload-specific metrics, plus a check that it succeeded (the reference uses `task_read_duration`, `task_read_failures` and a `200` check). Checks do not repeat the functional contract tests; global k6 metrics are diagnostics only.
- **Thresholds:** native k6 thresholds on the workload metrics, calibrated from repeated baseline runs (the reference uses `p(95) < 500` ms and a failure `rate < 1%`; they are not a provider SLA). Do not choose or change a threshold because a number looks round, one run passed, or a pipeline needs to become green. Before changing one, consider the operation, the workload model, the environment, repeated evidence, normal variation and any product requirement. A threshold failure stays a failure: no `continue-on-error`.
- **Environment and runtime:** the workflow passes the selected environment's `apiBaseUrl` as `TARGET_BASE_URL`, and only environments with `allow.performance` are measured. Do not hardcode URLs or import the TypeScript environment adapter. k6 runs in the pinned `grafana/k6` image (never a floating tag, never installed into the Playwright image), with `--rm` and as the host user, from a manually triggered workflow.
- **Reporting:** the k6 web dashboard export is the human-readable evidence; thresholds decide the result, and CI keeps the report even when a run fails. The reference also uses `framework/core/performance/k6/k6SummaryReporter.js`, which is specific to its metrics (ARCHITECTURE.md, Known Gaps).
- Do not wrap native k6 HTTP, metrics, scenarios or thresholds in framework abstractions.

## Browser Performance Standard

- Standalone LHCI audits a public state directly. Authenticated scenarios use the `performance` project only to establish the representative state through the existing fixtures, API setup and Page Objects, confirm that it is ready, and then measure. Do not duplicate business-state setup for performance coverage: change the measurement, not the initialization. Playwright orchestrates; Lighthouse measures.
- Measure several independent runs (the reference uses 3) and evaluate the median. Individual runs stay available as evidence, and the median never hides a reproducible regression. The `performance` project runs without retries: repeated measurement handles variance, not test retries.
- Standalone and authenticated paths share one policy, `lighthouseThresholds.json`: `error` fails the run, `warn` reports a regression signal and the run passes. `warn` violations are never silently suppressed.
- Both paths audit the selected environment's `webBaseUrl`, only where `allow.performance` is set. Do not keep a separate Lighthouse environment map or hardcode the URL.
- Calibrate thresholds from repeated measurements of the same controlled state when no authoritative target exists. Do not introduce, relax or reclassify a threshold or severity because one run was convenient, variance was not established, or a run needs to become green. Before changing one, review the measured state, the environment, repeated evidence, normal variance, whether the measurement model changed, and any product requirement.
- Reuse `LighthouseRunner`, the shared policy and `attachLighthouseReport()`; do not build parallel Lighthouse infrastructure.

## Mock Standard

- Control only the network behavior the scenario needs; intercept only that request and let unrelated traffic through.
- Reproduce realistic provider behavior; never invent a state the UI does not support.
- Keep assertions in the spec.
- Do not create a generic mock abstraction before repeated mocking demonstrates the need.
- A mocked UI test is still a browser-dependent UI test.
