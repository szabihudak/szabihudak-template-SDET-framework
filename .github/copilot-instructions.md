# GitHub Copilot Instructions

This repository follows strict architecture and testing standards.

Before generating or modifying code, read and follow:

- `AGENTS.md`
- `docs/ARCHITECTURE.md`
- `docs/TESTING_STANDARDS.md`
- relevant ADRs under `docs/adr/`

Use existing implementations with equivalent responsibilities as golden references.

Prefer:

```text
reuse
→ extend
→ create
```

Do not create a new client, database client, schema, constant collection, factory, fixture, Page Object, Component Object, accessibility abstraction, visual abstraction, mock, utility, or architectural layer before checking whether the existing architecture can be reused or extended.

Do not treat "add a test" as a request to modify only the spec file.

Determine which architectural layers are genuinely required by the behavior.

Preserve:

- schema-first API contracts;
- runtime validation before trusting provider data;
- domain types where available;
- fixture dependency boundaries;
- database transport and domain database client responsibility boundaries;
- database connection lifecycle and destructive reset safety boundaries;
- API vs browser authentication separation;
- Page Object and Component Object responsibility boundaries;
- accessibility scanner and WCAG policy ownership;
- visual comparison policy and baseline ownership;
- API performance workload and k6 runtime ownership;
- browser-performance measurement and Lighthouse policy ownership;
- localDocker functional execution ownership;
- semantic test structure;
- existing formatting and naming conventions.

Do not introduce abstractions for hypothetical future reuse or structural symmetry.

When implementing a test or framework change:

1. understand the requested behavior;
2. inspect an analogous existing implementation;
3. identify the affected architectural layers;
4. reuse existing abstractions where possible;
5. extend existing abstractions where appropriate;
6. create new abstractions only when the responsibility is genuinely new;
7. implement the change;
8. format and validate the result.

For API work, preserve the established flow:

```text
request
→ HTTP assertion
→ parse response
→ runtime schema validation
→ business assertions
```

Do not trust provider response data through TypeScript casting before runtime validation.

Do not duplicate schema-owned provider contracts with separate TypeScript interfaces.

For database work:

- place database tests under `tests/database/**`;
- execute them through the dedicated `database` Playwright project;
- preserve the established flow:

```text
Spec
→ Fixture
→ Domain Database Client
→ DatabaseClient
→ PostgreSQL / Neon
```

- keep `DatabaseClient` responsible for PostgreSQL transport and connection lifecycle;
- keep `UserDatabaseClient` and `TaskDatabaseClient` responsible for domain-specific SQL and database record mapping;
- keep database assertions in specs;
- use parameterized SQL;
- do not place raw SQL in specs when an existing domain database client owns that responsibility;
- reuse API clients, factories, and fixtures to establish application state when persistence is the behavior under validation;
- execute database validation only with `TEST_ENV=localDocker`;
- provide `DATABASE_URL` at runtime and never store it in environment configuration or log the connection string;
- keep retries disabled for the `database` project so persistent database state remains diagnostically clear;
- use unique generated test data and preserve test-created state after normal runs for debugging;
- do not introduce automatic per-test database cleanup;
- use the existing `npm run db:test:reset` command when an explicit clean database state is required;
- keep destructive reset guarded by `TEST_ENV=localDocker`, a valid `DATABASE_URL`, `CONFIRM_DB_RESET=true`, and Docker availability;
- preserve the reset flow: recreate the `public` schema → restore the UPEX schema through `db:push` → restore seed data through `db:seed` → verify the known baseline;
- run destructive reset only against the dedicated disposable test database;
- treat the UPEX application as the owner of the database schema;
- do not introduce a local PostgreSQL container unless a separate requirement explicitly changes the database architecture.

For UI work:

- keep page-level interaction inside Page Objects;
- keep reusable UI-region interaction inside Component Objects;
- keep assertions in specs unless validation belongs to an infrastructure boundary;
- scope child locators to the component root only when the real DOM hierarchy supports it;
- keep portal-rendered elements page-scoped when they exist outside the component subtree;
- use the correct Playwright `Page` instance for the context being tested.

