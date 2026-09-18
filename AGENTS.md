# Agent Instructions

## Purpose

This file defines how AI coding agents must operate when modifying this repository.

The same architectural and quality standards apply to AI-generated and human-written code.

Agents must preserve the established framework architecture rather than optimize for generating the smallest amount of code or completing only the immediately requested spec.

## Required Reading

Before implementing or modifying tests, read:

1. `docs/ARCHITECTURE.md`
2. `docs/TESTING_STANDARDS.md`
3. relevant ADRs under `docs/adr/`
4. existing implementations analogous to the requested change

`docs/ARCHITECTURE.md` defines architectural responsibilities.

`docs/TESTING_STANDARDS.md` defines implementation rules and golden patterns.

This file defines the execution behavior expected from an AI agent.

## Operating Principle

Do not start by generating code.

First determine:

```text
requested behavior
        ↓
existing analogous implementation
        ↓
affected architectural layers
        ↓
reuse existing abstractions
        ↓
extend existing abstractions where appropriate
        ↓
create missing abstractions only when required
        ↓
implement
        ↓
validate
```

Prefer:

```text
reuse
→ extend
→ create
```

Do not introduce parallel patterns when an established pattern already owns the responsibility.

## Before Modifying Code

Inspect the relevant repository areas before deciding what must change.

Depending on the task, inspect the applicable:

- spec;
- API client;
- schema;
- constants;
- factory;
- fixture;
- Page Object;
- Component Object;
- accessibility utility;
- visual comparison policy;
- performance workload;
- CI workflow;
- mock;
- utility;
- configuration.

Do not assume that a request to "add a test" requires changing only a spec.

Likewise, do not assume every new test requires new framework components.

Modify only the layers genuinely required by the behavior.

## Golden References

Use existing implementations with equivalent responsibilities as architectural references.

Examples include:

```text
User API behavior
→ existing user client
→ user schemas
→ user factory
→ authentication fixtures
→ user API specs

Task API behavior
→ TaskApiClient
→ task schemas
→ task constants
→ taskFactory
→ task fixtures
→ task API specs

Authenticated UI behavior
→ authenticatedPage
→ relevant Page Object / Component Object
→ existing authenticated UI specs

Accessibility behavior
→ existing accessibility specs
→ AccessibilityScanner
→ central WCAG policy
→ accessibility / authenticatedAccessibility fixtures
→ AccessibilityFormatter
→ accessibility Playwright project

Visual regression behavior
→ existing visual specs
→ existing factories and API setup
→ relevant Page Object / locator ownership
→ central visual comparison policy
→ version-controlled baselines
→ visual Playwright project

API performance behavior
→ existing k6 workload under performance/k6/
→ separate k6 runtime boundary
→ shared environment configuration
→ workload-specific metrics
→ calibrated native k6 thresholds
→ dedicated performance workflow

Browser performance behavior
→ existing Lighthouse infrastructure under performance/lighthouse/
→ shared environment configuration
→ Lighthouse / LHCI measurement
→ shared Lighthouse threshold and severity policy
→ dedicated performance workflow

Authenticated browser performance behavior
→ existing deterministic fixture / API setup
→ authenticated browser state
→ relevant Page Object
→ performance Playwright project for scenario orchestration
→ Lighthouse measurement
→ shared Lighthouse threshold and severity policy
```

References demonstrate structural grammar and responsibility boundaries.

Do not copy implementations mechanically when the domain behavior differs.

## Architectural Boundaries

Preserve the responsibilities defined in `docs/ARCHITECTURE.md`.

In particular:

```text
Schema
→ provider API contract

API Client
→ HTTP interaction

Factory
→ test data generation

Fixture
→ setup, state, dependencies, lifecycle

Page Object
→ page-level UI interaction

Component Object
→ reusable UI-region interaction

AccessibilityScanner
→ automated accessibility analysis using the central WCAG policy

AccessibilityFormatter
→ human-readable accessibility diagnostics

Visual comparison policy
→ shared screenshot-stability settings only

API performance workload
→ k6-owned load generation, workload-specific metrics, and native threshold evaluation

Lighthouse runner
→ browser-performance measurement and Lighthouse report generation

Lighthouse policy
→ shared browser-performance threshold and severity evaluation

Lighthouse reporter
→ Playwright evidence and Lighthouse warning presentation

Mock
→ controlled network behavior

Spec
→ behavior verification, scenario orchestration, and assertions
```

