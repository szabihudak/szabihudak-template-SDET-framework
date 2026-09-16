# Framework Architecture

## Purpose

This document defines the architectural boundaries, responsibilities, execution model, and dependency rules of the Playwright Enterprise Framework.

The architecture is designed to remain maintainable and predictable as the test suite grows. Tests should express business behavior while reusable technical concerns are delegated to the appropriate framework layer.

New functionality should extend the existing architecture before introducing new abstractions or patterns.

## Architectural Principles

The framework follows these principles:

- tests describe behavior rather than infrastructure;
- each layer has a clear responsibility;
- dependencies flow toward reusable framework abstractions;
- API contracts are schema-first;
- runtime API data is validated before it is trusted;
- test data creation is separated from test execution;
- fixtures manage reusable setup, state, and lifecycle;
- Page Objects and Component Objects encapsulate UI interaction;
- assertions remain in tests unless validation belongs to an infrastructure boundary;
- test execution scope should reflect the responsibility being tested;
- browser-independent API tests should not be multiplied across browser projects;
- browser-dependent UI tests should execute against the intended browser projects;
- visual regression tests should use deterministic rendered state and controlled baseline ownership;
- canonical visual baselines should be generated in the same reproducible runtime used by CI;
- execution environments should remain reproducible and independently configurable from test targets;
- runtime configuration should not be baked into reusable test images;
- test artifacts that must outlive ephemeral execution should be persisted outside that execution lifecycle;
- approved visual baselines are version-controlled test assets rather than transient execution artifacts;
- performance workloads should remain separate from Playwright functional execution;
- performance quality gates should use workload-specific metrics rather than unrelated setup traffic;
- shared target environment data should have a runtime-neutral source of truth;
- executable container images and diagnostic workflow artifacts should use storage mechanisms appropriate to their responsibilities;
- abstractions are introduced only when there is demonstrated reuse or architectural value;
- existing patterns should be extended before parallel patterns are created.

## Repository Structure

```text
Dockerfile
.dockerignore

config/
  environments/

docs/
  adr/

performance/
  k6/

src/
  api/
    clients/
    constants/
    models/
    schemas/
  components/
  pages/
  fixtures/
  data/
  mocks/
  security/
  accessibility/
  visual/
  ai/
  utils/
  reporting/

tests/
  smoke/
  regression/
  ui/
  api/
  accessibility/
  visual/
  security/
  performance/

.github/
  workflows/
```

Some directories represent planned framework capabilities and may be populated as those capabilities are introduced.

## Core Dependency Model

A typical API flow is:

```text
Spec
  ↓
Fixture
  ↓
Factory
  ↓
Domain API Client
  ↓
TypeBox Schema
  ├── Static<T> → compile-time TypeScript type
  └── AJV → runtime validation
  ↓
HTTP assertion
  ↓
Schema validation
  ↓
Business assertions
```

A typical UI flow is:

```text
Spec
  ↓
Fixture
  ↓
Page Object / Component Object
  ↓
Playwright Page
  ↓
Application UI
```

A typical accessibility flow is:

```text
Spec
  ↓
Fixture
  ↓
AccessibilityScanner
  ↓
central WCAG policy
  ↓
axe analysis
  ↓
formatted diagnostics
  ↓
accessibility assertion
```

A typical visual regression flow is:

```text
Spec
  ↓
deterministic test state
  ↓
existing API / fixture / Page Object boundaries
  ↓
stable rendered page or component
  ↓
native Playwright screenshot assertion
  ↓
version-controlled approved baseline
  ↓
visual comparison
```

A typical performance flow is:

```text
k6 setup
  ↓
user registration
  ↓
API authentication
  ↓
measured task-read workload
  ↓
workload-specific metrics
  ↓
performance thresholds
  ↓
PASS / FAIL
  +
HTML report
```

Performance workloads use the k6 runtime independently from Playwright clients and fixtures. Shared configuration may be reused where it is runtime-neutral, while HTTP transport remains native to the execution technology.

API and UI flows may be composed when API setup provides faster or more reliable prerequisites for UI behavior.

Visual regression tests may use the same API-driven or programmatic setup boundaries when those boundaries provide the most deterministic way to establish the rendered state under test.

## Test Execution Architecture

The framework separates browser-independent API execution, browser-dependent UI execution, automated accessibility execution, visual regression execution, and k6 performance execution.

