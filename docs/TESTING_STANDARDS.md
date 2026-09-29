# Testing Standards

## Purpose

This document defines the implementation standards for creating, modifying, placing, and executing tests in the Playwright Enterprise Framework.

`ARCHITECTURE.md` defines where responsibilities belong and why. This document defines how those architectural rules are applied during implementation.

These standards apply to both human contributors and AI-assisted development.

## Core Rule

Before writing code, inspect the existing implementation and determine which framework layers and execution boundaries are actually required.

Do not create a new abstraction merely because a new test or performance workload is being added.

Prefer:

```text
reuse
→ extend
→ create
```

in that order.

Equivalent responsibilities should follow existing golden patterns.

Different responsibilities should not be forced into artificial structural uniformity.

## New Test or Performance Workload Implementation Workflow

When implementing a new test or performance workload, follow this sequence:

```text
Understand the behavior
        ↓
Find an analogous existing test
        ↓
Identify required framework layers
        ↓
Identify required execution project or runtime
        ↓
Reuse existing layers where possible
        ↓
Extend existing layers where appropriate
        ↓
Create missing layers only when required
        ↓
Implement the spec
        ↓
Format
        ↓
Typecheck
        ↓
Run affected project or workload
        ↓
Review architecture impact
```

Before implementation, answer:

1. What behavior is being verified?
2. Is this primarily API, database, UI, accessibility, visual regression, performance, or composed behavior?
3. Is the behavior browser-independent or browser-dependent?
4. Does the behavior belong to a Playwright project, the k6 performance runtime, or Lighthouse browser-performance execution?
5. Is there an existing test or workload demonstrating a similar pattern?
6. Which existing framework components can be reused?
7. Which components genuinely need modification?
8. Is any new abstraction actually required?

## Test Placement and Project Selection

Test location communicates execution responsibility.

Current ownership:

```text
tests/api/**
→ api project

tests/database/**
→ database project
→ localDocker

tests/accessibility/**
→ accessibility project
→ Chromium

tests/visual/**
→ visual project
→ Chromium

tests/performance/**
→ performance project
→ Chromium

tests/ui/**
→ chromium
→ firefox
→ webkit

tests/smoke/**
→ chromium
→ firefox
→ webkit

performance/k6/**
→ k6 performance runtime

performance/lighthouse/**
→ Lighthouse execution, policy, and reporting infrastructure
```

API tests are browser-independent and must execute through the dedicated `api` project.

Database tests are browser-independent persistence validations and must execute through the dedicated `database` project against the `localDocker` environment. The database project executes once with retries disabled rather than being multiplied across browser projects.

Accessibility tests use browser-rendered application state but execute through the dedicated `accessibility` project. The current automated accessibility gate runs once through Chromium rather than being multiplied across the full UI browser matrix.

Visual regression tests use browser-rendered application state but execute through the dedicated `visual` project. The current visual gate runs once through Chromium in the canonical Docker/Linux runtime rather than maintaining equivalent baselines across the full UI browser matrix.

UI and smoke tests are browser-dependent and execute through browser projects.

API performance workloads are not Playwright projects. They execute through the dedicated k6 runtime under `performance/k6/**`.

Authenticated browser-performance scenarios belong under `tests/performance/**` and execute through the dedicated `performance` Playwright project when Playwright-owned fixtures, Page Objects, or authenticated browser state are required to establish the representative state measured by Lighthouse.

Do not allow API tests to run once per browser simply because browser projects exist.

Do not multiply automated accessibility tests across the UI browser matrix unless a concrete browser-specific accessibility requirement demonstrates a need.

Do not multiply visual regression tests across the UI browser matrix unless a concrete browser-specific visual requirement justifies maintaining additional browser-specific baselines.

Do not use browser projects for HTTP-only contract validation.

When adding a new API test:

```text
place under tests/api
→ execute with --project=api
```

When adding a new database test:

```text
place under tests/database
→ execute with --project=database
→ execute against localDocker
```

When adding a new accessibility test:

```text
place under tests/accessibility
→ execute with --project=accessibility
```

When adding a new visual regression test:

```text
place under tests/visual
→ execute with --project=visual
```

When adding a new UI or smoke test:

```text
place under tests/ui or tests/smoke
→ execute through the intended browser project
```

When adding a new k6 performance workload:

```text
place under performance/k6
→ execute through the k6 runtime
```

When adding a new authenticated Lighthouse browser-performance scenario:

```text
place under tests/performance
→ execute with --project=performance
→ reuse existing deterministic setup
→ measure with Lighthouse
```

If the test or workload behavior does not fit an existing execution boundary, review the architecture before introducing a new project or runtime boundary.

## Layer Decision Guide

Use this guide when deciding what must change.

```text
Need to call a new API endpoint?
→ API Client

Need to define or change a provider request/response contract?
→ Schema

Need direct persistence validation?
→ Domain Database Client

Need PostgreSQL transport or connection lifecycle?
→ DatabaseClient

Need to restore the dedicated test database baseline?
→ explicit database reset utility

Need reusable stable domain values?
→ Constants

Need generated or reusable test data?
→ Factory

Need reusable setup, state, dependency composition, or lifecycle?
→ Fixture

Need page-level UI interaction?
→ Page Object

Need reusable UI-region interaction?
→ Component Object

Need automated accessibility analysis?
→ AccessibilityScanner

Need shared visual comparison policy?
→ Visual constants/configuration

Need controlled API performance workload?
→ k6 workload

Need workload-specific performance measurement?
→ k6 custom metric / threshold

Need browser-observed performance measurement?
→ Lighthouse / LHCI

Need authenticated browser-performance measurement?
→ reuse existing deterministic Playwright setup
→ performance project
→ Lighthouse measurement

Need controlled network behavior?
→ Mock

Need to verify behavior?
→ Spec
```

Not every test or performance workload requires every layer.

A new test or performance workload should modify the smallest set of layers necessary to represent the behavior correctly.

## Existing Implementation First

Before creating a new file or abstraction:

1. search for an existing implementation with the same responsibility;
2. inspect at least one analogous implementation;
3. determine whether the existing component can be extended;
4. preserve the established structural pattern where the responsibility is equivalent;
5. inspect the execution project used by the analogous test.

For example:

```text
New user API behavior
→ inspect UserApiClient
→ inspect user schemas
→ inspect userFactory
→ inspect relevant fixtures
→ inspect existing user API specs
→ keep execution in the api project
```