For accessibility work:

- place accessibility tests under `tests/accessibility/**`;
- execute them through the dedicated `accessibility` Playwright project;
- reuse the existing `AccessibilityScanner`;
- reuse the central WCAG policy rather than duplicating axe rule tags in specs;
- keep accessibility assertions in specs;
- use `AccessibilityFormatter` only for human-readable diagnostics;
- preserve the correct `Page` ownership for public and authenticated scans;
- use the established full-page scan pattern unless a concrete requirement justifies a new scoped abstraction;
- do not add selectors, test IDs, Page Object properties, or helper abstractions solely for hypothetical accessibility reuse;
- do not suppress real accessibility violations merely to make CI pass;
- do not use `continue-on-error` to hide accessibility failures;
- do not describe automated axe coverage as complete WCAG conformance or as a replacement for manual accessibility testing;
- do not duplicate accessibility execution across Chromium, Firefox, and WebKit unless a concrete browser-specific requirement or observed issue justifies it.

Preserve the established accessibility flow:

```text
establish meaningful page state
        ↓
AccessibilityScanner
        ↓
central WCAG policy
        ↓
axe result
        ↓
AccessibilityFormatter
        ↓
spec assertion
```

For visual regression work:

- place visual tests under `tests/visual/**`;
- execute them through the dedicated `visual` Playwright project;
- use native Playwright screenshot assertions;
- reuse existing factories, API setup, fixtures, Page Objects, and locators;
- establish deterministic visible state before screenshot comparison;
- use the central visual comparison policy rather than duplicating screenshot options in individual specs;
- keep visual assertions in specs;
- use semantic snapshot names that describe the protected visual contract;
- keep approved baselines version-controlled with their owning visual spec;
- generate and approve canonical baselines only in the Docker/Linux Playwright runtime used by CI;
- manually review generated or updated baselines;
- rerun visual tests without `--update-snapshots` before treating a baseline as reproducible;
- keep CI compare-only;
- inspect expected, actual, and diff evidence before deciding how to handle a visual failure;
- do not duplicate visual execution across Chromium, Firefox, and WebKit unless a concrete browser-specific visual requirement justifies additional baselines.

Preserve the established visual flow:

```text
deterministic test data
        ↓
existing API / fixture setup
        ↓
relevant Page Object / locator ownership
        ↓
stable rendered state
        ↓
toHaveScreenshot(...)
        ↓
approved version-controlled baseline
```

Do not introduce a visual scanner, service, screenshot wrapper, visual-specific fixture hierarchy, or visual-specific factory merely for structural symmetry.

Do not create a helper that only forwards arguments to an existing factory or Playwright assertion without adding meaningful responsibility.

The current shared visual comparison policy is:

```text
animations
→ disabled

caret
→ hidden
```

Reuse the central policy.

Do not introduce global:

```text
threshold
maxDiffPixels
maxDiffPixelRatio
masking
```

merely to make visual comparisons pass.

If a concrete visual scenario requires tolerance or masking:

1. identify the exact source of nondeterminism;
2. confirm that the unstable content is not part of the intended visual contract;
3. use the smallest scenario-specific exception;
4. preserve meaningful layout and content validation.

Do not mask or ignore meaningful content such as:

- titles;
- descriptions;
- status;
- priority;
- controls;
- spacing;
- typography;
- component layout.

Approved visual baselines belong to Git.

They are not equivalent to:

```text
playwright-report/
test-results/
```

which are execution artifacts.

Current baseline ownership follows the Playwright snapshot model:

```text
tests/visual/
  visual.spec.ts
  visual.spec.ts-snapshots/
```

A visual comparison failure must not automatically trigger:

```text
--update-snapshots
```

Required failure handling is:

```text
visual comparison fails
        ↓
inspect expected / actual / diff
        ↓
perform RCA
        ↓
determine whether the change is intended
```

If intended:

```text
regenerate in canonical Docker/Linux runtime
→ manually review
→ rerun without update
→ commit approved baseline change
```

If unintended:

```text
keep expected baseline unchanged
→ fix product or test instability
```

Never update a baseline merely to make CI green.

For performance work, first determine the measurement responsibility:

```text
API workload performance
→ k6

Browser performance
→ Lighthouse / LHCI

Authenticated browser performance
→ existing deterministic Playwright setup
→ performance Playwright project for scenario orchestration
→ Lighthouse measurement
```

For API performance:

- place workloads under `performance/k6/**`;
- keep execution in the dedicated k6 runtime rather than a Playwright project;
- do not import Playwright or Node.js-specific framework helpers into k6 workloads;
- use native k6 HTTP, metrics, scenarios, and thresholds;
- reuse the shared runtime-neutral environment configuration and resolved `apiBaseUrl`;
- keep setup traffic separate from the measured operation when setup is not the performance target;
- clean up test-owned resources created for performance setup when the target application exposes a supported cleanup operation, and keep cleanup outside the measured workload;
- use workload-specific metrics and enforceable native k6 thresholds;
- do not increase hosted workload intensity into stress, spike, soak, or large-scale load testing against shared infrastructure.

For browser performance:

- reuse the existing Lighthouse infrastructure under `performance/lighthouse/**`;
- use Lighthouse / LHCI for browser-performance measurement;
- reuse the shared Lighthouse threshold and severity policy rather than defining parallel thresholds;
- reuse the shared runtime-neutral environment configuration and resolved `webBaseUrl`;
- do not create parallel Lighthouse runners, reporters, policy evaluators, or configuration merely for a new scenario.

For authenticated browser performance:

- place specs under `tests/performance/**`;
- execute them through the dedicated `performance` Playwright project;
- inspect existing functional coverage before creating setup;
- reuse existing deterministic fixtures, API setup, Page Objects, and authenticated browser state where applicable;
- confirm the representative application state before beginning Lighthouse measurement;
- use Playwright for scenario and browser-state orchestration and Lighthouse for browser-performance measurement.
- preserve the authenticated Lighthouse measurement model: three independent Lighthouse measurements followed by median metric aggregation and shared policy evaluation;
- keep retries disabled for the `performance` project; measurement variance belongs in the Lighthouse measurement model, not in Playwright retries;
- use the Playwright-managed Chromium runtime for Lighthouse execution rather than introducing separate browser discovery or installation.

Preserve the established authenticated browser-performance flow:

```text
discover existing deterministic setup
        ↓
reuse it
        ↓
establish representative browser state
        ↓
confirm the state is ready
        ↓
begin Lighthouse measurement
```

Performance coverage should change the measurement layer rather than duplicate business-state initialization.

For k6, native threshold failures must remain failing quality signals.

For Lighthouse, `error` severity policy violations must remain failing quality signals. `warn` severity violations remain diagnostic signals and must not be silently suppressed or reclassified merely to avoid investigation.

Do not introduce arbitrary performance thresholds merely to make an unexplained failure pass.

Do not create a universal performance policy layer or extract native k6 thresholds merely to create structural symmetry with Lighthouse.

Introduce a reusable performance abstraction only when multiple real consumers require shared behavior that the underlying performance tools do not already express cleanly.

Preserve dedicated manually triggered performance CI ownership rather than moving hosted performance execution into the normal pull-request path.

Preserve authentication boundaries:

```text
API
→ Bearer JWT

Browser
→ Auth.js session
```

Do not treat API authentication and browser authentication as interchangeable.

Use UI login only when login behavior itself is under test.

Do not introduce new abstractions such as a generic base client, service layer, generic factory, generic mock service, helper wrapper, fixture, database abstraction beyond the established transport/domain-client boundary, accessibility abstraction, visual abstraction, or performance abstraction unless demonstrated reuse or complexity justifies them.

Prefer the smallest architecturally complete change.

This does not mean changing the fewest files.