Playwright projects represent execution responsibility rather than simply duplicating the full suite across multiple browser configurations.

Current project boundaries:

```text
api
→ tests/api/**
→ browser-independent
→ executed once

accessibility
→ tests/accessibility/**
→ automated WCAG accessibility coverage
→ Chromium execution
→ executed once

visual
→ tests/visual/**
→ native visual regression coverage
→ Chromium execution
→ canonical Docker/Linux runtime
→ executed once

chromium
→ tests/ui/**
→ tests/smoke/**
→ Chromium browser coverage

firefox
→ tests/ui/**
→ tests/smoke/**
→ Firefox browser coverage

webkit
→ tests/ui/**
→ tests/smoke/**
→ WebKit browser coverage
```

API tests use Playwright's HTTP capabilities and do not validate browser-engine behavior. They must therefore not be multiplied across Chromium, Firefox, and WebKit projects.

Accessibility tests use browser-rendered application state but have a dedicated execution responsibility. The current automated accessibility gate executes through Chromium rather than being multiplied across the full UI browser matrix.

Visual regression tests also use browser-rendered application state but have a dedicated execution responsibility. The current visual gate executes through Chromium in the canonical Docker/Linux runtime so the framework compares against one controlled baseline environment rather than maintaining equivalent baselines across every browser engine.

UI and smoke tests validate browser-visible behavior and may run across multiple browser projects because rendering, interaction, and browser behavior can differ.

This separation avoids redundant API, accessibility, and visual execution while preserving cross-browser UI coverage.

Additional browser-specific visual execution should be introduced only when a concrete browser-specific visual requirement demonstrates value.

Performance workloads are not Playwright projects.

```text
performance/k6/**
→ k6 runtime
→ controlled API performance execution
```

Performance execution remains separate because load generation, performance metrics, thresholds, and runtime behavior have different responsibilities from functional Playwright automation.

## Docker Execution Architecture

Docker provides an additional reproducible execution boundary for the Playwright framework.

The current test image uses the official Playwright runtime matching the project's installed Playwright version:

```text
mcr.microsoft.com/playwright:v1.62.1-noble
```

The image contains the browser binaries and operating-system dependencies required for Playwright execution.

Project dependencies are installed inside the image through:

```text
npm ci
```

using the committed package manifest and lockfile.

The image is intentionally reusable across Playwright projects.

```text
one test image
    ↓
runtime command
    ├── complete suite
    ├── api
    ├── accessibility
    ├── visual
    ├── chromium
    ├── firefox
    └── webkit
```

Separate Docker images should not be introduced merely because the framework contains separate Playwright projects.

The execution project remains a Playwright responsibility. Docker provides the execution environment.

For visual regression, Docker additionally provides the canonical rendering boundary used for approved baseline generation and CI comparison.

Performance execution uses the official pinned k6 runtime separately from the Playwright test image:

```text
grafana/k6:1.8.1
```

The k6 script and report directory are mounted into the container at runtime. k6 is not installed into the Playwright image because browser automation and performance workload generation have separate runtime responsibilities.

### Docker Image and Container Boundary

A Docker image represents the reusable execution environment.

A container represents a runtime instance of that image.

```text
Dockerfile
    ↓
docker build
    ↓
image
    ↓
docker run
    ↓
container
    ↓
Playwright process
    ↓
exit code
```

The lifetime of a test container follows the lifetime of its main process.

When Playwright completes, the container stops.

For ephemeral test execution, stopped containers may be removed automatically through:

```text
--rm
```

The container exit code communicates the result of the test process to the calling execution environment.

### Docker Environment Model

The Docker image must remain independent from the selected test target.

The framework follows:

```text
build once
→ configure at runtime
```

`TEST_ENV` is therefore supplied when the container executes rather than baked into the image.

For example:

```text
Docker container
→ execution environment

TEST_ENV=hosted
→ test target environment
```

This preserves the same distinction already used by CI:

```text
execution context
≠
test target environment
```

A reusable image should not need to be rebuilt merely to select another supported test target.

### Docker Artifact Boundary

A container filesystem is ephemeral and must not be treated as durable artifact storage.

Outputs that must survive container removal need an explicit persistence boundary.

For local Docker execution, the current approach uses bind mounts:

```text
container
/app/playwright-report
/app/test-results
        ↓
bind mount
        ↓
host
playwright-report/
test-results/
```