or:

```text
New database validation
→ inspect existing database specs
→ inspect relevant API setup and factory
→ reuse fixture-provided domain database client
→ keep SQL inside the database client layer
→ keep assertions in the spec
→ keep execution in the database project
```

or:

```text
New task UI behavior
→ inspect TasksDashboardPage
→ inspect relevant components
→ inspect taskFactory
→ inspect authenticated fixtures
→ inspect existing task UI specs
→ keep execution in browser projects
```

or:

```text
New accessibility coverage
→ inspect existing accessibility specs
→ inspect relevant Page Object and fixtures
→ reuse AccessibilityScanner
→ reuse the central WCAG policy
→ keep assertions in the spec
→ keep execution in the accessibility project
```

or:

```text
New visual regression coverage
→ inspect existing visual specs
→ inspect relevant Page Object and locators
→ reuse existing factories and API setup where appropriate
→ establish deterministic visible state
→ reuse the central visual comparison policy
→ keep screenshot assertions in the spec
→ keep execution in the visual project
```

or:

```text
New performance coverage
→ identify whether the target is API workload performance or browser performance
→ inspect the analogous existing implementation
→ preserve the existing runtime and measurement boundary
→ reuse shared environment configuration where applicable
→ reuse existing deterministic setup where applicable
→ keep setup outside the measured behavior when setup is not the target
→ calibrate thresholds from repeated baseline evidence
```

API workload performance
→ use native k6 HTTP and metrics
→ keep execution in the k6 runtime

Browser performance
→ reuse existing Playwright fixtures and browser-state setup when required
→ keep Lighthouse measurement separate from scenario setup
→ use the shared Lighthouse threshold policy
→ keep authenticated browser-performance scenarios in the performance Playwright project

Existing implementations are reference patterns, not templates to copy blindly.

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

Database execution is guarded to:

```text
TEST_ENV=localDocker
```

Do not run the database project against `hosted`, `local`, or another environment merely because a database connection string is available.

Database tests use unique generated data so independent executions do not rely on shared mutable records.

The database project executes with:

```text
retries: 0
```

Persistent state is intentionally retained after a normal database test run for debugging and forensic inspection. Do not add per-test destructive cleanup merely to make the database appear clean after every execution.

### Database Reset Standard

The dedicated test database may be restored through the explicit reset workflow when a known baseline is required.

The reset responsibility is:

```text
validate localDocker environment
→ require explicit destructive-operation confirmation
→ validate database connection configuration
→ verify Docker availability
→ recreate public schema
→ restore application schema with db:push
→ restore application seed data
→ verify baseline state
```

The reset workflow is destructive and is valid only for the dedicated disposable test-owned database.

It must not be generalized to a shared, non-test, staging, or production database.

Normal test execution must not invoke the reset automatically.

When an explicit clean baseline is required, use the framework-owned reset command:

```bash
npm run db:test:reset
```

The application remains the owner of schema and seed restoration. The framework reset utility orchestrates the reset but does not duplicate the application's schema definition or seed logic.

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

Database fixtures additionally must preserve the database execution boundary, reuse the shared `DatabaseClient`, and close the owned connection pool after use.

A fixture must not bypass the `localDocker` database safety guard merely to make a database test executable in another environment.

## Authentication Standard

Do not treat API authentication and browser authentication as interchangeable.

```text
API
→ Bearer JWT

Browser
→ Auth.js session
```

Use the fixture matching the required state:

```text
testUserData
→ generated only

registeredTestUser
→ registered

authenticatedTestUser
→ registered + API authenticated

authenticatedPage
→ browser-authenticated Page
```

Do not replace programmatic browser authentication with UI login merely for convenience.

UI login should be performed when login behavior itself is under test.

Objects interacting with `authenticatedPage` must be constructed from that Page or from a fixture that explicitly depends on it.

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

Authenticated accessibility tests should use the scanner associated with `authenticatedPage`.

