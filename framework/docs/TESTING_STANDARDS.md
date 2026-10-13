# Testing Standards

## Purpose

This document holds the implementation detail for the rules in `AGENTS.md`. Every section is linked from a golden template (the `rules` field in `framework/templates/index.json`) or from another linked section; `npm run qa:templates:check` fails when a section cannot be reached.

The workflow, the validation commands and the hard rules are in `AGENTS.md`; the reasoning is in `ARCHITECTURE.md`. Examples name the UPEX reference implementation the golden templates are derived from.

## API Test Standard

A successful API test should normally follow:

```text
prerequisite / test data

request + HTTP assertion

parse response
runtime schema validation

business assertions
```

Example structure:

```ts
test("creates a task", async ({ taskApi, authenticatedTestUser }) => {
  const request = createTask();

  const response = await taskApi.createTask(
    request,
    authenticatedTestUser.accessToken,
  );
  expect(response.status()).toBe(201);

  const body = await response.json();
  validateSchema(taskResponseSchema, body);

  expect(body.title).toBe(request.title);
  expect(body.priority).toBe(request.priority);
});
```

Runtime validation must happen before successful provider data is trusted as a typed contract.

Do not use a TypeScript cast to bypass runtime validation.

Avoid:

```ts
const body = (await response.json()) as TaskResponse;
```

Prefer:

```ts
const body = await response.json();
validateSchema(taskResponseSchema, body);
```

After validation, TypeScript may safely use the schema-derived type.

API tests belong to the dedicated `api` project and should not depend on browser installation or browser-engine execution.