This allows the container to be removed after execution while preserving the generated test evidence.

Docker artifact persistence and CI artifact storage are related concerns but use different mechanisms.

```text
local Docker
→ bind mount to host

GitHub Actions
→ workflow artifact upload
```

The architecture requires durable diagnostic outputs where needed; it does not require every execution environment to use the same persistence mechanism.

Visual baseline generation has an additional persistence requirement because approved snapshot candidates must survive the ephemeral container and become version-controlled repository assets.

For canonical baseline generation:

```text
container
/app/tests/visual
        ↓
bind mount
        ↓
host repository
tests/visual/
```

This allows Playwright-generated snapshot files to be written back to the working tree for review and later Git versioning.

Approved visual baselines are not execution artifacts.

```text
playwright-report/
test-results/
→ transient execution outputs

tests/visual/**-snapshots/
→ version-controlled expected visual state
```

### Docker Build Boundary

The Docker build context is the repository root.

The Dockerfile copies dependency metadata before the remaining source:

```text
package.json + package-lock.json
    ↓
npm ci
    ↓
remaining repository source
```

This ordering creates a dependency installation layer that can remain reusable when project source changes without dependency metadata changing.

`.dockerignore` prevents local or sensitive files that do not belong in the image from entering the build context.

Current exclusions include local dependency directories, generated reports, Git metadata, and environment files.

Secrets must not be copied into an image. Removing a secret in a later Dockerfile instruction does not make its presence in an earlier image layer acceptable.

## CI Execution Architecture

CI execution is organized by responsibility while using the Docker image as the reusable Playwright execution environment.

The current GitHub Actions dependency model is:

```text
quality
├── formatting
└── typecheck
        ↓
build-image
├── docker build once
├── image tag = github.sha
└── push image to GHCR
        ↓
        ├── api
        │   └── pull same SHA image → API tests once
        │
        ├── accessibility
        │   └── pull same SHA image → automated accessibility tests once
        │
        ├── visual
        │   └── pull same SHA image → visual regression tests once
        │
        └── ui matrix
            ├── pull same SHA image → chromium
            ├── pull same SHA image → firefox
            └── pull same SHA image → webkit
```

The `build-image` job depends on the successful completion of the `quality` job.

The `api`, `accessibility`, `visual`, and `ui` jobs depend on `build-image` but do not depend on one another.

This allows API, accessibility, visual, and UI execution to proceed independently and in parallel after the reusable test image has been built.

The Docker image is built once per trusted workflow execution and tagged with the current commit SHA.

The built image is published to GitHub Container Registry and reused by downstream jobs through the same immutable SHA tag:

```text
docker build
→ docker push to GHCR
→ docker pull exact SHA
→ docker run
```

For fork pull requests where registry write access is not appropriate, downstream jobs build the image locally rather than requiring package write access.

API, accessibility, visual, and browser execution use the same image.

Playwright project selection remains responsible for execution scope:

```text
api
→ --project=api

accessibility
→ --project=accessibility

visual
→ --project=visual

ui matrix
→ --project=chromium
→ --project=firefox
→ --project=webkit
```

The visual CI boundary is compare-only.

CI must compare current rendering against committed baselines and must not approve or regenerate expected images automatically.

```text
CI
→ verify committed visual contract

not

CI
→ update expected visual contract
```

CI therefore does not run:

```text
--update-snapshots
```

CI does not create separate images for individual Playwright projects.

Test containers are ephemeral and return the Playwright process exit code to GitHub Actions.

Generated Playwright output is bind-mounted to the runner before GitHub Actions uploads the required reports and diagnostics as workflow artifacts.

This preserves a single reusable execution environment while retaining explicit API, accessibility, visual, and browser execution ownership.

### Performance CI Execution

Performance execution is owned by the separate `.github/workflows/performance.yml` workflow.

The current hosted performance workflow is manually triggered through:

```text
workflow_dispatch
```

The shared hosted application is not treated as an isolated load-test environment, so the performance workload does not run automatically for every pull request or push.

The workflow:

```text
resolves TEST_ENV
→ reads the shared environment configuration
→ passes apiBaseUrl to k6 as TARGET_BASE_URL
→ runs the pinned k6 Docker image
→ enforces performance thresholds
→ exports an HTML report
→ uploads the report as a workflow artifact
```