Do not move responsibilities between layers merely to reduce code.

## API Rules

Provider API contracts are schema-first.

TypeBox schemas are the source of truth for provider request and response contracts.

Do not create duplicate TypeScript interfaces for schema-owned provider contracts.

Do not trust provider response data through TypeScript casting before runtime validation.

For successful API responses, preserve the pattern:

```text
request
→ HTTP assertion
→ parse response
→ runtime schema validation
→ business assertions
```

Negative responses should not be forced through successful-response schemas.

API clients must not contain test assertions.

Do not introduce a generic `BaseApiClient` without demonstrated architectural need.

## UI Rules

Keep UI interaction inside the appropriate Page Object or Component Object.

Keep test assertions in specs unless a validation belongs to an infrastructure boundary.

Use domain types when an established domain type already represents the value.

Locator scope must reflect the actual DOM.

Do not force component-root scoping for portal-rendered elements that exist outside the component subtree.

Objects used with `authenticatedPage` must operate on that authenticated `Page` instance.

Do not reuse an object constructed from the default Playwright `page` against `authenticatedPage`.

## Accessibility Rules

Accessibility tests belong under:

```text
tests/accessibility/**
```

and execute through:

```text
--project=accessibility
```

Use the existing `AccessibilityScanner` rather than constructing `AxeBuilder` directly inside specs.

Use the framework's central WCAG policy rather than duplicating axe tags in individual tests.

Preserve the golden flow:

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

Accessibility assertions must remain in specs.

The formatter may improve failure readability but must not:

- remove violations;
- suppress violations;
- alter severity;
- determine pass/fail;
- convert a failing accessibility result into a passing one.

Preserve Page ownership:

```text
page
→ accessibility

authenticatedPage
→ authenticatedAccessibility
```

Do not use an accessibility scanner constructed from one `Page` instance to validate state owned by another `Page`.

Do not suppress real accessibility violations or use `continue-on-error` merely to keep CI green.

Do not introduce accessibility-specific selectors, test IDs, Page Object properties, or scoped-scan abstractions solely for hypothetical future use.

The current golden pattern uses representative full-page scans.

If a future requirement genuinely needs scoped accessibility analysis, inspect the ownership model first and introduce the smallest clean abstraction only when demonstrated by a real use case.

Automated axe analysis is not equivalent to complete WCAG conformance and must not be described as a replacement for manual accessibility testing.

The current accessibility project runs through Chromium once.

Do not duplicate accessibility coverage across Chromium, Firefox, and WebKit unless a concrete browser-specific requirement or observed issue demonstrates value.

## Visual Regression Rules

Visual regression tests belong under:

```text
tests/visual/**
```

and execute through:

```text
--project=visual
```

Use native Playwright screenshot assertions.

Do not introduce a visual scanner, visual service, screenshot wrapper, or visual fixture hierarchy merely for symmetry.

Preserve the golden flow:

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

Visual assertions remain in specs.

Use existing domain factories with explicit deterministic overrides when visible content affects the screenshot.

Prefer:

```ts
const task = createTask({
  title: "Visual Regression Task - Card",
  description: "Stable visual regression fixture",
  priority: "low",
  status: "in_progress",
});
```

Do not create a visual-specific factory or helper that merely forwards the same data to an existing factory.

Use existing API clients for deterministic setup when browser interaction is not the behavior under test.

Reuse existing Page Object and locator ownership.

For page-level visual assertions, use the `Page` owned by the relevant Page Object when that Page Object already represents the tested page.

Do not introduce screenshot-specific selectors or Page Object properties unless the application does not already expose a stable ownership boundary.