A test that expects an error status follows the [Negative API Test Standard](#negative-api-test-standard).

## Negative API Test Standard

Negative tests should normally follow:

```text
prerequisite / test data

request + HTTP assertion

parse response

error/business assertions
```

Do not validate an error response against a successful response schema.

Do not introduce a generic error schema merely for structural symmetry.

Use a reusable error schema only when the provider exposes a stable, meaningful error contract that benefits from runtime validation.

Negative API tests remain browser-independent unless browser behavior itself is part of the scenario.

## API Client Standard

Before adding a client method:

- confirm the responsibility belongs to that domain client;
- follow the existing request construction pattern;
- preserve raw response access when tests need status or negative-response control;
- avoid assertions inside client methods.

Setup helpers may provide stronger guarantees when repeated successful setup is their explicit responsibility.

Do not introduce a generic base client unless demonstrated duplication justifies it.

## Database Test Standard

Database validation belongs under:

```text
tests/database/**
```

and executes through the dedicated `database` Playwright project.

The canonical database validation flow is:

```text
prerequisite / API behavior
        ↓
fixture-provided domain database client
        ↓
DatabaseClient
        ↓
PostgreSQL / Neon
        ↓
persistence assertions in the spec
```

Database tests should validate persisted application state across the API-to-database boundary rather than duplicate API response assertions.

Use API clients and existing fixtures to create application behavior when the behavior under test is persistence. Query the resulting state through the relevant domain database client.

Do not place raw SQL or direct `pg` usage in database specs.

`DatabaseClient` owns PostgreSQL transport and connection lifecycle primitives.

Domain database clients own domain-specific SQL and query semantics.

Database record types must reflect the persisted database representation, including actual column naming, domain values, and nullability.

Database queries must use parameterized values rather than interpolating test data into SQL.

Database fixtures own client construction and cleanup. The underlying connection pool must be closed after fixture use.

Database execution is guarded by the environment permission:

```text
config/environments/environments.json
→ <environment>.allow.database = true
```

Only a dedicated, test-owned environment may set it. In the reference configuration that is `localDocker`.

Do not enable `allow.database` for a shared environment merely because a database connection string is available.

Database tests use unique generated data so independent executions do not rely on shared mutable records.

The database project executes with:

```text
retries: 0
```

Persistent state is intentionally retained after a normal database test run for debugging and forensic inspection. Do not add per-test destructive cleanup merely to make the database appear clean after every execution.

### Database Reset Standard

The dedicated test database may be restored through the explicit reset workflow when a known baseline is required.

The framework owns the guarded part of the reset, `resetTestDatabase(hooks)` in `framework/core/database/resetTestDatabase.ts`:

```text
require allow.destructive for TEST_ENV
→ require a postgres DATABASE_URL
→ require CONFIRM_DB_RESET=true
→ hooks.preflight (optional)
→ recreate the public schema
→ hooks.restoreBaseline
→ hooks.verifyBaseline
```

The project supplies the hooks, because the application owns its schema and seed data. The UPEX reference wires them in `src/database/resetTestDatabase.ts` (Docker availability, `db:push`, `db:seed`, seeded users and tasks) and runs it with `npm run db:test:reset`; setup does not copy that script into projects.

The reset workflow is destructive and is valid only for the dedicated disposable test-owned database.

It must not be generalized to a shared, non-test, staging, or production database.

Normal test execution must not invoke the reset automatically.

The framework reset utility orchestrates the reset but does not duplicate the application's schema definition or seed logic.

### Database Completion Checks

```text
database execution only where allow.database is set
        ↓
fixture-managed database lifecycle preserved
        ↓
SQL remains inside the database client layer
        ↓
cross-layer persistence behavior validated
        ↓
database project executes with retries disabled
        ↓
normal execution preserves state for debugging
        ↓
destructive reset remains explicit and guarded
```

## Schema Standard

Provider API contracts use TypeBox as the source of truth.

Use:

```ts
export const exampleSchema = Type.Object({
  id: Type.String(),
});

export type Example = Static<typeof exampleSchema>;
```

Do not maintain a separate TypeScript interface that duplicates the same provider contract.

Schema definitions must reflect observed provider behavior, including:

- required fields;
- optional fields;
- nullable values;
- formats;
- enums;
- server-generated defaults.

## Constants Standard

Extract a constant when the value represents reusable and stable domain knowledge.

Do not extract values merely to avoid string literals.

Prefer local values for scenario-specific or one-off test inputs.

Domain unions should derive from canonical constant arrays when appropriate.

## Factory Standard

Factories should generate valid test data by default.

Preferred pattern:

```text
valid defaults
+
explicit overrides
=
scenario-specific data
```

Factories may additionally support intentionally partial or invalid data when negative testing requires it.

### Canonical Factory and Payload Pattern

Use the following responsibility split for domain test-data construction:

```text
createX()
→ complete domain-valid object
→ strong domain types
→ valid defaults with explicit scenario overrides

createXPayload()
→ request-payload variation
→ starts from createX()
→ may intentionally omit request fields
→ may return Partial<RequestType>
```

Examples:

```text
createTestUser()
→ complete valid TestUser

createTestUserPayload()
→ controlled partial user request payload

createTask()
→ complete valid task request

createTaskPayload()
→ controlled partial task request payload
```

Business-invalid values that are still valid according to the TypeScript type may be supplied through normal factory overrides.

Examples:

```text
password: "12345"
email: ""
```

Do not weaken strong domain types merely to allow values that are intentionally invalid at runtime.

For values rejected by the TypeScript/domain type itself, construct the malformed value explicitly and locally in the negative test that owns the scenario.

Example:

```text
TaskPriority
→ "low" | "medium" | "high"

unsupported runtime value
→ explicit negative-test payload
→ do not widen TaskPriority to string
```

Prefer the smallest explicit negative-test escape from the type system.

Do not introduce generic invalid-data factories or weaken shared domain types solely to support malformed runtime inputs.

Factories must not:

- call APIs;
- interact with UI;
- perform assertions;
- manage test lifecycle.

Before creating a new factory, determine whether the existing domain factory can be extended cleanly.

## Fixture Standard

Create or extend a fixture when the behavior provides meaningful:

- reusable setup;
- state;
- dependency composition;
- lifecycle management.

Do not create a fixture solely to hide trivial construction.

Fixture ordering should communicate logical dependency flow rather than alphabetical ordering.

When adding a fixture:

1. identify its dependencies;
2. reuse existing lower-level fixtures;
3. keep its responsibility focused;
4. clean up owned resources when required;
5. preserve authentication boundaries.

Authenticated fixtures use the role accounts: `apiTokenFor(role)` for API tokens and `authenticatedPageFor(getRoleCredentials(role))` for browser pages (see the [Authentication Standard](#authentication-standard)).

Database fixtures additionally must preserve the database execution boundary, reuse the shared `DatabaseClient`, and close the owned connection pool after use.

A fixture must not bypass the `allow.database` permission guard merely to make a database test executable in another environment.

## Authentication Standard

Do not treat API authentication and browser authentication as interchangeable.

```text
API
→ Bearer JWT

Browser
→ Auth.js session
```

A project authenticates with role accounts configured in `config/framework.config.ts` (`auth` and `roles`), whose credentials come from `.env` or CI secrets:

```text
apiTokenFor(role)
→ bearer token for the role, logged in once per test

authenticatedPageFor(getRoleCredentials(role))
→ Page in a new browser context with a programmatic session,
  closed after the test
```

Project fixtures build API clients, Page Objects and test-owned data on top of these, as in the `app-fixtures` template.

The UPEX reference implementation registers a fresh user per test instead, and the golden templates derived from it use its fixture names:

```text
testUserData            → generated only
registeredTestUser      → registered
authenticatedTestUser   → registered + API authenticated
authenticatedPage       → browser-authenticated Page
```

In a project, replace them with role-based fixtures: `authenticatedTestUser.accessToken` becomes `await apiTokenFor("<role>")`, and a Page Object built from `authenticatedPage` is built from `authenticatedPageFor(getRoleCredentials("<role>"))`. Do not copy the fresh-user registration into a project that uses role accounts.

Do not replace programmatic browser authentication with UI login merely for convenience.

UI login should be performed when login behavior itself is under test.

Objects interacting with an authenticated Page must be constructed from that Page or from a fixture that explicitly depends on it.

## Page Object Standard

Page Objects should follow this structural grammar:

```text
external imports

internal imports

class
  page
  locators

  constructor
    page assignment
    locator assignments

  navigation methods

  user action methods

  locator query/helper methods
```

Only include sections that the Page Object actually needs.

Prefer meaningful domain actions over exposing low-level interaction sequences to specs.

Example:

```ts
await loginPage.login(email, password);
```

rather than:

```ts
await loginPage.emailInput.fill(email);
await loginPage.passwordInput.fill(password);
await loginPage.loginButton.click();
```

when the behavior being tested is not the individual field interaction.

Assertions normally remain in specs.

## Component Object Standard

Use a Component Object for a reusable UI region that does not represent an entire page.

Scope child locators to the component root when the real DOM hierarchy supports it.

Do not force root scoping when the application renders an element outside the component subtree.

Portal-rendered dropdowns, dialogs, menus, and similar UI may require page-scoped locators.

DOM reality takes precedence over visual or structural symmetry.

## UI Spec Standard

UI tests should normally follow:

```text
prerequisite / setup

action

primary assertion
related assertions
```

Related assertions should remain visually grouped.

Do not insert blank lines between every assertion.

Do not add generic comments such as:

```ts
// Arrange
// Act
// Assert
```

The test structure should communicate these phases without commentary.

Comments should explain non-obvious reasons rather than restating code.

UI and smoke tests must remain compatible with the browser projects that own them.

Do not introduce browser-specific behavior into a shared test unless the difference is intentional and documented.

### API/UI Composition

Prefer API or programmatic setup when UI setup would make a test slower, more brittle, or unrelated to the behavior under test.

For example:

```text
register through API
→ establish browser session programmatically
→ verify authenticated UI behavior
```

Do not use UI flows merely because the final assertion is a UI assertion.

The setup mechanism should serve the behavior being tested.

An API-assisted UI test remains a browser-dependent UI test when the observable behavior under validation is UI behavior.

Its execution ownership therefore remains with the browser projects rather than the API project.

## Accessibility Test Standard

Automated accessibility tests use the dedicated `accessibility` Playwright project and belong under:

```text
tests/accessibility/**
```

The current golden pattern is a full-page accessibility scan after the required application state has been established.

Typical flow:

```text
establish meaningful page state
        ↓
AccessibilityScanner
        ↓
central WCAG policy
        ↓
axe analysis
        ↓
formatted diagnostics
        ↓
spec assertion
```

Use the existing `AccessibilityScanner` rather than constructing `AxeBuilder` directly inside specs.

The scanner owns technical scan execution and application of the framework's central WCAG policy.

Specs own the quality decision.

Preferred assertion pattern:

```ts
const result = await accessibility.scanPage();

expect(
  result.violations,
  formatAccessibilityViolations(result.violations),
).toEqual([]);
```

The formatter exists only to make failures understandable. It must not:

- remove violations;
- suppress violations;
- change severity;
- decide whether the test passes;
- convert a real violation into a passing result.

The framework's automated accessibility policy targets WCAG 2.2 Level AA through the central axe tag configuration.

Do not duplicate WCAG tags inside individual specs.

Do not silently broaden or narrow the policy for an individual test merely to change its result.

Automated axe results are not equivalent to complete WCAG conformance.

```text
automated axe coverage
≠
complete accessibility certification
```

Manual accessibility testing remains necessary for requirements that cannot be reliably validated through automated rules.

Public-page accessibility tests should use the scanner associated with the standard Playwright `page`.

Authenticated accessibility tests use a scanner built from the authenticated `Page`, in a project fixture that depends on that Page (the UPEX reference calls it `authenticatedAccessibility`).

```text
page
→ accessibility (framework fixture)

authenticated Page
→ project fixture: new AccessibilityScanner(authenticatedPage)
```

Do not use a scanner created from one Page context to validate state owned by another Page context.

Accessibility failures are quality signals.

Do not use:

```text
continue-on-error
```

or violation suppression merely to keep the pipeline green.

A real accessibility violation should fail the accessibility test unless an explicit, reviewed policy defines a justified exception.

The current golden template intentionally uses representative full-page coverage rather than manufacturing component-level or selector-based abstractions without a demonstrated need.

Do not add accessibility-specific selectors, test IDs, Page Object properties, or helper abstractions solely to support hypothetical scoped scanning.

If a concrete future requirement needs component-scoped accessibility analysis, design the smallest clean abstraction after the ownership model is understood.

Accessibility tests currently execute through Chromium once rather than through the full UI browser matrix.

Do not duplicate them across Chromium, Firefox, and WebKit merely because accessibility behavior can theoretically vary between browser environments. Add browser-specific accessibility execution only when a concrete requirement or observed behavior demonstrates that additional coverage is valuable.

## Visual Regression Test Standard

Visual regression tests use the dedicated `visual` Playwright project and belong under:

```text
tests/visual/**
```

The current golden pattern uses Playwright's native screenshot comparison through `toHaveScreenshot()`.

Visual regression coverage should verify intentional visual state rather than duplicate functional assertions already owned by API or UI tests.

The current execution boundary is:

```text
visual project
→ Chromium
→ canonical Docker/Linux runtime
→ version-controlled screenshot baselines
```

Do not multiply the same visual coverage across Chromium, Firefox, and WebKit merely because the functional UI suite uses a browser matrix.

Additional browser-specific visual baselines should be introduced only when a concrete visual compatibility requirement justifies their maintenance cost.

### Visual Baseline Standard

Visual baselines are version-controlled test assets owned by the visual spec that uses them.

Keep Playwright's spec-local snapshot structure rather than introducing a separate global baseline repository without a demonstrated need.

Baseline generation must use the canonical Docker/Linux visual runtime.

```text
visual spec
→ canonical Docker/Linux execution
→ approved baseline
→ version-controlled snapshot
→ CI comparison
```

Do not generate or update canonical baselines from an arbitrary local host environment when operating-system, font-rendering, or browser-rendering differences can change screenshot output.

Baseline updates must be intentional and reviewed.

Do not use:

```text
--update-snapshots
```

in normal visual comparison CI execution.

A changed screenshot must not automatically become the new expected result merely to make the visual test pass.

### Visual State Standard

Visual comparisons must execute against deterministic application state.

Prefer existing factories, API setup, fixtures, Page Objects, and Component Objects to establish the required state rather than reproducing setup logic inside the visual assertion.

The current framework intentionally supports both:

```text
page-level comparison
→ validates the composed dashboard state

component-level comparison
→ validates a focused task card state
```

Choose the smallest screenshot scope that represents the visual behavior being protected.

Do not create component-level screenshot coverage merely to mirror page-level coverage.

Dynamic or unstable state should be controlled through deterministic test data and existing framework setup before introducing visual masking or threshold relaxation.

### Visual Comparison Policy

Use the framework's central visual comparison policy rather than defining arbitrary screenshot tolerances independently in individual specs.

Do not add global visual thresholds merely because minor differences are possible.

Do not introduce masks, custom tolerances, or ignored regions without a concrete unstable visual element that cannot be made deterministic through cleaner state control.

A real visual difference must remain visible as a failing quality signal until it is intentionally reviewed and accepted.

Do not wrap Playwright's native screenshot assertions in a visual helper for symmetry with other layers; introduce one only when repeated real scenarios need behavior the native assertion and the central policy do not express.

### Visual CI Standard

CI compares; it never generates or approves baselines.

```text
version-controlled baseline
→ run the visual project in the canonical Linux Playwright image
→ compare actual rendering against the baseline
→ preserve the report and failure diagnostics
```

CI must not use:

```text
--update-snapshots
```

A visual mismatch must fail the visual test rather than automatically updating the expected screenshot. CI uses the same runtime that generated the approved baselines, so operating-system, browser and rendering differences do not create avoidable noise.

### Visual Completion Checks

```text
deterministic visual state established
        ↓
correct screenshot scope selected
        ↓
baseline generated in the canonical Linux runtime
        ↓
baseline intentionally reviewed
        ↓
version-controlled baseline committed
        ↓
visual project comparison passes
        ↓
CI comparison remains update-free
```

## API Performance Standard

API workload performance runs in the k6 runtime under `tests/performance/k6/`, not as a Playwright project. It separates prerequisite setup from the measured workload. The UPEX reference workload (`tests/performance/k6/taskReadLoad.js`):

```text
setup
├── register performance user
├── authenticate performance user
└── create dedicated task
        ↓
measured workload
└── authenticated GET /tasks
        ↓
teardown
└── delete dedicated task
```

Setup prerequisites must succeed before the measured scenario begins, and their latency must not contaminate the workload metric.

### Transport

Use native k6 HTTP APIs. Do not import Playwright API clients, fixtures, request contexts or Node-specific infrastructure into a k6 workload to remove superficial duplication. Runtime-neutral configuration may be shared; transport stays with the runtime that executes it.

### Workload

A workload states what behavior and load model it measures. The reference uses `constant-vus` with 2 virtual users for 30 seconds and 1 second pacing: a controlled baseline against a shared application.

Do not describe a workload as capacity, stress, spike, soak or endurance testing unless the workload and environment are designed for that purpose. Do not increase virtual users, duration or request rate against shared infrastructure to make a workload look more realistic; load reflects the test purpose and the ownership of the target environment.

The measured operation avoids creating data on every iteration. Data the workload needs is created in setup and deleted in teardown where the provider supports deletion (the reference performance user remains because UPEX has no account-deletion endpoint).

### Metrics

The measured operation owns workload-specific metrics when global HTTP metrics include setup traffic. The reference uses `task_read_duration` (Trend) and `task_read_failures` (Rate), plus a check that the measured request returns `200`. Checks confirm the operation succeeded; they do not duplicate the functional API contract tests. Global k6 metrics may remain as diagnostics, but the quality gate corresponds to the measured operation.

### Thresholds

Thresholds are native k6 thresholds on the workload metrics. The reference uses `p(95) < 500` ms and a failure `rate < 1%`, calibrated from repeated baseline runs against the shared environment; they are not a provider SLA.

Do not choose or change a threshold because a round number looks reasonable, one run happened to pass, or a failing pipeline needs to become green. Before introducing or changing one, consider the measured operation, the workload model, the target environment, repeated baseline evidence, normal variation and any product or service-level requirement.

A threshold failure remains a failing quality signal. Do not use `continue-on-error` or anything equivalent to turn it into a success.

### Environment, Runtime and Reporting

The target comes from `config/environments/environments.json`: the workflow passes the selected environment's `apiBaseUrl` to k6 as `TARGET_BASE_URL`, and only environments with `allow.performance` are measured. Do not hardcode URLs in a workload, and do not import the TypeScript environment adapter into k6.

k6 runs in the pinned `grafana/k6` image, never a floating tag and never installed into the Playwright image, with `--rm` and as the host user (`--user "$(id -u):$(id -g)"`) so report files stay writable. The performance workflow is triggered manually because it loads a shared environment.

The k6 web dashboard export is the human-readable report; thresholds, not the report, decide the result. CI keeps the report as an artifact even when the run fails. The reference also uses `framework/core/performance/k6/k6SummaryReporter.js`, which is specific to its metrics (ARCHITECTURE.md, Known Gaps).

Do not wrap native k6 HTTP, metrics, scenarios or thresholds in framework abstractions for symmetry with the Playwright layers.

### API Performance Completion Checks

```text
k6 runtime boundary preserved
        ↓
setup and measured behavior separated
        ↓
workload-specific metrics and native thresholds defined
        ↓
thresholds supported by repeated baseline evidence or authoritative requirements
        ↓
target resolved from environments.json (apiBaseUrl → TARGET_BASE_URL)
        ↓
workload runs in the pinned k6 image and produces its report
```

## Browser Performance Standard

Browser performance uses Lighthouse to measure browser-observed page performance.

Standalone LHCI may measure a configured public application state directly. Authenticated browser-performance scenarios use the dedicated `performance` Playwright project when existing framework setup is required to establish the representative state.

Before introducing new browser-performance setup, inspect the existing functional coverage for deterministic initialization that already represents the required business state.

```text
discover existing deterministic setup
→ reuse existing fixtures / API setup / Page Objects
→ establish representative browser state
→ confirm the state is ready
→ begin Lighthouse measurement
```

Authenticated Lighthouse scenarios use repeated measurement rather than gating on a single browser-performance sample.

The current authenticated baseline performs three independent Lighthouse measurements and evaluates the shared Lighthouse quality policy against the median value of each measured metric.

```text
deterministic authenticated state
→ Lighthouse run 1
→ Lighthouse run 2
→ Lighthouse run 3
→ median metric aggregation
→ shared threshold and severity evaluation
```

Individual run metrics and reports remain available as execution evidence. Median aggregation reduces sensitivity to normal single-run variance; it must not be used to hide reproducible performance regressions.

Do not duplicate business-state initialization solely for performance coverage when the framework already provides deterministic setup for the same state.

Performance coverage should change the measurement layer rather than recreate the application-state initialization layer.

For the current authenticated dashboard baseline:

```text
existing authenticated fixture chain
→ deterministic task creation
→ dashboard navigation
→ task visibility confirmed
→ authentication transferred to Lighthouse browser
→ Lighthouse audit
```

Playwright owns scenario and browser-state orchestration. Lighthouse owns browser-performance measurement.

### Lighthouse Policy

Standalone LHCI and authenticated scenarios share one threshold and severity policy, `framework/core/performance/lighthouse/lighthouseThresholds.json`:

```text
error
→ quality-gate violation
→ failing execution

warn
→ diagnostic regression signal
→ execution remains successful
```

Both paths audit the selected environment's `webBaseUrl` from `config/environments/environments.json`, and only where `allow.performance` is set; do not keep a separate Lighthouse environment map or hardcode the URL. The `performance` project runs with retries disabled: variance is handled by repeated measurement and the median, not by test retries.

When no authoritative target exists, calibrate thresholds from repeated measurements of the same controlled state. Do not introduce, relax or reclassify a threshold or severity because a single run produced a convenient value, run-to-run variance was not established, or a failing execution needs to become green. Before changing one, review the measured page and state, the target environment, repeated evidence, normal variance, whether the measurement model changed, and any product requirement. `warn` violations are not silently suppressed.

Reuse `LighthouseRunner`, the shared policy and `attachLighthouseReport()` rather than creating parallel Lighthouse infrastructure.

### Browser Performance Completion Checks

```text
existing deterministic setup reused
        ↓
representative state confirmed before measurement
        ↓
repeated measurement evaluated against the shared policy
        ↓
target resolved from environments.json (webBaseUrl)
        ↓
Lighthouse HTML / JSON evidence generated
        ↓
error / warn semantics preserved
```

## Mock Standard

Before creating a mock:

1. determine the exact network behavior that must be controlled;
2. intercept only the required request;
3. preserve unrelated traffic;
4. reproduce realistic provider behavior;
5. keep assertions in the spec.

Do not create a generic mock abstraction before repeated mocking behavior demonstrates a need.

A mocked UI test remains browser-dependent if it verifies UI behavior.