The current workload uses two virtual users for 30 seconds and measures authenticated task reads through dedicated `task_read_duration` and `task_read_failures` metrics.

Current quality thresholds are:

```text
task_read_duration
→ p(95) < 500 ms

task_read_failures
→ rate < 1%
```

Registration and login are setup prerequisites and are intentionally excluded from the task-read latency metric.

### CI Execution Hardening

CI execution includes explicit controls for efficiency, isolation, and diagnostic completeness.

The quality job uses the npm package cache while preserving `npm ci` as its reproducible installation boundary.

```text
npm cache
→ reuse downloaded package data

npm ci
→ clean lockfile-based dependency installation
```

The containerized test jobs do not reinstall project dependencies. Their dependency state comes from the previously built Docker image, where dependencies were installed through `npm ci`.

Caching must improve execution efficiency without bypassing deterministic dependency installation.

Workflow concurrency groups executions by workflow and logical change. Newer executions cancel obsolete in-progress executions for the same pull request or branch without cancelling unrelated pull requests.

```text
same workflow
+
same pull request or branch
→ same concurrency group
→ newer run cancels obsolete run
```

CI jobs use explicit job-level timeouts as safety ceilings against stuck or unexpectedly long-running execution.

Current limits are:

```text
quality
→ 5 minutes

build-image
→ 15 minutes

api
→ 10 minutes

accessibility
→ 10 minutes

visual
→ 10 minutes

ui matrix job
→ 10 minutes per browser
```

These limits are safety boundaries rather than expected execution durations.

The browser matrix uses `fail-fast: false`. A failure in one browser must not automatically cancel the remaining browser jobs.

```text
Chromium failure
→ Firefox continues
→ WebKit continues
→ complete cross-browser diagnostic signal
```

This intentionally favors diagnostic completeness across supported browsers over cancelling the matrix after the first browser-specific failure.

## CI Environment Model

CI execution context and test target environment are separate concepts.

```text
CI execution context
→ GitHub Actions
→ process.env.CI

Test target environment
→ selected through TEST_ENV
```

The current CI workflow explicitly targets:

```text
TEST_ENV=hosted
```

This makes CI intent explicit rather than relying on the framework's default environment.

A future change to the default test environment must not silently redirect CI execution to another target.

Supported environment URLs are owned by:

```text
config/environments/environments.json
```

The TypeScript environment layer consumes the same data for Playwright execution, while the performance workflow resolves the selected environment's `apiBaseUrl` and passes it to k6 through `TARGET_BASE_URL`.

This allows Playwright and k6 to share environment data without sharing runtime-specific implementation.

## CI Permissions

Test workflows follow least-privilege principles.

The workflow defaults to repository content read access:

```text
permissions:
  contents: read
```

The image-publishing job additionally requires:

```text
packages: write
```

because it publishes the SHA-tagged Playwright image to GitHub Container Registry.

Downstream test jobs require:

```text
packages: read
```

to pull the published image.

Package permissions are scoped to the jobs that require them rather than granted workflow-wide.

Additional permissions should be introduced only when a workflow capability demonstrates a concrete need.

Secrets must not be introduced merely to demonstrate secret support. Sensitive values should be stored in an appropriate secret store only when a real runtime credential requirement exists.

## CI Artifact Strategy

Playwright generates test reports and failure diagnostics. CI is responsible for preserving those outputs when useful.

Current artifact strategy:

```text
HTML report
→ uploaded for successful and failed executions

Failure diagnostics
→ uploaded only when test execution fails
```

Artifacts are named by execution responsibility to avoid collisions and improve diagnostics.

Examples:

```text
playwright-report-api
playwright-report-accessibility
playwright-report-visual

playwright-report-chromium
playwright-report-firefox
playwright-report-webkit

test-results-api
test-results-accessibility
test-results-visual

test-results-chromium
test-results-firefox
test-results-webkit
```

Matrix jobs execute on independent runners, so identical local output paths are acceptable. Artifact upload names must remain unique when outputs originate from separate jobs.

Performance execution additionally preserves:

```text
performance-report-task-read
→ generated k6 HTML report
```

Executable Playwright Docker images are not workflow artifacts. They are distributed through GitHub Container Registry, while GitHub Actions artifacts remain responsible for reports and diagnostic evidence.

Artifact retention should be intentional and should balance diagnostic value with storage cost.