```text
page
→ accessibility

authenticatedPage
→ authenticatedAccessibility
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

### Visual CI Standard

Visual regression execution uses the dedicated `visual` Playwright project in CI.

The CI responsibility is comparison, not baseline generation.

```text
version-controlled baseline
→ run visual project in canonical Docker/Linux runtime
→ compare actual rendering against baseline
→ preserve report and failure diagnostics
```

Normal CI execution must not use:

```text
--update-snapshots
```

A visual mismatch must fail the visual test rather than automatically updating the expected screenshot.

Visual CI should preserve the same canonical runtime used to generate approved baselines so operating-system, browser, and rendering differences do not create avoidable noise.

Visual reports and failure diagnostics are execution evidence and should be preserved through the framework's normal CI artifact strategy.

The visual job should remain independent from API, accessibility, and browser-matrix jobs after the reusable Playwright image is available.

A visual failure must not prevent independent test jobs from producing their own quality signals.

## Performance Test Standard

Performance testing uses separate execution and measurement boundaries for API workload performance and browser-observed performance:

```text
API workload performance
→ performance/k6/**
→ k6 runtime

Browser performance
→ performance/lighthouse/**
→ Lighthouse measurement

Authenticated browser-performance scenarios
→ tests/performance/**
→ performance Playwright project
```

Do not implement a k6 workload as a Playwright project merely to reuse the Playwright test runner.

Use the performance Playwright project only when browser-performance coverage requires Playwright-owned fixtures, Page Objects, or authenticated browser state to establish the representative state measured by Lighthouse.

### API Performance Standard

The current golden API performance pattern separates prerequisite setup from the measured workload:

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

Registration and authentication must succeed before the measured scenario begins.

Their latency must not contaminate the workload-specific task-read latency metric.

### API Performance Transport Standard

Use native k6 HTTP APIs for k6 workloads.

Do not import:

- Playwright API clients;
- Playwright fixtures;
- Playwright request contexts;
- Node-specific runtime infrastructure;

into the k6 workload merely to remove superficial code duplication.

The runtime boundary is intentional:

```text
Playwright API client
→ functional API automation

k6 HTTP
→ performance workload generation
```

Shared runtime-neutral configuration may be reused across both execution technologies.

Runtime-specific transport remains owned by the runtime that executes it.

### API Performance Workload Standard

A performance workload must communicate what behavior and load model it measures.

The current authenticated task-read baseline uses:

```text
executor
→ constant-vus

virtual users
→ 2

duration
→ 30 seconds

pacing
→ 1 second between iterations
```

This is a controlled baseline against a shared hosted application.

It must not be described as:

- production capacity testing;
- stress testing;
- spike testing;
- soak testing;
- endurance testing;

unless the workload and execution environment are explicitly designed for that purpose.

Do not increase virtual users, execution duration, or request rate against shared infrastructure merely to make a workload appear more realistic.

Load level must reflect the intended test purpose and the ownership constraints of the target environment.

The measured read workload intentionally avoids task creation so repeated iterations do not create uncontrolled task-data pollution.

A dedicated task is created during setup and deleted during teardown. The generated performance user remains because the target application does not expose a supported account-deletion endpoint.

### API Performance Metric Standard

Measured operations should own workload-specific metrics when global HTTP metrics include setup or unrelated traffic.

The current task-read baseline uses:

```text
task_read_duration
→ Trend measuring GET /tasks response duration

task_read_failures
→ Rate measuring failed GET /tasks operations
```

The measured task-read request must also have a functional check confirming that the response status is `200`.

Checks validate that the workload operation succeeded. They should not duplicate the full functional API contract suite already owned by Playwright API tests.

Registration and authentication remain fail-fast setup prerequisites.

Do not use registration or authentication latency to decide whether the task-read operation satisfies its latency threshold.

Global k6 HTTP metrics may remain useful diagnostic signals, but the primary quality gate should correspond to the operation being evaluated.

### Performance Threshold Standard

Performance thresholds are executable quality boundaries and should remain owned by the measurement technology that evaluates them.

```text
k6
→ native workload thresholds

Lighthouse / LHCI
→ shared Lighthouse threshold and severity policy
```

The current calibrated thresholds are:

```text
task_read_duration
→ p(95) < 500 ms

task_read_failures
→ rate < 1%
```

The latency threshold is based on repeated baseline executions against the current shared hosted environment and includes reasonable headroom for the observed tail-latency variation.

It must not be represented as a provider SLA or production capacity guarantee.

Do not choose or change a performance threshold because:

- a round number appears reasonable;
- one execution happened to pass at that value;
- a failing pipeline needs to become green.

Before introducing or changing a threshold, consider:

- the measured operation;
- the workload model;
- the target environment;
- repeated baseline evidence;
- normal observed variation;
- any applicable product or service-level requirement.

A threshold failure must remain a failing performance quality signal.

Do not use `continue-on-error` or equivalent behavior to convert a real threshold failure into a successful quality result.

Lighthouse thresholds use shared values and severities because standalone LHCI and authenticated Playwright + Lighthouse execution consume the same browser-performance quality policy.

```text
error
→ quality-gate violation
→ failing execution

warn
→ diagnostic regression signal
→ execution remains successful
```

When no authoritative SLA, SLO, or approved browser-performance target exists, calibrate Lighthouse thresholds from repeated measurements of the same controlled representative state.

Do not introduce or relax a Lighthouse threshold because:

- a single execution produced a convenient value;
- normal run-to-run variance was not established;
- a failing execution needs to become green.

Before changing a Lighthouse threshold or severity, review:

- the page and application state being measured;
- the target environment;
- repeated baseline evidence;
- normal observed variance;
- whether the measurement model changed;
- any applicable product or service-level requirement.

### Performance Reporting Standard

Performance execution must provide both an executable quality signal and human-readable evidence.

These responsibilities are separate.

For API performance, the separation is:

```text
k6 metrics
        ↓
thresholds
        ↓
PASS / FAIL quality gate

k6 metrics
        ↓
HTML report
        ↓
human-readable execution evidence
```

The current performance workload uses the built-in k6 web dashboard export to generate:

```text
performance-results/k6/task-read-load.html
```

Performance evidence should remain grouped by execution technology so independent performance capabilities do not share a flat output namespace.

````text
performance-results/
├── k6/
└── lighthouse/

Lighthouse execution preserves browser-performance evidence separately from k6 workload evidence:

```text
standalone LHCI
→ Lighthouse HTML / JSON reports

authenticated Playwright + Lighthouse
→ Lighthouse HTML / JSON reports
→ Playwright performance report
```

Lighthouse reporting does not own the quality decision. Threshold and severity evaluation remains responsible for browser-performance PASS / FAIL semantics, while reports provide human-readable and machine-readable execution evidence.

The report should make the workload result understandable without replacing threshold semantics.

A generated HTML report must not decide whether the performance test passes.

Threshold evaluation remains the executable quality gate.

CI should preserve the generated report as an artifact even when the performance execution fails, so the failure remains diagnosable.

A report-upload problem must not silently hide missing performance evidence.

Do not introduce a custom `handleSummary()` implementation or third-party reporting dependency while the native k6 reporting capability satisfies the current requirement.

### Performance Environment Standard

Performance workloads must reuse the framework's runtime-neutral environment configuration rather than maintain a separate hardcoded environment map.

The shared source of truth is:

```text
config/environments/environments.json
````

The API-performance environment ownership model is:

```text
environments.json
→ runtime-neutral environment data

environment.ts
→ typed Node / Playwright adapter

performance workflow
→ resolve selected apiBaseUrl
→ TARGET_BASE_URL
→ k6 runtime
```

The performance workload receives its target through:

```text
TARGET_BASE_URL
```

It must not hardcode the hosted API URL when that value is already owned by the shared environment configuration.

`TEST_ENV` selects the logical framework environment.

`TARGET_BASE_URL` is the resolved API URL supplied to the k6 runtime.

These variables represent different responsibilities and should not be treated as interchangeable.

Do not import the TypeScript environment adapter into k6 merely to reuse configuration. k6 and Playwright should share runtime-neutral environment data while retaining runtime-specific adapters and execution boundaries.

Lighthouse browser-performance execution uses the same shared environment configuration:

```text
TEST_ENV
→ config/environments/environments.json
→ webBaseUrl
→ Lighthouse browser audit target
```

Do not maintain a separate Lighthouse environment map or hardcode the application URL in Lighthouse configuration, runners, or performance specs.

The environment responsibility remains separated by measurement target:

```text
API performance
→ apiBaseUrl

Browser performance
→ webBaseUrl
```

### Performance Docker Runtime Standard

k6 performance execution uses its own purpose-built runtime rather than the Playwright test image.

The current runtime image is pinned to:

```text
grafana/k6:1.8.1
```

The runtime ownership is intentionally separate:

```text
Playwright image
→ Playwright API, accessibility, visual, and browser UI execution

k6 image
→ performance workload execution
```

Do not install k6 into the Playwright Docker image merely to create one universal test container.

The performance runtime mounts:

```text
performance/k6
→ /scripts

performance-results
→ /reports
```

The container must run with the host runner's user and group identity when writing report files into the mounted results directory:

```text
--user "$(id -u):$(id -g)"
```

This prevents container-created report files from becoming unwritable or inaccessible to the GitHub Actions runner.

Performance containers should remain ephemeral through:

```text
--rm
```

The k6 image version must remain explicitly pinned so local and CI execution do not silently change runtime versions.

Runtime upgrades should be intentional and validated rather than obtained implicitly through a floating image tag.

Browser performance does not use the k6 container.

The runtime boundary follows the measurement responsibility:

```text
API workload performance
→ pinned k6 Docker runtime

Browser performance
→ Node.js + Chrome / Chromium
→ Lighthouse / LHCI

Authenticated browser performance
→ Playwright performance project for scenario orchestration
→ Lighthouse for measurement
```

Do not introduce a universal performance container merely to make k6 and Lighthouse execution structurally identical. Each performance capability should use the runtime appropriate to the tool and measurement responsibility.

### Performance CI Standard

The current hosted performance capabilities execute through the dedicated:

```text
.github/workflows/performance.yml
```

workflow.

Execution is manually triggered through:

```text
workflow_dispatch
```

because the hosted target is shared infrastructure rather than an isolated performance environment.

Do not automatically run the current hosted performance capabilities on every pull request or push merely because the underlying tools support automated execution.

The current workflow responsibility is:

```text
resolve TEST_ENV
→ read shared environment configuration
→ resolve apiBaseUrl
→ pass TARGET_BASE_URL to k6
→ run pinned k6 container
→ evaluate thresholds
→ export HTML report
→ preserve report as CI evidence
```

Browser-performance execution is owned by a separate job in the same performance workflow.

The browser-performance responsibility is:

```text
resolve TEST_ENV
→ read shared environment configuration
→ resolve webBaseUrl
→ install browser-performance runtime
→ run standalone LHCI
→ run authenticated Playwright + Lighthouse
→ evaluate Lighthouse quality policy
→ preserve Lighthouse and Playwright reports as CI evidence
```

The standalone and authenticated Lighthouse paths provide complementary coverage:

```text
standalone LHCI
→ configured browser-performance baseline

authenticated Playwright + Lighthouse
→ deterministic authenticated application state
→ browser-performance measurement
```

Do not merge API load generation and browser-performance measurement into one execution job merely because both belong to performance testing.

Performance threshold evaluation owns the quality result.

A threshold failure must fail the performance execution.

Report export and artifact upload are diagnostic responsibilities and must not convert a failing threshold result into a successful quality result.

The current shared-hosted performance execution should avoid overlapping framework-owned runs against the same target.

Concurrency should therefore favor measurement isolation rather than maximum parallelism.

The performance workflow is intentionally separate from the main Playwright workflow because performance execution has its own cadence, measurement responsibilities, evidence, and target-safety constraints.

API load generation remains owned by the k6 job.

Browser-performance measurement remains owned by the browser-performance job, with Playwright used only where framework-owned scenario setup and authenticated browser state are required before Lighthouse measurement.

### Browser Performance Standard

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

## API/UI Composition

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

## Mock Standard

Before creating a mock:

1. determine the exact network behavior that must be controlled;
2. intercept only the required request;
3. preserve unrelated traffic;
4. reproduce realistic provider behavior;
5. keep assertions in the spec.

Do not create a generic mock abstraction before repeated mocking behavior demonstrates a need.

A mocked UI test remains browser-dependent if it verifies UI behavior.

## Docker Execution Standard

Docker execution must preserve the same Playwright project ownership and framework behavior as native execution.

Docker changes the execution environment, not the responsibility of the test.

```text
native execution
or
Docker execution
        ↓
same Playwright projects
        ↓
same test ownership
        ↓
same framework behavior
```

The framework supports two distinct local execution modes:

```text
native local
→ TEST_ENV=local
→ application available at localhost:3000

localDocker
→ Docker Compose
→ UPEX application container
→ Playwright test container
→ TEST_ENV=localDocker
→ application available to tests at upex-local:3000
```

The dedicated PostgreSQL / Neon test database remains external to the Compose stack. Do not introduce a local PostgreSQL container merely to make `localDocker` self-contained.

### Image Standard

Use the official Playwright image matching the Playwright version installed by the project lockfile.

The current Playwright base image is:

```text
mcr.microsoft.com/playwright:v1.62.1-noble
```

Do not use an arbitrary `latest` Playwright image.

Browser binaries and operating-system dependencies are provided by the official Playwright image, so the Dockerfile should not reinstall Playwright browsers without a demonstrated need.

Install project dependencies reproducibly with:

```text
npm ci
```

Copy package metadata before the remaining source so dependency installation can use Docker layer caching when dependency metadata has not changed.

The local UPEX application image is built separately from the UPEX source repository through `Dockerfile.upex-local`.

Do not combine the application runtime and Playwright runtime into one universal image.

### Runtime Configuration Standard

Environment-specific configuration must be supplied at container runtime rather than baked into an image.

The framework follows:

```text
build once
→ configure at runtime
```

Container execution environment and test target environment are separate concerns.

Native local execution selects:

```text
TEST_ENV=local
→ http://localhost:3000
```

Compose-based functional execution selects:

```text
TEST_ENV=localDocker
→ http://upex-local:3000
```

Database credentials must be supplied at runtime through `DATABASE_URL`. They must not be stored in `config/environments/environments.json`, committed files, or image layers.

### Project Execution Standard

Use one reusable Playwright test image across the existing Playwright projects.

The `localDocker` Compose runtime owns application startup, health validation, shared networking, runtime configuration, and Playwright execution.

Project selection remains a Playwright execution concern.

The functional project ownership is:

```text
api
→ --project=api

database
→ --project=database

accessibility
→ --project=accessibility

visual
→ --project=visual

UI
→ --project=chromium
→ --project=firefox
→ --project=webkit
```

Do not create separate Docker images for API, database, accessibility, visual, Chromium, Firefox, or WebKit merely because they are separate Playwright projects.

The database project must execute only through the `localDocker` target because its fixture safety guard intentionally rejects other framework environments.

### Container Lifecycle Standard

Automated test containers should normally be ephemeral.

The Playwright process exit code represents the execution result:

```text
0
→ successful execution

non-zero
→ failed execution
```

Do not treat a successfully started container as evidence that the test execution succeeded.

The application container should be stopped after the job completes, including when test execution fails.

### Artifact Persistence Standard

Do not rely on an ephemeral container filesystem for artifacts that must survive execution.

For local Docker execution, the Compose configuration persists Playwright outputs through bind mounts:

```text
playwright-report/
test-results/
```

Visual baseline generation additionally requires the owning snapshot path to persist outside the container lifecycle.

Current visual baseline generation therefore bind-mounts:

```text
tests/visual
→ /app/tests/visual
```

so approved snapshot candidates are written back into the repository working tree.

Do not assume that local Docker bind mounts and CI artifact upload are the same mechanism.

```text
local Docker
→ bind mount

GitHub Actions
→ artifact upload
```

Use the persistence mechanism appropriate to the execution environment.

### Build Context and Secret Standard

The Docker build context must exclude local files that do not belong in the reusable image.

`.dockerignore` should exclude generated outputs, local dependencies, Git metadata, and environment files where applicable.

Current examples include:

```text
node_modules
playwright-report
test-results
.git
.env
.env.*
```

Secrets must not be copied into Docker images.

Do not:

```text
COPY secret
→ use secret
→ delete secret
```

and assume the secret has been removed safely.

Data introduced into an earlier image layer may remain recoverable from the image history.

Runtime credentials, including `DATABASE_URL`, must be supplied through an appropriate runtime secret mechanism rather than embedded into an image.

### Docker and CI Standard

The current GitHub Actions pipeline uses Docker Compose as the functional Playwright execution boundary.

CI builds two executable image types:

```text
Playwright framework image
→ tagged with the framework commit SHA

UPEX local application image
→ tagged with the resolved UPEX upstream commit SHA
```

Both images are built once in `build-images`, published to GitHub Container Registry, and reused by the functional test jobs.

The current CI image flow is:

```text
quality
→ build-images
→ build and publish immutable Playwright image
→ build and publish immutable UPEX image
→ functional jobs pull exact image revisions
→ Docker Compose starts UPEX
→ tests execute with TEST_ENV=localDocker
```

The functional CI capabilities are intentionally separate:

```text
api
database
accessibility
visual
ui matrix
```

API, database, accessibility, visual, and UI jobs must remain independent after `build-images` unless a genuine runtime dependency is introduced.

Playwright remains responsible for selecting the execution project:

```text
API job
→ --project=api

Database job
→ --project=database

Accessibility job
→ --project=accessibility

Visual job
→ --project=visual

UI matrix
→ --project=chromium
→ --project=firefox
→ --project=webkit
```

The visual CI job must compare against committed baselines.

It must not execute:

```text
--update-snapshots
```

CI is a verification boundary, not a baseline approval boundary.

Docker must not introduce separate Playwright images merely to mirror Playwright project boundaries.

Reports and diagnostics that must survive the container lifecycle must be mounted to the GitHub Actions runner and then preserved using the existing CI artifact strategy.

Executable Docker images must be distributed through the container registry rather than uploaded as test-report artifacts.

The ownership boundary is:

```text
GitHub Container Registry
→ executable Playwright framework image
→ executable UPEX application image

GitHub Actions artifacts
→ HTML reports
→ screenshots
→ traces
→ diagnostics
```

Container images and test evidence solve different persistence problems and must not be treated as interchangeable artifact types.

Performance execution remains separate from this functional `localDocker` pipeline and continues to target the hosted environment through the dedicated performance workflow.

When evolving the containerized CI model, evaluate:

- reproducibility;
- image build and transfer cost;
- execution time;
- artifact size;
- debugging experience;
- runner storage;
- maintenance overhead.

Docker should remain in CI because it currently provides an intentional shared execution boundary, not merely for architectural symmetry.

## CI Execution Standard

The current CI dependency model is:

```text
quality
    ↓
build-images
    ↓
    ├── api
    ├── database
    ├── accessibility
    ├── visual
    └── ui matrix
        ├── chromium
        ├── firefox
        └── webkit
```

The `build-images` job depends on successful quality validation.

The `api`, `database`, `accessibility`, `visual`, and `ui` jobs depend on the successfully built immutable images rather than directly on the quality job.

API, database, accessibility, visual, and UI jobs must remain independent from one another unless a genuine runtime dependency is introduced.

Do not serialize independent jobs merely because they belong to the same workflow.

The quality job should fail fast on inexpensive validation before expensive image building and browser execution begins.

Current quality gates include:

```text
Prettier
→ TypeScript typecheck
```

## CI Hardening Standard

CI optimization must not weaken reproducibility or diagnostic quality.

The quality job may use the npm package cache to reduce repeated dependency download cost while preserving:

```text
npm ci
```

as its reproducible dependency installation command.

The Docker image must also install project dependencies reproducibly through `npm ci`.

Containerized test jobs should reuse the dependency state already contained in the built image rather than reinstalling dependencies independently.

Do not replace reproducible installation with a cached `node_modules` directory merely to reduce execution time.

Workflow concurrency should cancel obsolete executions belonging to the same logical pull request or branch while keeping unrelated changes isolated.

```text
same logical change
→ newer run may cancel older run

different pull requests
→ independent execution
```

CI jobs must define reasonable job-level timeout ceilings.

Current limits:

```text
quality
→ 5 minutes

build-images
→ 20 minutes

api
→ 15 minutes

database
→ 15 minutes

accessibility
→ 15 minutes

visual
→ 15 minutes

ui
→ 15 minutes per browser matrix job

performance
→ 5 minutes
```

Timeout ceilings protect runner resources from stuck execution. They must not be increased merely to hide unexplained performance degradation or flaky behavior.

Browser matrix execution uses:

```text
fail-fast: false
```

A failure in one browser should not cancel the remaining browser jobs because the complete matrix provides browser-specific diagnostic information.

Retries are a resilience and diagnostic mechanism, not a flaky-test solution.

```text
first attempt passes
→ healthy signal

first attempt fails
→ retry passes
→ potential flakiness
→ investigate
```

A test that repeatedly requires retries must not be treated as equivalent to a consistently passing test.

Database persistence tests execute with retries disabled. A failed database validation must remain attributable to the original persisted state rather than creating additional persistent test datasets through automatic retry.

Performance quality gates must not rely on Playwright retries to recover from a failed threshold evaluation.

The dedicated `performance` project therefore executes with retries disabled. A hard Lighthouse threshold violation must remain a failing quality signal rather than being converted into an overall pass by a later retry.

```text
performance measurement
→ hard threshold passes
→ PASS

performance measurement
→ hard threshold fails
→ FAIL
→ no Playwright retry
```

Measurement variance is handled inside the measurement model through repeated Lighthouse runs and median aggregation, not through test-runner retries.

Flaky tests should be investigated and corrected. If temporary quarantine becomes necessary, it should have an explicit reason, ownership, and path back to normal execution rather than becoming permanent ignored coverage.

## CI Browser Installation Standard

Containerized Playwright test jobs must use the browser runtime already provided by the reusable Playwright Docker image.

API job:

```text
use the workflow's reusable test image
→ no browser execution required
→ execute --project=api
```

Database job:

```text
use the same reusable test image
→ no browser execution required
→ execute --project=database
```

Accessibility job:

```text
use the same reusable test image
→ Chromium runtime provided by shared image
→ execute --project=accessibility
```

Visual job:

```text
use the same reusable test image
→ Chromium runtime provided by shared image
→ execute --project=visual
```

UI matrix job:

```text
use the same reusable test image
→ select matrix browser through Playwright project
→ execute matching project
```

Browser-performance job:

```text
use the dedicated performance workflow runner
→ install Node dependencies
→ install Playwright-managed Chromium
→ expose the same Chromium runtime to Lighthouse execution
→ execute standalone LHCI
→ execute --project=performance for authenticated Lighthouse coverage
```

The browser-performance job must not assume that the reusable Playwright Docker image owns Lighthouse execution.

Lighthouse requires a Node/Chrome-or-Chromium runtime appropriate to browser-performance measurement, while the `performance` Playwright project is used only for authenticated scenario orchestration before Lighthouse measurement.

Do not reinstall Playwright browsers independently in API, database, accessibility, visual, or UI test jobs when the required browser binaries and operating-system dependencies are already provided by the shared image.

Do not create browser-specific Docker images merely to match the browser matrix.

## CI Environment Standard

CI execution must explicitly select the intended test target.

The main functional CI target is:

```text
TEST_ENV=localDocker
```

The functional jobs execute against the UPEX application container on the Compose network rather than against the hosted deployment.

The dedicated performance workflow remains hosted because its execution cadence, measurement model, and target-safety constraints are separate from the functional pipeline.

Do not rely on an implicit default environment for CI behavior when the intended target can be stated explicitly.

The GitHub Actions `CI` environment variable and framework `TEST_ENV` variable represent different concerns:

```text
CI
→ execution context

TEST_ENV
→ test target
```

Do not treat them as interchangeable.

Supported target URLs are owned by:

```text
config/environments/environments.json
```

The shared environment configuration is consumed through runtime-specific boundaries:

```text
TEST_ENV
        ↓
environments.json
        ├── webBaseUrl
        │   → Playwright execution
        │   → browser-performance workflow
        │       → standalone LHCI
        │       → authenticated Playwright + Lighthouse
        │
        └── apiBaseUrl
            → performance workflow
            → TARGET_BASE_URL
            → k6 execution
```

For `localDocker`, Playwright resolves the application through the Compose network alias `upex-local`.

Browser-performance execution resolves the selected environment's `webBaseUrl` from the same shared configuration and uses it as the Lighthouse audit target.

Do not maintain separate hardcoded browser-performance target URLs when `webBaseUrl` already owns that environment-specific responsibility.

Playwright consumes the shared environment data through the TypeScript environment layer.

The performance workflow resolves the selected environment's `apiBaseUrl` and supplies it to k6 through:

```text
TARGET_BASE_URL
```

Do not maintain separate hardcoded target URLs in CI execution when the environment-specific value is already owned by the shared environment configuration.

`TEST_ENV` expresses the selected logical environment.

`TARGET_BASE_URL` is a resolved runtime value for k6.

Do not treat them as interchangeable.

## CI Permission and Secret Standard

Use least privilege for workflow permissions.

A test workflow should not receive write access unless a concrete workflow requirement needs it.

The Playwright workflow should default to:

```text
contents: read
```

The image-publishing job may additionally receive:

```text
packages: write
```

because it publishes the SHA-tagged Playwright framework image and resolved-SHA-tagged UPEX application image to GitHub Container Registry.

Jobs that only consume the published images should receive:

```text
packages: read
```

rather than package write access.

Package permissions should be scoped to the jobs that require them rather than granted workflow-wide.

Sensitive values must not be hardcoded in workflow YAML.

The functional `localDocker` CI runtime requires `DATABASE_URL` for the dedicated test database. It must be supplied through the workflow secret mechanism and must never be logged or embedded into either image.

When secrets are required:

- store them in the appropriate secret store;
- expose them only to trusted execution contexts;
- do not log their values;
- do not provide trusted secrets to untrusted PR code.

## CI Artifact Standard

Use artifacts to preserve human-readable test reports and failure diagnostics.

Preferred strategy:

```text
HTML report
→ always upload

Failure diagnostics
→ upload on failure
```

Artifact names must identify their execution scope.

Examples:

```text
playwright-report-api
playwright-report-database
playwright-report-accessibility
playwright-report-visual
playwright-report-chromium
playwright-report-firefox
playwright-report-webkit

test-results-api
test-results-database
test-results-accessibility
test-results-visual
test-results-chromium
test-results-firefox
test-results-webkit
```

The artifact name and artifact path are separate concepts.

For example:

```text
artifact name
→ playwright-report-firefox

local path
→ playwright-report/
```

Matrix jobs may use the same local path because they execute on isolated runners.

Do not duplicate the same report into multiple artifacts unless there is a demonstrated diagnostic need.

Retention should be finite and intentional.

Performance execution additionally preserves:

```text
performance-report-k6-task-read
→ generated k6 HTML performance evidence

performance-report-lighthouse
→ Lighthouse HTML / JSON browser-performance evidence

performance-report-playwright
→ authenticated browser-performance Playwright evidence
```

Performance reports are execution evidence and do not independently determine the quality result.

For API performance, native k6 thresholds remain responsible for PASS / FAIL semantics.

For browser performance, the shared Lighthouse threshold and severity policy remains responsible for quality-gate semantics, while Lighthouse and Playwright reports preserve diagnostic evidence.

Version-controlled visual baselines are not CI artifacts. They are reviewed repository assets.

Executable Playwright and UPEX application Docker images are not CI report artifacts. They belong in GitHub Container Registry.

The artifact strategy therefore separates:

```text
GitHub Container Registry
→ executable Playwright runtime image
→ executable UPEX application image

GitHub Actions artifacts
→ test reports
→ screenshots
→ traces
→ diagnostics
→ k6 HTML performance evidence
→ Lighthouse HTML / JSON browser-performance evidence
→ Playwright authenticated browser-performance evidence

repository
→ reviewed visual baselines
```

## Matrix Standard

Use a GitHub Actions matrix when the same CI responsibility should execute independently against multiple parameter values.

Current browser matrix:

```text
chromium
firefox
webkit
```

Matrix execution provides:

- parallel browser execution;
- browser-specific failure signals;
- browser-specific artifacts;
- independent job isolation.

A matrix is not the same as a Playwright project.

```text
Playwright project
→ test configuration and ownership

GitHub Actions matrix
→ CI job replication and parameterization
```

Do not introduce a matrix when a single execution would provide equivalent coverage.

The database project intentionally executes once because persistence validation is browser-independent and therefore does not require a CI matrix.

The accessibility project intentionally uses a single Chromium execution and therefore does not require a CI matrix.

The visual project also intentionally uses a single Chromium execution in the canonical Docker/Linux runtime and therefore does not require a CI browser matrix.

## Sharding Standard

Sharding divides a sufficiently large test suite into multiple execution partitions.

Sharding should be introduced when runtime and test volume demonstrate a real need.

Do not add sharding merely because the tooling supports it.

Sharding does not determine which test category should execute once versus once per browser.

Use project boundaries for execution responsibility.

Use sharding for distributing test volume.

## Naming and Structure

Names should communicate domain responsibility.

Prefer:

```text
UserApiClient
TaskApiClient
DatabaseClient
UserDatabaseClient
TaskDatabaseClient
TasksDashboardPage
createTestUser
createTask
authenticatedPage
```

Avoid generic names that hide responsibility.

Same-role files should follow the same structural grammar where practical.

Do not make different roles artificially identical.

## Imports and Formatting

Separate external and internal imports:

```ts
import { test } from "@playwright/test";

import { UserApiClient } from "../api/clients/UserApiClient";
```

Do not add blank lines between arbitrary internal import subgroups unless a meaningful convention requires them.

Use Prettier as the formatting authority.

Prettier does not decide semantic whitespace. Contributors remain responsible for removing unnecessary blank lines.

CI must run Prettier in check mode rather than silently rewriting repository files.

## Comments

Comments should explain why something non-obvious exists.

Good:

```ts
// Dropdown content is portal-rendered outside the navigation subtree.
```

Avoid:

```ts
// Click button
await button.click();
```

Avoid generic AAA comments when the structure is already clear.

## Creating New Abstractions

Before creating a new:

- client;
- database client;
- schema;
- constant collection;
- factory;
- fixture;
- Page Object;
- Component Object;
- visual helper;
- performance helper;
- mock;
- utility;
- Playwright project;
- CI job;
- CI matrix dimension;

ask:

```text
Does this responsibility already exist?
        ↓
yes → reuse it

Can the existing abstraction own this responsibility cleanly?
        ↓
yes → extend it

Is this genuinely a new responsibility?
        ↓
yes → create the smallest appropriate abstraction
```

Do not design for hypothetical future requirements.

Repeated real usage should drive generalization.

For visual regression testing specifically, do not wrap Playwright's native screenshot assertions merely to create structural symmetry with other framework layers.

Introduce a reusable visual abstraction only when repeated real visual scenarios demonstrate a responsibility that native Playwright comparison primitives and the existing central visual policy do not already express cleanly.

For performance testing specifically, do not wrap native k6 HTTP, metrics, scenarios, or threshold primitives merely to create structural symmetry with Playwright framework layers.

Introduce a reusable performance abstraction only when multiple real consumers require shared behavior that the underlying performance tools do not already express cleanly.

Use the measurement tool's native mechanism by default:

```text
k6
→ native HTTP, metrics, scenarios, and thresholds

Lighthouse / LHCI
→ native Lighthouse measurement and reporting
```

A shared Lighthouse policy is justified because standalone LHCI and authenticated Playwright + Lighthouse execution consume the same threshold values and severity semantics.

Do not generalize this into a universal performance policy layer or extract native k6 thresholds merely to create symmetry with Lighthouse.

## Definition of Done

Before considering a test or performance workload implementation complete:

```text
Behavior implemented
        ↓
Correct test suite or performance workload selected
        ↓
Correct Playwright project, database boundary, k6 runtime, or Lighthouse measurement boundary owns the test/workload
        ↓
Architecture boundaries respected
        ↓
Existing abstractions reused where appropriate
        ↓
No unnecessary abstraction introduced
        ↓
Prettier passes
        ↓
TypeScript typecheck passes
        ↓
Affected tests or workloads pass
        ↓
Relevant project, workload, or regression scope passes when appropriate
        ↓
CI execution remains valid when shared execution config changes
        ↓
Documentation updated if architecture or standards changed
```

For database changes, completion additionally requires when applicable:

```text
database execution remains restricted to localDocker
        ↓
fixture-managed database lifecycle preserved
        ↓
SQL remains inside database client layer
        ↓
cross-layer persistence behavior validated
        ↓
database project executes with retries disabled
        ↓
normal execution preserves state for debugging
        ↓
destructive reset remains explicit and guarded
```

For visual regression changes, completion additionally requires when applicable:

```text
deterministic visual state established
        ↓
correct screenshot scope selected
        ↓
canonical Docker/Linux baseline generated
        ↓
baseline intentionally reviewed
        ↓
version-controlled baseline committed
        ↓
visual project comparison passes
        ↓
CI comparison remains update-free
```

For performance changes, completion additionally requires when applicable:

```text
correct measurement and runtime boundary preserved
        ↓
existing deterministic setup reused where applicable
        ↓
setup and measured behavior separated
        ↓
measurement-specific metrics defined
        ↓
thresholds supported by repeated baseline evidence or authoritative requirements
        ↓
shared environment configuration reused
        ↓
technology-appropriate local execution verified
        ↓
performance evidence generated
        ↓
CI threshold and severity semantics preserved
```

For API performance, this includes verifying the pinned k6 Docker runtime and native k6 threshold behavior.

For browser performance, this includes verifying Lighthouse execution and, for authenticated scenarios, the `performance` Playwright project with the representative authenticated application state established before measurement.

A passing test is necessary but not sufficient.

The implementation should also preserve the maintainability, execution efficiency, and architectural consistency of the framework.

## AI-Assisted Development

AI-generated code is held to the same standard as human-written code.

An AI agent must not assume that generating the spec file alone completes a testing task.

A request such as:

```text
Add tests for a new task feature
```

may legitimately require changes to:

```text
schema
→ client
→ database client
→ constants
→ factory
→ fixture
→ Page Object / Component
→ mock
→ spec
→ execution configuration
```

but only the layers required by the behavior should be modified.

Agents should inspect existing implementations and project ownership before deciding which layers are required.

When generating a new test or performance workload, an agent must determine whether the behavior belongs to:

```text
api project
```

or:

```text
database project
```

or:

```text
accessibility project
```

or:

```text
visual project
```

or:

```text
browser projects
```

or:

```text
k6 performance runtime
```

or:

```text
performance Playwright project + Lighthouse measurement
```

before implementation.

Agents must not cause browser-independent API tests to execute redundantly across browser projects.

Agents generating database validation must reuse the existing database fixtures, `DatabaseClient`, and domain database clients rather than placing raw SQL or direct PostgreSQL transport in specs.

Agents must keep database assertions in specs, preserve parameterized query usage, execute database tests only through the `database` project against `localDocker`, and preserve the project's zero-retry behavior.

Agents must not introduce per-test database cleanup or automatically invoke the destructive database reset when the canonical strategy intentionally preserves state for debugging. The explicit reset workflow must retain its environment and confirmation guards.

Agents must not cause browser-independent database tests to execute redundantly across browser projects.

Agents must not cause accessibility tests to execute redundantly across the browser matrix without a demonstrated browser-specific requirement.

Agents generating accessibility coverage should reuse the existing scanner, central WCAG policy, fixtures, formatter, and assertion pattern instead of recreating axe configuration or introducing speculative abstractions.

Agents generating visual regression coverage should reuse existing factories, fixtures, Page Objects, and Component Objects to establish deterministic state, use Playwright's native screenshot assertions, and preserve the framework's central visual comparison policy.

Agents must not introduce arbitrary visual thresholds, masks, or ignored regions merely to make screenshot comparisons pass.

Agents must not update or regenerate visual baselines merely to convert an unexplained visual failure into a passing result.

Canonical visual baselines must be generated and intentionally reviewed through the framework's approved Docker/Linux baseline workflow.

Agents generating performance coverage must first determine whether the target is API workload performance or browser performance.

For API workload performance, agents must preserve the separate k6 runtime, use native k6 HTTP and metric primitives, reuse shared runtime-neutral environment configuration where applicable, and keep setup traffic separate from workload-specific performance metrics.

For browser performance, agents must reuse existing deterministic fixtures, API setup, Page Objects, and authenticated browser state where applicable rather than recreate equivalent setup for performance coverage.

```text
discover existing deterministic setup
→ reuse it
→ establish representative browser state
→ confirm the state is ready
→ begin Lighthouse measurement
```

Browser-performance coverage should change the measurement layer rather than duplicate business-state initialization.

Agents must reuse the existing Lighthouse execution, shared threshold policy, and reporting capabilities rather than create parallel Lighthouse infrastructure.

Agents must not introduce arbitrary performance thresholds or increase hosted workload intensity merely to create a stronger-looking performance test.

Agents must not convert a real performance quality-gate failure into a successful result merely to keep CI green.

For k6, native threshold failures must remain failing quality signals.

For Lighthouse, `error` severity policy violations must remain failing quality signals. `warn` severity violations remain diagnostic signals and must not be silently suppressed or reclassified merely to avoid investigation.

AI-assisted engineering must distinguish between repository evidence, provider-contract evidence, and runtime browser evidence.

```text
repository evidence
→ architecture, ownership, existing abstractions, Golden Templates

provider-contract evidence
→ authoritative API behavior and contract discovery

runtime browser evidence
→ observable rendered state and browser behavior
```

OpenAPI MCP may be used to discover provider contracts, and Playwright MCP may be used to explore runtime browser behavior. Neither source overrides repository architecture or implementation ownership.

AI-generated tests and implementation proposals must follow the closest validated repository implementation as a Golden Template.

Golden Template consistency includes:

```text
behavioral consistency
+ architectural consistency
+ structural consistency
+ stylistic consistency
```

Similarity alone is not sufficient if the reference does not represent the same responsibility or execution boundary.

AI-assisted changes must follow the review sequence:

```text
proposal
→ human review
→ targeted feedback
→ implementation
→ deterministic validation
→ human approval
```

Generated code must not be considered validated merely because it was produced by an AI agent or because the generated implementation appears plausible.

Validation must use the deterministic checks appropriate to the affected scope, such as formatting, type checking, targeted Playwright execution, or other repository-owned quality gates.

Framework-owned AI capabilities must validate structured inputs and outputs against their runtime schemas.

Missing output, refusal, incomplete provider responses, invalid JSON, and schema-invalid output must be treated as explicit failures rather than silently accepted or coerced.

Failure evidence sent to an AI provider must be sanitized before submission.

Artifact metadata may be included as evidence, but the existence of a screenshot, trace, or video path must not be interpreted as evidence that the AI inspected the artifact contents.

AI-generated failure analysis and test design are advisory outputs.

They must not autonomously:

- modify repository files;
- weaken assertions;
- update visual baselines;
- invent unsupported provider contracts or application behavior;
- convert uncertain evidence into a confirmed defect classification;
- bypass deterministic validation;
- approve their own implementation.

Human review remains required before AI-generated analysis, test design, or implementation proposals are accepted as engineering decisions.

The complete validated AI-assisted QA workflow and current capability boundaries are documented in [`AI_ASSISTED_QA_WORKFLOW.md`](AI_ASSISTED_QA_WORKFLOW.md).

Architecture must drive generated code, not the other way around.