The current shared visual comparison policy is:

```text
animations
→ disabled

caret
→ hidden
```

Reuse the central visual comparison options.

Do not duplicate these settings in individual tests.

Do not introduce global:

```text
threshold
maxDiffPixels
maxDiffPixelRatio
masking
```

merely to make failing screenshots pass.

If tolerance or masking becomes necessary, first identify the exact source of instability and use the smallest scenario-specific exception that preserves the visual contract.

Do not hide meaningful content such as:

- layout;
- titles;
- descriptions;
- priority;
- status;
- controls;
- spacing;
- typography.

### Visual Baseline Ownership

Approved visual baselines are version-controlled test assets.

Current ownership:

```text
tests/visual/
  visual.spec.ts
  visual.spec.ts-snapshots/
    task-dashboard-visual-linux.png
    task-card-visual-linux.png
```

The spec owns semantic screenshot names such as:

```text
task-dashboard.png
task-card.png
```

Playwright owns the physical project/platform-specific snapshot filename.

Do not manually relocate or rename baseline files independently from the owning test contract.

Do not treat visual baselines as disposable `test-results` or `playwright-report` artifacts.

### Canonical Visual Runtime

The canonical visual runtime is the framework's Docker/Linux Playwright environment.

Do not approve canonical baselines generated from developer-specific macOS or Windows rendering.

Baseline generation or intentional baseline updates must run in the canonical Docker/Linux environment.

The visual project currently executes through Chromium once.

Do not duplicate visual tests across Chromium, Firefox, and WebKit unless a concrete browser-specific visual requirement demonstrates value.

### Baseline Generation and Approval

Creating or updating a baseline is an explicit review operation.

Required sequence:

```text
implement deterministic visual test
        ↓
generate baseline in canonical Docker/Linux runtime
        ↓
inspect generated image manually
        ↓
confirm intended and stable rendered state
        ↓
rerun without --update-snapshots
        ↓
confirm reproducibility
        ↓
commit spec and approved baseline
```

A generated screenshot is not approved merely because Playwright created it.

Agents must never treat:

```text
--update-snapshots
```

as a general failure-recovery command.

### Visual Failure Handling

When a visual comparison fails:

```text
inspect expected
+
actual
+
diff
        ↓
perform RCA
        ↓
determine whether the change is intended
```

If the change is intended:

```text
regenerate in canonical runtime
→ manually review
→ rerun without update
→ commit approved baseline change
```

If the change is not intended:

```text
keep expectation unchanged
→ fix product or test instability
```

Do not update a baseline merely to make CI green.

CI is compare-only and must never automatically approve or regenerate baselines.

## Performance Rules

First determine which performance responsibility the requested behavior belongs to:

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

API performance workloads belong under:

```text
performance/k6/**
```

and execute through the dedicated k6 runtime rather than a Playwright project.

Do not import Playwright or Node.js-specific framework helpers into k6 workloads.

Use native k6 HTTP, metrics, scenarios, and threshold primitives unless a demonstrated responsibility cannot be expressed cleanly by k6 itself.

Browser-performance infrastructure belongs under:

```text
performance/lighthouse/**
```

Use the existing Lighthouse runner, shared threshold policy, reporter, and LHCI configuration rather than creating parallel Lighthouse infrastructure.

Authenticated browser-performance specs belong under:

```text
tests/performance/**
```

and execute through:

```text
--project=performance
```

Use the performance Playwright project only when framework-owned fixtures, API setup, Page Objects, or authenticated browser state are required to establish the representative state measured by Lighthouse.

Before creating browser-performance setup, inspect existing functional coverage for deterministic initialization that already represents the required business state.

Preserve the golden flow:

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

Do not duplicate business-state initialization solely for performance coverage when existing fixtures, API setup, Page Objects, or browser-state capabilities already own that responsibility.

Performance coverage should change the measurement layer rather than recreate the application-state initialization layer.

Use the shared runtime-neutral environment configuration as the source of target environment URLs.