Committed visual baselines are deliberately excluded from this artifact model because they belong to repository version control rather than temporary CI storage.

## Layer Responsibilities

### Specs

Specs are responsible for verifying observable behavior.

They should:

- express the scenario and business expectation;
- use fixtures for reusable setup and state;
- use Page Objects and Component Objects for UI interaction;
- use API clients for API interaction;
- contain HTTP and business assertions;
- validate successful API responses against runtime schemas;
- contain native screenshot assertions for visual contracts;
- avoid duplicating framework infrastructure.

Specs should not become containers for reusable setup logic, raw locator implementation, or repeated HTTP mechanics.

Visual specs may contain explicit deterministic setup when the setup is scenario-specific and does not justify a new abstraction.

### Fixtures

Fixtures compose framework dependencies and manage reusable setup, state, and lifecycle.

Typical responsibilities include:

- constructing Page Objects and Component Objects;
- constructing API clients;
- generating test users;
- registering or authenticating users;
- creating reusable domain prerequisites;
- creating authenticated browser contexts;
- cleaning up owned resources when required.

Fixture dependencies should represent the actual setup flow.

A fixture should not be introduced merely to hide a single line of code. It should provide meaningful reuse, lifecycle management, state composition, or dependency management.

Visual regression does not create a separate fixture responsibility merely because screenshot testing exists.

Visual tests should reuse existing fixtures unless repeated visual-specific setup demonstrates meaningful lifecycle or dependency value.

### Factories

Factories create test data.

They should:

- generate valid data by default;
- allow explicit overrides;
- support intentionally partial or invalid payloads when required by negative tests;
- remain independent from HTTP and UI execution;
- avoid assertions.

Factories answer the question:

> What test data do I need?

They do not perform the operation that consumes that data.

Visual scenarios should prefer deterministic explicit overrides of existing factories rather than introducing visual-specific factories with duplicate responsibility.

### API Clients

API clients represent domain-specific HTTP interaction.

They are responsible for:

- constructing requests;
- applying authentication when required;
- sending HTTP requests;
- returning raw responses where tests need control over status and negative behavior;
- providing focused setup helpers when repeated setup behavior has demonstrated value.

API clients should not contain test assertions.

Setup helpers may fail fast when their contract requires successful setup.

The framework intentionally does not use a generic `BaseApiClient`. Shared abstractions should only be introduced when real duplication demonstrates a need.

Visual regression specs may reuse domain API clients to establish deterministic application state when the browser behavior under verification is the rendered result rather than the setup operation.

### Schemas

TypeBox schemas are the source of truth for provider API contracts.

They provide both:

```text
TypeBox Schema
  ├── Static<typeof schema> → compile-time TypeScript type
  └── AJV validation        → runtime contract validation
```

Provider responses must not be trusted through TypeScript casting before runtime validation.

Successful API responses should be validated at the provider boundary before their fields are used as typed contract data.

### Models

Models represent framework-owned or test-state concepts when they are not provider API contracts.

For example, framework user state may combine test data with an access token used by later fixtures.

Provider request and response contracts belong in schemas rather than duplicated TypeScript interfaces.

### Constants

Constants represent reusable, stable domain values.

They are appropriate for values such as:

- supported domain states;
- supported priorities;
- stable API error messages used across tests.

One-off values should remain local when extracting them would not improve reuse or clarity.

Shared visual comparison policy may also be represented through focused visual constants when the values describe framework-wide screenshot behavior rather than scenario-specific exceptions.

### Page Objects

Page Objects encapsulate page-level UI structure and interaction.

They are responsible for:

- owning the Playwright `Page`;
- defining page-level locators;
- exposing meaningful user actions;
- exposing locator queries required for assertions.

Page Objects should use domain types when the domain already defines the value.

Assertions normally remain in specs.

Visual regression should reuse the same Page Object ownership.

A page-level screenshot may use the `Page` owned by the relevant Page Object rather than bypassing the established page boundary through an additional unrelated fixture.

### Component Objects

Component Objects represent reusable UI regions that are not entire pages.

Child locators should be scoped to the component root when the DOM boundary supports it.

Elements rendered outside that DOM subtree, such as portal-rendered dropdown content, may remain page-scoped. Locator scope should reflect the real application DOM rather than artificial structural uniformity.

Component-level visual assertions should reuse an existing stable locator or Component Object boundary when one already represents the rendered region under test.