A correct change may require updates across several layers, for example:

```text
schema
→ client
→ constants
→ factory
→ fixture
→ Page Object / Component Object
→ mock
→ spec
```

A database validation change may require:

```text
existing API / fixture setup
→ existing DatabaseClient
→ existing domain database client
→ database spec
```

and should keep persistence assertions in the spec rather than introducing SQL directly into the test.

An accessibility change may require:

```text
fixture
→ accessibility spec
```

or may reuse the existing scanner, policy, formatter, and fixtures without introducing any new abstraction.

A visual regression change may require:

```text
existing factory
→ existing API setup
→ existing Page Object / locator
→ visual spec
→ approved baseline
```

or may require only a new visual spec and baseline when the existing framework already supports the necessary deterministic state.

An authenticated browser-performance change may require:

```text
existing fixture / API setup
→ existing Page Object
→ performance spec
→ existing Lighthouse infrastructure
```

and should reuse existing deterministic state initialization rather than create a parallel performance-specific setup path.

Only modify the layers genuinely required by the behavior.

When implementation is complete:

```text
format
→ typecheck
→ run affected tests
→ review architecture impact
```

At minimum, run:

```bash
npx prettier --check .
npm run typecheck
```

Run the affected Playwright tests.

For database work, run the canonical database project through the localDocker runtime.

Database validation must target the dedicated test database through runtime `DATABASE_URL`.

When validating the reset utility, preserve all destructive-operation guards and never point reset execution at a shared or non-test database.

For accessibility work, run:

```bash
npx playwright test --project=accessibility
```

A failing accessibility project may represent a real application accessibility violation rather than a framework defect.

Do not hide or reinterpret that failure merely to claim validation passed.

For visual regression work, normal verification must run without baseline updates.

Run:

```bash
npx playwright test --project=visual
```

when the execution environment matches the expected visual runtime.

Canonical visual baseline generation and approval must use the framework Docker/Linux runtime defined in `docs/TESTING_STANDARDS.md`.

Do not treat:

```bash
npx playwright test --project=visual --update-snapshots
```

as ordinary validation.

It is an explicit baseline-generation or intentional baseline-update operation and requires manual review followed by a second run without `--update-snapshots`.

For API performance work, run the affected k6 workload through its dedicated Docker runtime against the intended target environment.

Verify that the measured requests succeed, workload-specific metrics are populated, configured native k6 thresholds are evaluated, and the expected k6 HTML performance report is generated.

For standalone Lighthouse changes, run:

```bash
npx lhci autorun --config=performance/lighthouse/lighthouseConfig.js
```

Verify that Lighthouse measurement completes, the configured quality policy is evaluated, and the expected Lighthouse report evidence is generated.

For authenticated browser-performance changes, run:

```bash
npx playwright test --project=performance
```

Verify that deterministic setup succeeds, the representative authenticated browser state is established and confirmed ready, all three Lighthouse measurements complete, median metrics are aggregated, the shared Lighthouse policy is evaluated against those median metrics, and the expected per-run Lighthouse and Playwright evidence is generated.

Do not claim performance validation passed solely because the measurement process started or completed without verifying its quality-gate and report evidence.

Run broader regression scope when shared framework infrastructure changes.

Do not claim validation passed unless it was actually executed successfully.

Update documentation when a change modifies:

- architectural responsibility;
- established golden patterns;
- authentication strategy;
- dependency direction;
- framework-wide implementation standards;
- major technology choices;
- database access, reset, or execution ownership;
- localDocker runtime ownership;
- functional CI image or execution architecture;
- visual baseline ownership;
- visual approval workflow;
- visual execution boundaries;
- performance workload, browser-performance measurement, runtime, threshold, policy, or CI ownership boundaries.

If the requested change conflicts with the documented architecture:

1. identify the conflict;
2. explain why the current pattern is insufficient;
3. propose the smallest architectural change;
4. update the appropriate documentation or ADR;
5. only then implement the new pattern.

Architecture must drive generated code, not the other way around.
