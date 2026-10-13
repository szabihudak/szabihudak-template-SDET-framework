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
- performance execution should use the runtime boundary appropriate to the measurement responsibility;
- performance quality gates should use workload-specific metrics rather than unrelated setup traffic;
- shared target environment data should have a runtime-neutral source of truth;
- executable container images and diagnostic workflow artifacts should use storage mechanisms appropriate to their responsibilities;
- abstractions are introduced only when there is demonstrated reuse or architectural value;
- existing patterns should be extended before parallel patterns are created.

## Repository Structure

```text
framework/            template-owned (see ADR-007)
  core/               framework core, imported as @framework/...
    accessibility/  api/  auth/  config/  database/
    fixtures/  performance/  reporting/  utils/  visual/
  templates/          golden templates, catalogue (index.json), roundtrip/ values for the UPEX check
  tools/              setup, doctor, ci-plan, architecture and template checks
  setup/              starter files, AI tool files, self-test (not copied to projects)
  prompts/            first-tests task for /first-tests and /first-tests-build
  docs/               architecture, standards, ADRs

src/                  application layer, imported as @app/... (UPEX reference here)
  api/  clients/  constants/  models/  schemas/
  components/  data/  database/  fixtures/  mocks/  pages/

tests/                specs (UPEX reference here)
  accessibility/  api/  database/  performance/  smoke/  ui/  visual/

config/
  framework.config.ts
  environments/
  approved-examples.json

.github/
  workflows/          UPEX pipeline (projects get the starter workflows)
  copilot-instructions.md

AGENTS.md  README.md  install.sh
playwright.config.ts  package.json  package-lock.json  tsconfig.json
Dockerfile  Dockerfile.upex-local  .dockerignore  docker-compose.yml  docker-compose.local.yml
```

## Template Architecture

The framework is a reusable template ([ADR-007](adr/ADR-007-reusable-template-architecture.md)). Ownership is split so a project can be configured and updated without editing framework code:

```text
framework/     template-owned: core, golden templates, tools, docs
src/           project-owned application layer
tests/         project-owned specs
config/        project-owned configuration and approved examples
```

Dependencies flow from `src` and `tests` to `framework/core`, never the reverse. `npm run lint:architecture` enforces this together with the layer rules.

Golden templates in `framework/templates/` are derived from canonical reference files and must reproduce them exactly (`npm run qa:templates:check`). `npm run setup` (or `./install.sh`) creates a new project folder next to the template with only the project files and its own git history, and `npm run doctor` verifies it.

A configured project uses generic workflows from `framework/setup/starter/.github/workflows/` instead of the UPEX image-based pipeline described below:

```text
quality
├── formatting, typecheck, architecture rules, golden template check
└── plan (framework/tools/ci-plan.ts)
        → projects from config/framework.config.ts
        → database only where TEST_ENV allows it
        → performance excluded (manual workflow)
        ↓
tests (matrix: one job per planned project)
→ official Playwright image (canonical runtime, visual compare-only)
→ deployed environment from the TEST_ENV repository variable
→ role credentials from repository secrets
```

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

A typical database validation flow is:

```text
Spec
  ↓
Fixture
  ↓
Domain Database Client
  ↓
DatabaseClient
  ↓
PostgreSQL / Neon
  ↓
Persistence assertions
```

Database tests validate persisted application state after behavior has been exercised through the supported application boundary. Domain database clients own domain-specific queries, while `DatabaseClient` owns PostgreSQL transport and connection lifecycle.

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

A typical API performance flow is:

```text
k6 setup
  ↓
user registration
  ↓
API authentication
  ↓
dedicated task creation
  ↓
measured task-read workload
  ↓
workload-specific metrics
  ↓
performance thresholds
  ↓
k6 teardown
  ↓
dedicated task cleanup
  ↓
PASS / FAIL
  +
HTML report
```

A typical authenticated browser performance flow is:

```text
existing deterministic fixture setup
  ↓
authenticated browser state
  ↓
representative dashboard state
  ↓
3 independent Lighthouse measurements
  ↓
median browser performance metrics
  ↓
shared Lighthouse threshold policy
  ↓
PASS / FAIL
  +
HTML / JSON evidence
```