Do not create screenshot-specific Component Objects solely to obtain a locator for visual comparison.

### Mocks

Mocks provide controlled replacement of external or application network behavior.

They should:

- intercept only the behavior required by the scenario;
- preserve unrelated requests;
- remain focused on network behavior;
- avoid duplicating test assertions.

Mocks should represent provider behavior accurately rather than invent application states that the UI does not support.

### Utilities

Utilities contain reusable technical behavior that does not naturally belong to a domain-specific layer.

Utilities should remain focused. Domain behavior should not be moved into generic helpers merely to reduce line count.

Native Playwright screenshot assertions should not be wrapped in a generic visual utility without demonstrated repeated responsibility that Playwright itself does not already provide.

## Authentication Architecture

The target application has separate API and browser authentication mechanisms.

```text
API authentication
  → Bearer JWT

Browser authentication
  → Auth.js session
```

These mechanisms must not be treated as interchangeable.

The framework distinguishes between:

```text
testUserData
  → generated only

registeredTestUser
  → registered through API

authenticatedTestUser
  → registered + authenticated through API
  → contains access token

authenticatedPage
  → authenticated browser context
  → programmatic Auth.js session
```

UI authentication setup should preserve programmatic browser authentication rather than falling back to UI login unless the UI login flow itself is the behavior under test.

## API Contract Strategy

The framework uses schema-first API contracts.

The expected positive-response flow is:

```text
request
→ HTTP assertion
→ parse response as unknown
→ runtime schema validation
→ typed business assertions
```

Negative tests do not force successful response schemas onto error responses.

Validation should reflect the provider's observed contract, including nullable fields and server-side defaults.

## Test Data Strategy

Test data should be generated through factories when reusable generation behavior exists.

Factories should provide valid defaults while allowing tests to express only the values relevant to the scenario.

Negative tests may intentionally bypass valid defaults or request partial payloads when testing validation and defaulting behavior.

Test data generation should remain separate from:

- API execution;
- UI interaction;
- assertions;
- fixture lifecycle.

Visual regression scenarios additionally require deterministic values for visible content that affects the screenshot contract.

Values that are intentionally visible in a baseline should not depend on uncontrolled random generation when that randomness changes rendered text, layout, or component state.

## UI Architecture

Public Page Objects may use the standard Playwright `page` fixture.

Protected UI flows may use `authenticatedPage`, which owns a separate authenticated browser context.

Objects must be constructed from the `Page` belonging to the context they operate on.

A Page Object or Component Object created from the default `page` fixture must not be reused against `authenticatedPage`.

## Accessibility Architecture

Automated accessibility testing uses `@axe-core/playwright` through a reusable framework scanner rather than constructing axe configuration directly inside specs.

The current automated accessibility policy targets WCAG 2.2 Level AA through the framework's central axe tag configuration.

The policy includes applicable Level A and Level AA rule tags from WCAG 2.0 and WCAG 2.1 together with WCAG 2.2 Level AA additions.

```text
WCAG_AA_TAGS
        ↓
AccessibilityScanner
        ↓
axe analysis
        ↓
AxeResults
```

The scanner is responsible for executing the configured accessibility analysis against the `Page` provided to it.

It does not:

- decide whether a test passes or fails;
- suppress violations;
- contain page-specific assertions;
- own presentation of failure diagnostics.

Accessibility assertions remain in specs.

Human-readable diagnostic formatting is separated from scan execution:

```text
AxeResults
    ↓
formatter
    ↓
readable failure message

AxeResults
    ↓
spec assertion
    ↓
pass / fail
```

The formatter must not change which violations are reported or determine the quality outcome.

Accessibility fixtures preserve browser-context ownership.

```text
page
→ accessibility

authenticatedPage
→ authenticatedAccessibility
```

This ensures that public and authenticated accessibility checks execute against the same `Page` instance used to establish the tested application state.

The current golden accessibility pattern uses full-page scans after the test has established a meaningful page state.

Scoped component scanning should not be introduced merely for structural completeness. A scoped abstraction should be added only when a concrete use case demonstrates a clean ownership model and architectural value.

Automated axe analysis is a quality gate for the rules included in the configured policy. It does not prove complete WCAG conformance and does not replace manual accessibility testing for requirements that cannot be reliably automated.

Known or provider-owned violations are not automatically suppressed merely to produce a passing pipeline. A real violation remains a failing accessibility signal unless an explicit future policy defines and justifies different handling.