For API performance, use the resolved `apiBaseUrl` through the established k6 runtime boundary.

For browser performance, use the resolved `webBaseUrl` as the Lighthouse audit target.

Keep authentication and other setup traffic outside the measured operation when those actions are not the performance target.

Clean up test-owned resources created for performance setup when the target application exposes a supported cleanup operation. Keep cleanup outside the measured workload or audit.

For API performance, use workload-specific metrics and native enforceable k6 thresholds for the behavior being measured.

For Lighthouse, reuse the shared version-controlled threshold and severity policy across standalone LHCI and authenticated Playwright + Lighthouse execution.

Do not introduce arbitrary thresholds or change existing performance quality gates merely to make an unexplained failure pass.

For k6, native threshold failures must remain failing quality signals.

For Lighthouse, `error` severity policy violations must remain failing quality signals. `warn` severity violations remain diagnostic signals and must not be silently suppressed or reclassified merely to avoid investigation.

Do not create a universal performance policy layer or extract native k6 thresholds merely to create structural symmetry with Lighthouse.

Introduce a reusable performance abstraction only when multiple real consumers require shared behavior that the underlying performance tools do not already express cleanly.

Do not expand the hosted API baseline into uncontrolled stress, spike, soak, or large-scale load testing against shared infrastructure.

Performance CI is owned by the dedicated manually triggered performance workflow rather than the normal pull-request test path.

The performance workflow keeps API load generation and browser-performance measurement in separate jobs appropriate to their runtime and measurement responsibilities.

## Authentication Rules

API and browser authentication are separate concerns:

```text
API
→ Bearer JWT

Browser
→ Auth.js session
```

Preserve the established fixture semantics:

```text
testUserData
→ generated, unregistered, unauthenticated

registeredTestUser
→ registered only

authenticatedTestUser
→ registered + API authenticated

authenticatedPage
→ programmatically authenticated browser context
```

Do not replace `authenticatedPage` setup with UI login.

Use UI login only when login behavior itself is under test.

## Abstraction Rules

Do not introduce a new:

- base client;
- service layer;
- generic factory;
- generic mock service;
- domain directory;
- helper wrapper;
- fixture;
- Page Object;
- Component Object;
- accessibility abstraction;
- visual abstraction;
- performance abstraction;

for hypothetical future reuse or structural symmetry.

Before creating an abstraction, verify:

```text
Does this responsibility already exist?
→ reuse

Can the existing abstraction own it cleanly?
→ extend

Is it genuinely a new responsibility?
→ create the smallest appropriate abstraction
```

Real reuse and demonstrated complexity should drive generalization.

## Change Scope

Make the smallest architecturally complete change.

This does not mean changing the fewest files.

For example, a correct feature implementation may require:

```text
schema
+ client
+ factory
+ fixture
+ Page Object
+ spec
```

if the behavior genuinely crosses those layers.

An accessibility addition may require:

```text
fixture
+ accessibility spec
```

or reuse only existing accessibility infrastructure if the required state is already available.

A visual regression addition may require:

```text
existing factory
+ existing API setup
+ existing Page Object / locator
+ visual spec
+ approved baseline
```

and should reuse existing framework layers when those layers already support the required state.

An authenticated browser-performance addition may require:

```text
existing fixture / API setup
+ existing Page Object
+ performance spec
+ existing Lighthouse infrastructure
```

and should reuse deterministic business-state initialization rather than introduce performance-specific setup for an already supported state.

Conversely, do not touch those layers when the existing implementation already supports the behavior.

Avoid unrelated cleanup during focused feature work unless the existing issue blocks or compromises the requested implementation.

## Comments and Formatting

Do not add generic comments that restate code.

Avoid:

```ts
// Arrange
// Act
// Assert
```

Comments should explain non-obvious reasons or constraints.

Preserve semantic whitespace.

Separate external and internal imports according to the repository standard.

Use Prettier as the formatting authority, while remembering that unnecessary semantic blank lines may still require manual cleanup.

## Validation

Before considering implementation complete, run the relevant validation.

At minimum:

```bash
npx prettier --check .
npm run typecheck
```

Run the affected Playwright tests.

For accessibility changes, run:

```bash
npx playwright test --project=accessibility
```

A failing accessibility project may represent a real application accessibility violation rather than a framework defect.

Do not hide or reinterpret such a failure merely to report a passing validation result.

For visual regression changes, normal verification must run without baseline updates.

Use:

```bash
npx playwright test --project=visual
```

when the current execution environment matches the expected visual runtime.

Canonical visual verification and baseline generation must use the framework Docker/Linux runtime.

When generating or intentionally updating a baseline, follow the exact workflow defined in `docs/TESTING_STANDARDS.md`.

After baseline generation or update, always rerun the visual project without:

```text
--update-snapshots
```

before considering the baseline reproducible.

Do not claim a visual validation passed merely because an update command generated expected images.

For API performance changes, run the affected k6 workload through its dedicated Docker runtime against the intended target environment.

Verify that:

```text
measured requests succeed
→ workload-specific metrics are populated
→ configured native k6 thresholds are evaluated
→ threshold failure produces a failing execution result
→ the expected k6 HTML report is generated
```

For standalone Lighthouse changes, run:

```bash
npx lhci autorun --config=performance/lighthouse/lighthouseConfig.js
```

Verify that Lighthouse measurement completes, the configured quality policy is evaluated, and the expected Lighthouse report evidence is generated.

For authenticated browser-performance changes, run the affected performance spec through:

```bash
npx playwright test --project=performance
```

Verify that:

```text
deterministic setup succeeds
→ representative authenticated browser state is established
→ required state is confirmed ready
→ Lighthouse measurement completes
→ shared Lighthouse policy is evaluated
→ expected Lighthouse and Playwright evidence is generated
```

Do not claim performance validation passed solely because the measurement process executed. Quality-policy evaluation and expected report generation are part of the validation evidence.

Run broader regression scope when the change affects shared framework infrastructure.

Do not claim a test or validation command passed unless it was actually executed successfully.

If validation cannot be executed, state that explicitly.

## Documentation

Update documentation when a change modifies:

- architectural responsibility;
- established golden patterns;
- authentication strategy;
- dependency direction;
- framework-wide implementation standards;
- major technology choices;
- visual baseline ownership or approval rules;
- visual execution boundaries.
- performance workload, browser-performance measurement, runtime, threshold, policy, or CI ownership boundaries.

Do not modify architecture documentation for ordinary feature additions that already follow documented patterns.

Consider an ADR when the change represents a meaningful architectural decision as defined in `docs/ARCHITECTURE.md`.

A routine addition of another visual test that follows the established native Playwright visual pattern does not require a new ADR.

A future move to a materially different visual platform, baseline ownership model, or external visual-testing service should be reviewed as a potential architectural decision.

## Completion Review

Before completing a task, verify:

```text
requested behavior implemented
        ↓
existing architecture preserved
        ↓
correct layers modified
        ↓
correct execution project or runtime selected
        ↓
no unnecessary abstraction introduced
        ↓
provider contracts validated correctly where applicable
        ↓
authentication boundaries preserved
        ↓
accessibility policy preserved where applicable
        ↓
visual baseline policy preserved where applicable
        ↓
performance measurement boundaries and quality policy preserved where applicable
        ↓
formatting passes
        ↓
typecheck passes
        ↓
affected tests executed
        ↓
visual baselines reviewed and reproduced where applicable
        ↓
real application failures not suppressed
        ↓
documentation updated if required
```

A passing test alone does not make an implementation complete.

The resulting code must also remain consistent with the framework's architectural standards.

## Architecture Changes

Do not redesign the framework as part of ordinary feature implementation.

If the requested behavior cannot be implemented cleanly within the documented architecture:

1. identify the architectural conflict;
2. explain why the existing pattern is insufficient;
3. propose the smallest architectural change;
4. update the appropriate documentation or ADR;
5. only then implement the new pattern.

Architecture changes must be deliberate rather than accidental.