Authenticated browser performance reuses the existing Playwright fixture and Page Object boundaries to establish representative application state, while Lighthouse owns browser performance measurement.

Performance workloads use the k6 runtime independently from Playwright clients and fixtures. Shared configuration may be reused where it is runtime-neutral, while HTTP transport remains native to the execution technology.

The framework contains no AI provider integration. Test design and failure analysis are done by coding agents (Copilot, Claude Code) with repository context and Playwright's own evidence, under human review.

The detailed AI-assisted engineering workflow, evidence boundaries, validated capabilities, and remaining limitations are defined in [`AI_ASSISTED_QA_WORKFLOW.md`](AI_ASSISTED_QA_WORKFLOW.md).

API and UI flows may be composed when API setup provides faster or more reliable prerequisites for UI behavior.

Visual regression tests may use the same API-driven or programmatic setup boundaries when those boundaries provide the most deterministic way to establish the rendered state under test.

## Test Execution Architecture

The framework separates browser-independent API execution, browser-independent database validation, browser-dependent UI execution, automated accessibility execution, visual regression execution, API performance execution, and browser performance execution.

Playwright projects represent execution responsibility rather than simply duplicating the full suite across multiple browser configurations.

Projects are generated from the enabled `modules` and `browsers` in `config/framework.config.ts`.

Current project boundaries:

```text
api
→ tests/api/**
→ browser-independent
→ executed once

database
→ tests/database/**
→ browser-independent persistence validation
→ environment with allow.database (localDocker)
→ retries disabled
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

Database tests validate persisted application state directly against the dedicated test database. They execute once through the dedicated `database` project and are not multiplied across browser projects. Database execution requires the isolated `localDocker` environment because direct database access and destructive reset operations must not target the shared hosted application environment.

Database project retries remain disabled. A failed persistence validation should preserve the original database state for investigation rather than automatically creating another set of persistent test data through a retry.

Accessibility tests use browser-rendered application state but have a dedicated execution responsibility. The current automated accessibility gate executes through Chromium rather than being multiplied across the full UI browser matrix.

Visual regression tests also use browser-rendered application state but have a dedicated execution responsibility. The current visual gate executes through Chromium in the canonical Docker/Linux runtime so the framework compares against one controlled baseline environment rather than maintaining equivalent baselines across every browser engine.

UI and smoke tests validate browser-visible behavior and may run across multiple browser projects because rendering, interaction, and browser behavior can differ.

This separation avoids redundant API, database, accessibility, and visual execution while preserving cross-browser UI coverage.

Additional browser-specific visual execution should be introduced only when a concrete browser-specific visual requirement demonstrates value.

API performance workloads are not Playwright projects.

```text
tests/performance/k6/**
→ k6 runtime
→ controlled API performance execution

tests/performance/**
→ performance Playwright project
→ authenticated browser performance execution
→ Lighthouse measurement
```

API performance remains in the dedicated k6 runtime because load generation, workload metrics, thresholds, and runtime behavior have different responsibilities from functional Playwright automation.

Authenticated browser performance uses a dedicated Playwright project when existing fixtures and browser state are required to establish the representative state measured by Lighthouse.

## Docker Execution Architecture

Docker provides the reproducible execution boundary for the containerized Playwright framework and the local UPEX application runtime used by `localDocker` execution.

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
    ├── database
    ├── accessibility
    ├── visual
    ├── chromium
    ├── firefox
    └── webkit
```

Separate Playwright Docker images should not be introduced merely because the framework contains separate Playwright projects.

The execution project remains a Playwright responsibility. Docker provides the execution environment.

The framework also owns the Docker definition required to build UPEX as the local application under test.

```text
Dockerfile.upex-local
        ↓
UPEX source
        ↓
production build
        ↓
UPEX application image
```

The UPEX repository remains the source of the application code. The framework owns the test execution environment and therefore owns the Docker runtime definition used to build and execute that source for local framework validation.

Docker Compose connects the application and test execution boundaries:

```text
docker-compose.yml
→ shared runtime contract

docker-compose.local.yml
→ local source-build override
```

The base Compose definition describes how the application and test images execute together. The local override builds those images from the local framework and sibling UPEX source repositories.

The resulting localDocker topology is:

```text
Playwright test container
        │
        │ http://upex-local:3000
        ▼
UPEX application container
        │
        │ DATABASE_URL
        ▼
dedicated Neon test database
```

The test container receives the same dedicated test-database connection boundary when direct persistence validation is required:

```text
Playwright database test
        │
        │ DATABASE_URL
        ▼
dedicated Neon test database
```

The database is intentionally not represented by a local PostgreSQL container. The current architecture uses a dedicated Neon PostgreSQL test database while application and Playwright execution are containerized locally.

The localDocker topology, separate application and test image ownership, and functional CI execution model are documented in:

```text
framework/docs/adr/ADR-006-localdocker-and-ci-execution-architecture.md
```

For visual regression, Docker additionally provides the canonical rendering boundary used for approved baseline generation and CI comparison.

Performance execution uses the official pinned k6 runtime separately from the Playwright test image:

```text
grafana/k6:1.8.1
```

The k6 script and report directory are mounted into the container at runtime. k6 is not installed into the Playwright image because browser automation and performance workload generation have separate runtime responsibilities.

Lighthouse browser performance does not use the k6 container.

Standalone LHCI and authenticated Playwright + Lighthouse execution use the Node runtime with the Playwright-managed Chromium installation prepared for browser-performance execution and therefore execute through the environment prepared for browser-performance execution.

```text
k6 API performance
→ pinned k6 Docker runtime

Lighthouse browser performance
→ Node + Playwright-managed Chromium runtime
→ standalone LHCI or Playwright-orchestrated authenticated audit
```

The framework does not force both performance technologies into one universal container because their runtime and measurement responsibilities are different.

### Docker Image and Container Boundary

A Docker image represents a reusable execution environment.

A container represents a runtime instance of an image.

```text
Playwright Dockerfile
    ↓
docker build
    ↓
Playwright test image
    ↓
test container
    ↓
Playwright process
    ↓
exit code
```

The local UPEX application follows the same image/container separation:

```text
Dockerfile.upex-local
    ↓
docker build
    ↓
UPEX application image
    ↓
application container
    ↓
production UPEX process
```

The lifetime of a test container follows the lifetime of its main process.

When Playwright completes, the container stops.

For ephemeral test execution, stopped containers may be removed automatically through:

```text
--rm
```

The container exit code communicates the result of the test process to the calling execution environment.

### Docker Environment Model

The Playwright Docker image must remain independent from the selected test target.

The framework follows:

```text
build once
→ configure at runtime
```

`TEST_ENV` is therefore supplied when the container executes rather than baked into the image.

The framework distinguishes native local execution from containerized local execution:

```text
native developer execution
→ TEST_ENV=local
→ http://localhost:3000

containerized local execution
→ TEST_ENV=localDocker
→ http://upex-local:3000
```

In native local execution, Playwright runs directly on the developer machine and reaches a locally running UPEX application through `localhost:3000`.

In `localDocker` execution, Playwright runs inside the Compose network. `localhost` inside the Playwright container refers to the Playwright container itself rather than the UPEX application container. The application is therefore reached through the Compose network alias:

```text
upex-local
```

The same `localDocker` execution model is used by the main Playwright CI workflow:

```text
developer localDocker
→ Docker Compose
→ UPEX application container
→ Playwright test container

GitHub Actions
→ Docker Compose
→ UPEX application container
→ Playwright test container
```

This preserves the distinction:

```text
execution context
≠
test target environment
```

The supported target configuration remains owned by `config/environments/environments.json`.

The current execution intent is:

```text
hosted
→ deployed UPEX application

local
→ developer-native localhost execution

localDocker
→ Docker Compose UPEX execution
→ used for reproducible local functional validation
→ used by the main Playwright CI workflow

performance execution
→ hosted target
```

A reusable Playwright image should not need to be rebuilt merely to select another supported test target.

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

The Playwright Docker build context is the framework repository root.

The Dockerfile copies dependency metadata before the remaining source:

```text
package.json + package-lock.json
    ↓
npm ci
    ↓
remaining repository source
```

This ordering creates a dependency installation layer that can remain reusable when project source changes without dependency metadata changing.

The local UPEX image is built through `Dockerfile.upex-local` using the UPEX source as an additional Docker build context.

```text
framework repository
→ Dockerfile.upex-local

sibling UPEX repository
→ additional build context
→ application source

Docker build
→ UPEX production image
```

This keeps ownership explicit: UPEX owns the application source, while the framework owns the reproducible application-under-test runtime required by the automation environment.

`.dockerignore` prevents local or sensitive files that do not belong in the image from entering the build context.

Current exclusions include local dependency directories, generated reports, Git metadata, and environment files.

Secrets must not be copied into an image. Removing a secret in a later Dockerfile instruction does not make its presence in an earlier image layer acceptable.

Runtime credentials such as `DATABASE_URL` and application authentication configuration are supplied when containers execute rather than embedded into reusable images.

## CI Execution Architecture

CI execution is organized by testing responsibility while using immutable Docker images for both the Playwright framework and the local UPEX application under test.

The current GitHub Actions dependency model is:

```text
quality
├── formatting
├── typecheck
├── architecture rules
└── golden template check
        ↓
        ├── template-selftest
        │   └── setup into temporary folders (new folder and in place) → checks → doctor → login tests, rendered templates
        │
build-images
├── build Playwright test image
│   └── image tag = framework github.sha
├── resolve UPEX staging commit SHA
├── build UPEX application image
│   └── image tag = resolved UPEX commit SHA
└── push both images to GHCR
        ↓
        ├── api
        │   └── start UPEX → API tests once
        │
        ├── database
        │   └── start UPEX → database tests once
        │
        ├── accessibility
        │   └── start UPEX → automated accessibility tests once
        │
        ├── visual
        │   └── start UPEX → visual regression tests once
        │
        └── ui matrix
            ├── start UPEX → chromium
            ├── start UPEX → firefox
            └── start UPEX → webkit
```

The `build-images` job depends on the successful completion of the `quality` job.

The `api`, `database`, `accessibility`, `visual`, and `ui` jobs depend on `build-images` but do not depend on one another.

This allows API, database, accessibility, visual, and UI execution to proceed independently and in parallel after the reusable test and application images have been built.

The Playwright image is built once per workflow execution and tagged with the current framework commit SHA.

The UPEX application image is built from the resolved upstream UPEX source revision and tagged with that exact UPEX commit SHA.

```text
framework commit
→ Playwright image
→ framework SHA tag

resolved UPEX staging commit
→ UPEX application image
→ UPEX SHA tag
```

Both images are published to GitHub Container Registry and downstream jobs pull the exact immutable image versions selected by the build job.

```text
build images
→ push to GHCR
→ pull exact image versions
→ Docker Compose
→ execute tests
```

This prevents downstream capability jobs from independently rebuilding application or framework source and gives all functional jobs the same build artifacts for a workflow execution.

GHCR image retention is managed separately from test execution.

The cleanup policy is:

```text
weekly maintenance workflow
→ inspect playwright-enterprise-tests package versions
→ always keep the newest 3 versions
→ keep any additional versions younger than 7 days
→ delete only versions older than 7 days that are not among the newest 3
```

Cleanup is owned by:

```text
.github/workflows/ghcr-cleanup.yml
```

The Playwright CI workflow does not delete the image at the end of a test run. This preserves short-term reproducibility for recent commit-SHA images while preventing unbounded registry growth.

Registry lifecycle management is treated as a separate maintenance responsibility from functional test execution.

Each functional job starts the UPEX application through the shared Compose runtime and executes its Playwright project against that isolated local application instance.

```text
GitHub Actions runner
        ↓
Docker Compose
        ├── UPEX application container
        │       ↓
        │   dedicated Neon test database
        │
        └── Playwright test container
                ↓
           TEST_ENV=localDocker
                ↓
           http://upex-local:3000
```

API, database, accessibility, visual, and browser execution use the same Playwright image and the same localDocker application architecture.

Playwright project selection remains responsible for execution scope:

```text
api
→ --project=api

database
→ --project=database

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

CI does not create separate Playwright images for individual Playwright projects.

Test containers are ephemeral and return the Playwright process exit code to GitHub Actions.

Generated Playwright output is bind-mounted to the runner before GitHub Actions uploads the required reports and diagnostics as workflow artifacts.

Application logs are surfaced when functional execution fails so failures in the application-under-test boundary remain diagnosable alongside Playwright evidence.

This preserves a single reusable Playwright execution environment, a reproducible local application target, and explicit API, database, accessibility, visual, and browser execution ownership.

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

Browser performance execution is owned by a separate job in the same performance workflow:

```text
install Node dependencies and Chromium
→ run standalone LHCI against webBaseUrl
→ run authenticated dashboard Lighthouse through the performance Playwright project
→ evaluate Lighthouse quality gates
→ preserve Lighthouse and Playwright execution evidence
```

Keeping API and browser performance in separate jobs preserves their independent runtime and measurement responsibilities while retaining one explicit performance workflow boundary.

The current workload uses two virtual users for 30 seconds and measures authenticated task reads through dedicated `task_read_duration` and `task_read_failures` metrics.

The workload uses explicit setup and teardown lifecycle management:

```text
setup
→ register performance user
→ authenticate
→ create dedicated task

measured workload
→ authenticated task reads

teardown
→ delete the dedicated task
```

The dedicated task is test-owned data and is removed after execution.

The generated performance user currently remains because the target application does not expose a supported account-deletion endpoint. This is treated as a target-application limitation rather than bypassed through undocumented cleanup behavior.

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
→ 10 minutes

template-selftest
→ 10 minutes

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

ui matrix job
→ 15 minutes per browser
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

The main Playwright CI workflow explicitly targets:

```text
TEST_ENV=localDocker
```

The application under test is started on each functional job's GitHub Actions runner through Docker Compose and is reached from the Playwright container through:

```text
http://upex-local:3000
```

This makes CI intent explicit, since the framework has no default environment, and ensures that API, database, accessibility, visual, and UI validation use the reproducible local application runtime.

Performance execution remains a separate boundary and targets the hosted application through the dedicated performance workflow.

```text
main Playwright CI
→ localDocker
→ ephemeral UPEX application runtime

performance workflow
→ hosted
→ deployed UPEX application
```

`TEST_ENV` is required. Environment-dependent code fails immediately when it is missing rather than falling back to a shared deployment.

Each environment also declares which sensitive operations it allows:

```text
allow.database     → direct database access
allow.destructive  → destructive database reset
allow.performance  → k6 and Lighthouse measurement
```

Guards check these permissions rather than environment names.

Supported environment URLs are owned by:

```text
config/environments/environments.json
```

The TypeScript environment layer consumes the same data for Playwright execution, while the performance workflow resolves environment-specific targets for each performance boundary:

```text
k6 API performance
→ apiBaseUrl
→ TARGET_BASE_URL

Lighthouse browser performance
→ webBaseUrl
→ browser audit target
```

This allows Playwright, k6, and Lighthouse to share runtime-neutral environment data without sharing runtime-specific transport or execution implementation.

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

because it publishes the SHA-tagged Playwright and UPEX images to GitHub Container Registry.

Downstream test jobs require:

```text
packages: read
```

to pull the published images.

Package permissions are scoped to the jobs that require them rather than granted workflow-wide.

Additional permissions should be introduced only when a workflow capability demonstrates a concrete need.

Secrets must not be introduced merely to demonstrate secret support. Sensitive values should be stored in an appropriate secret store only when a real runtime credential requirement exists.

The dedicated test database connection is supplied to the runtime through `DATABASE_URL`. It must not be committed to repository configuration or embedded into either Docker image.

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

Matrix jobs execute on independent runners, so identical local output paths are acceptable. Artifact upload names must remain unique when outputs originate from separate jobs.

Performance execution additionally preserves:

```text
performance-report-k6-task-read
→ generated k6 HTML report

performance-report-lighthouse
→ Lighthouse HTML / JSON execution evidence

performance-report-playwright
→ authenticated browser-performance Playwright report
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
- use domain database clients for direct persistence validation;
- contain HTTP and business assertions;
- validate successful API responses against runtime schemas;
- contain native screenshot assertions for visual contracts;
- avoid duplicating framework infrastructure.

Specs should not become containers for reusable setup logic, raw locator implementation, repeated HTTP mechanics, or raw database connection management.

Visual specs may contain explicit deterministic setup when the setup is scenario-specific and does not justify a new abstraction.

### Fixtures

Fixtures compose framework dependencies and manage reusable setup, state, and lifecycle.

Typical responsibilities include:

- constructing Page Objects and Component Objects;
- constructing API clients;
- constructing database clients;
- generating test users;
- registering or authenticating users;
- creating reusable domain prerequisites;
- creating authenticated browser contexts;
- managing database connection lifecycle;
- cleaning up owned resources when required.

Fixture dependencies should represent the actual setup flow.

A fixture should not be introduced merely to hide a single line of code. It should provide meaningful reuse, lifecycle management, state composition, or dependency management.

The database fixture owns creation and closure of the shared database transport for a test and prevents direct database execution outside the supported `localDocker` environment.

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

### Database Clients

Database clients provide focused access to persisted application state for database validation.

The infrastructure boundary is:

```text
Domain Database Client
        ↓
DatabaseClient
        ↓
PostgreSQL / Neon
```

`DatabaseClient` owns PostgreSQL transport and connection pooling.

Domain database clients own domain-specific queries and map persisted records into typed database records.

Current domain ownership includes:

```text
UserDatabaseClient
→ user persistence queries

TaskDatabaseClient
→ task persistence queries
```

Database clients do not own test assertions.

Specs remain responsible for comparing persisted state with the behavior or data that produced it.

Raw SQL should remain inside the database layer rather than being scattered through test specs.

The database layer is intentionally focused on validation requirements demonstrated by the test suite. A repository or service layer should not be introduced merely to add structural symmetry with application architecture.

### Database Reset

The dedicated Neon database is a disposable test-owned environment. Normal test execution intentionally does not perform automatic database cleanup.

```text
normal test execution
→ preserve resulting state
→ retain evidence for debugging
```

Database restoration is an explicit administrative operation:

```text
explicit reset request
        ↓
environment validation
        ↓
explicit destructive confirmation
        ↓
Docker availability validation
        ↓
reset public schema
        ↓
UPEX db:push
        ↓
UPEX db:seed
        ↓
baseline verification
```

The reset utility is owned by:

```text
framework/core/database/resetTestDatabase.ts
```

and is exposed through the framework package command:

```text
npm run db:test:reset
```

The reset operation is intentionally destructive and must execute only against the dedicated `localDocker` test-database boundary.

It requires explicit environment and confirmation guards before schema destruction is allowed.

Application schema and baseline seed ownership remain with UPEX. The framework orchestrates the reset but does not duplicate the application's schema definition or seed implementation.

The current UPEX source owns schema restoration through:

```text
db:push
```

and baseline restoration through:

```text
db:seed
```

Post-reset verification confirms that the expected protected baseline users exist and that their seeded task state has been restored.

This reset model replaces per-test deletion for the dedicated disposable database. It preserves failed or completed test state for investigation while still providing a deterministic path back to the application-owned baseline.

The database validation architecture, test-data lifecycle, and destructive reset decision are documented in:

```text
framework/docs/adr/ADR-005-database-validation-and-test-data-lifecycle.md
```

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

Performance testing separates API workload performance from browser-observed performance according to their measurement responsibilities.

````text
API performance
→ k6
→ controlled HTTP workload generation

Browser performance
→ Lighthouse
├── standalone LHCI
└── authenticated Playwright + Lighthouse

The current baseline measures authenticated task reads:

```text
setup
├── register performance user
└── authenticate performance user
        ↓
measured workload
└── GET /tasks
````

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

### Browser Performance Architecture

Browser performance uses Lighthouse through two complementary execution paths:

```text
standalone LHCI
→ configured public application URL
→ repeated Lighthouse collection
→ shared Lighthouse threshold policy

authenticated Playwright + Lighthouse
→ existing fixture initialization
→ authenticated user
→ deterministic task state
→ representative dashboard state
→ 3 independent Lighthouse measurements
→ median metric aggregation
→ shared Lighthouse threshold policy
```

Authenticated Lighthouse execution evaluates the shared quality policy against median metrics from three independent measurements. Aggregation belongs to the Lighthouse measurement layer rather than the scenario spec, keeping Playwright responsible only for deterministic application-state orchestration.

The authenticated path reuses existing deterministic business-state initialization rather than creating Lighthouse-specific setup. Playwright owns scenario and browser-state orchestration; Lighthouse owns performance measurement.

The Lighthouse quality policy is shared because both standalone LHCI and authenticated Lighthouse execution consume the same browser-performance thresholds and severities:

```text
lighthouseThresholds.json
├── LHCI native assertions
└── Playwright-side Lighthouse policy evaluation
```

Measurement, policy evaluation, and execution evidence remain separate responsibilities:

```text
LighthouseRunner
→ measurement

Lighthouse policy
→ threshold and severity evaluation

Lighthouse reporter
→ execution evidence and warning presentation

performance spec
→ scenario orchestration
```

This shared policy is specific to Lighthouse's multiple consumers. k6 retains its native workload thresholds rather than introducing a framework-wide performance policy abstraction solely for structural symmetry.

## AI-Assisted QA Architecture

The framework has no AI provider integration of its own. AI assistance is AI-assisted engineering by coding agents (GitHub Copilot, Claude Code and others) that follow `AGENTS.md`. Failure analysis uses Playwright's own evidence (error context, screenshots, traces, videos) through the same agents.

AI-assisted engineering follows this boundary:

```text
repository instructions
+ architecture
+ testing standards
+ Golden Templates
+ authoritative external evidence where applicable
        ↓
AI engineering proposal
        ↓
human review
        ↓
approved implementation
        ↓
deterministic validation
        ↓
human approval
```

Authoritative external evidence may include:

```text
OpenAPI MCP
→ provider contract discovery

Playwright MCP
→ runtime browser evidence
```

External evidence does not override repository architecture.

Repository standards and validated Golden Templates determine implementation ownership and structure.

The standard AI-assisted engineering sequence is:

```text
proposal
→ human review
→ targeted feedback
→ implementation
→ deterministic validation
→ human approval
```

AI agents must not weaken assertions, alter baselines, invent provider behavior, bypass architectural ownership, or treat generated output as validation evidence merely to obtain a passing result.

For the complete workflow, validated capability status, prompt-engineering rules, evidence boundaries, and documented limitations, see [`AI_ASSISTED_QA_WORKFLOW.md`](AI_ASSISTED_QA_WORKFLOW.md).

## Execution Boundary Rules

Test placement and Playwright project ownership must remain aligned.

Use:

```text
tests/api/**
→ API project

tests/database/**
→ database project
→ localDocker execution

tests/accessibility/**
→ accessibility project

tests/visual/**
→ visual project

tests/ui/**
→ browser projects

tests/smoke/**
→ browser projects

tests/performance/**
→ performance Playwright project
→ browser performance orchestration

tests/performance/k6/**
→ k6 performance runtime

framework/core/performance/lighthouse/**
→ Lighthouse execution, policy, and reporting infrastructure
```

Do not place browser-dependent behavior under the API suite.

Do not place browser-independent API contract tests under UI or smoke suites merely to force execution through browser projects.

Database validation should remain under the dedicated database project rather than being mixed into API or UI specs. Application behavior may be created through an API client or fixture, but direct persistence queries belong to the database layer and persistence assertions remain in the database spec.

Database validation must use the dedicated `localDocker` test environment and must not be redirected to the shared hosted environment.

Accessibility tests should remain under the dedicated accessibility project rather than being added to the standard UI browser matrix solely for structural symmetry.

Visual regression tests should remain under the dedicated visual project rather than being multiplied across the standard UI browser matrix solely for structural symmetry.

The current visual project executes once through Chromium in the canonical Docker/Linux runtime.

Browser-specific visual projects or baselines should be introduced only when a concrete browser-specific requirement demonstrates a materially different visual risk.

API performance workloads should remain under the dedicated k6 execution boundary rather than being introduced as Playwright projects solely to reuse the existing test-runner structure.

Browser performance scenarios may use the dedicated performance Playwright project when Playwright-owned fixtures, Page Objects, or authenticated browser state are required to establish the representative state measured by Lighthouse.

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