## Visual Regression Architecture

Visual regression testing uses native Playwright screenshot assertions rather than introducing a separate visual-testing service layer.

The current architecture intentionally keeps visual behavior close to the spec while reusing existing framework ownership for setup and UI access.

```text
existing factory
        ↓
existing API client / authenticated fixture
        ↓
existing Page Object / locator
        ↓
stable rendered state
        ↓
toHaveScreenshot(...)
        ↓
approved baseline
```

The visual layer currently contains only shared screenshot-comparison policy that has demonstrated framework-wide value.

Current shared policy:

```text
animations
→ disabled

caret
→ hidden
```

These settings reduce rendering noise while preserving meaningful visual content.

The architecture does not currently introduce:

- a visual scanner class;
- a visual service;
- a visual fixture hierarchy;
- a screenshot wrapper;
- a visual-specific task factory;
- default global masking;
- default global pixel tolerance.

Those abstractions should be introduced only if repeated real requirements demonstrate a responsibility that native Playwright assertions and existing framework layers do not already own.

### Visual Contract Scope

The current golden visual pattern demonstrates two complementary contracts:

```text
page-level
→ authenticated dashboard state

component-level
→ deterministic task card state
```

A page-level visual contract protects overall composition, placement, navigation, hierarchy, spacing, and relevant page content.

A component-level visual contract protects a smaller reusable rendered region and provides more focused diagnostics when that component changes.

These contracts are related but not redundant.

Additional visual tests should be added only when they protect a meaningful visual risk rather than attempting to screenshot every existing functional test.

### Visual State Ownership

Visual regression requires deterministic rendered state.

State preparation may legitimately combine:

```text
domain factory
+
API setup
+
authenticated browser context
+
Page Object navigation
+
explicit readiness condition
```

The setup mechanism should be selected for determinism and relevance to the rendered state under test.

A visual test does not require a separate "Act" phase when the behavior being verified is the resulting visual state itself.

The architectural boundary is:

```text
state preparation
        ↓
visual assertion
```

Existing framework abstractions should be reused where they already provide the required responsibility.

A new fixture or helper should not be created merely to shorten visual specs.

### Baseline Architecture

Approved baseline images represent expected visual behavior.

They are version-controlled test assets.

```text
spec
+
snapshot directory
+
approved PNG
=
versioned visual contract
```

Current ownership pattern:

```text
tests/visual/
  visual.spec.ts
  visual.spec.ts-snapshots/
    task-dashboard-visual-linux.png
    task-card-visual-linux.png
```

Logical snapshot names remain in the spec:

```text
task-dashboard.png
task-card.png
```

Playwright owns project/platform-specific physical naming.

Baseline files must remain colocated with their owning spec through the Playwright snapshot model unless a future architectural decision establishes a different repository-wide ownership model.

### Canonical Rendering Boundary

Visual comparison is sensitive to:

- operating system;
- browser build;
- fonts;
- rendering engine;
- environment;
- unstable content.

The framework therefore defines the reusable Playwright Docker/Linux environment as the canonical rendering boundary.

```text
developer machine
→ may differ

canonical Docker/Linux runtime
→ baseline generation
→ reproducibility verification
→ CI comparison
```

Approved baselines must not depend on developer-specific macOS or Windows rendering.

The same Docker image family used by CI should be used when generating or intentionally updating expected images.

### Baseline Approval Boundary

Baseline generation and baseline approval are separate concepts.

```text
Playwright generates PNG
≠
baseline approved
```

A generated baseline becomes approved only after:

```text
canonical generation
→ human review
→ same-runtime rerun without update
→ reproducibility confirmation
→ Git commit
```

This keeps approval explicit and reviewable.

CI does not own baseline approval.

### Baseline Change Decision

A failing screenshot comparison does not imply that the baseline should change.

The required architectural decision is:

```text
visual diff
        ↓
RCA
        ↓
intended change?
```

If yes:

```text
regenerate in canonical runtime
→ review
→ verify without update
→ version approved baseline change
```

If no:

```text
preserve failing expectation
→ correct product or test instability
```

This prevents baseline regeneration from becoming an automatic failure-recovery mechanism.

### Visual Failure Evidence

Playwright provides focused visual failure evidence:

```text
expected
actual
diff
```

These outputs belong to execution diagnostics and may be persisted through `test-results` and CI artifacts.

They are distinct from committed baseline ownership.

## Performance Testing Architecture

Performance testing is intentionally separated from Playwright functional automation and uses k6 for controlled API workload generation.

The current baseline measures authenticated task reads:

```text
setup
├── register performance user
└── authenticate performance user
        ↓
measured workload
└── GET /tasks
```

The performance script uses native k6 HTTP APIs rather than importing Playwright API clients.

This preserves the runtime boundary:

```text
Playwright API clients
→ functional API automation

k6 HTTP
→ performance workload generation
```

Shared runtime-neutral configuration may be reused across both technologies, but runtime-specific transport implementations remain separate.

The measured operation owns dedicated metrics:

```text
task_read_duration
task_read_failures
```

This prevents setup traffic such as registration and login from contaminating the task-read quality gate.

The current baseline workload is:

```text
2 virtual users
30 seconds
1 second pacing between iterations
```

It represents a controlled baseline against the shared hosted application rather than a production capacity, stress, spike, or endurance model.

Performance thresholds are executable quality gates and should be calibrated from repeated baseline evidence rather than selected from a single run or arbitrary round numbers.

The current thresholds are:

```text
task_read_duration
→ p(95) < 500 ms

task_read_failures
→ rate < 1%
```

k6 also exports an HTML report for human-readable execution evidence.

Threshold evaluation and reporting have separate responsibilities:

```text
thresholds
→ machine-enforced quality decision

HTML report
→ human-readable execution evidence
```

## Execution Boundary Rules

Test placement and Playwright project ownership must remain aligned.

Use:

```text
tests/api/**
→ API project

tests/accessibility/**
→ accessibility project

tests/visual/**
→ visual project

tests/ui/**
→ browser projects

tests/smoke/**
→ browser projects

performance/k6/**
→ k6 performance runtime
```

Do not place browser-dependent behavior under the API suite.

Do not place browser-independent API contract tests under UI or smoke suites merely to force execution through browser projects.

Accessibility tests should remain under the dedicated accessibility project rather than being added to the standard UI browser matrix solely for structural symmetry.

Visual regression tests should remain under the dedicated visual project rather than being multiplied across the standard UI browser matrix solely for structural symmetry.

The current visual project executes once through Chromium in the canonical Docker/Linux runtime.

Browser-specific visual projects or baselines should be introduced only when a concrete browser-specific requirement demonstrates a materially different visual risk.

Performance workloads should remain under the dedicated k6 execution boundary rather than being introduced as Playwright projects solely to reuse the existing test-runner structure.

If a new test type requires a materially different execution model, introduce the smallest explicit project boundary required by the behavior rather than extending unrelated projects.

Docker does not change Playwright project ownership.

Running a test inside a container changes its execution environment, not its test responsibility.

## Abstraction Rules

Before creating a new abstraction, determine whether the existing architecture can be extended.

Do not introduce a new:

- base client;
- service layer;
- generic factory;
- generic mock service;
- domain directory;
- helper wrapper;
- fixture;
- visual wrapper;

solely for symmetry or anticipated future reuse.

New abstractions should solve demonstrated duplication, lifecycle complexity, domain responsibility, or maintainability problems.

Consistency means equivalent responsibilities follow equivalent patterns. It does not mean different responsibilities must have identical structure.

For visual regression specifically, native Playwright screenshot assertions remain the default mechanism unless demonstrated repeated behavior requires a new architectural abstraction.

## Architectural Change Policy

Small additions that follow existing architectural rules do not require an ADR.

An ADR should be considered when a change:

- introduces a new architectural layer;
- changes dependency direction;
- replaces an established framework pattern;
- introduces a major external technology;
- changes authentication strategy;
- significantly changes execution or deployment architecture.

Changes to test-project boundaries or CI execution responsibilities should be documented when they alter how suites are selected, distributed, or validated.

The current native Playwright visual regression implementation does not introduce a separate major external technology or new service layer. Its project boundary, baseline ownership, canonical runtime, and CI responsibility are therefore documented directly in the framework architecture and testing standards.

A future move to an external visual-testing platform or materially different baseline ownership model should be reviewed as a potential architectural decision.

When implementation and documentation disagree, the discrepancy should be resolved rather than allowing the documentation to become stale.

Architecture documentation should evolve together with meaningful framework changes.
