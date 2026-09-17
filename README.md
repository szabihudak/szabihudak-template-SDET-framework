# Playwright Enterprise Framework

[![Playwright](https://img.shields.io/badge/Playwright-1.62.1-2EAD33?logo=playwright)](https://playwright.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-7.x-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![k6](https://img.shields.io/badge/k6-Performance-7D64FF?logo=k6&logoColor=white)](https://k6.io/)
[![axe-core](https://img.shields.io/badge/axe--core-Accessibility-5C2D91)](https://github.com/dequelabs/axe-core)
[![Visual Regression](https://img.shields.io/badge/Visual-Regression-FF6F00)](https://playwright.dev/docs/test-snapshots)
[![Docker](https://img.shields.io/badge/Docker-containerized-2496ED?logo=docker&logoColor=white)](https://www.docker.com/)
[![GHCR](https://img.shields.io/badge/GHCR-Container%20Registry-181717?logo=github&logoColor=white)](https://ghcr.io/)
[![CI](https://github.com/szabihudak/playwright-enterprise-framework-private/actions/workflows/playwright.yml/badge.svg)](https://github.com/szabihudak/playwright-enterprise-framework-private/actions/workflows/playwright.yml)

A production-oriented **Playwright + TypeScript test automation framework** demonstrating scalable Quality Engineering practices across API, browser, contract, automated accessibility, visual regression, and API performance testing.

The framework is designed around the concerns that matter in real automation systems: **maintainability, reproducibility, execution ownership, runtime contract validation, deterministic test setup, CI efficiency, accessibility quality signals, visual regression signals, performance quality signals, and failure diagnostics**.

## Engineering Capabilities

| Area                  | Implementation                                                                   |
| --------------------- | -------------------------------------------------------------------------------- |
| API Testing           | Browser-independent Playwright API tests with domain-specific clients            |
| Contract Testing      | TypeBox schemas with AJV runtime validation                                      |
| UI Automation         | Page Objects, Component Objects, fixtures, and network mocking                   |
| Accessibility Testing | Axe-based automated WCAG 2.2 AA checks with dedicated Playwright execution       |
| Visual Regression     | Native Playwright page and component screenshot baseline comparison              |
| Performance Testing   | k6 API workload with workload-specific metrics and calibrated thresholds         |
| Authentication        | Programmatic API and browser authentication                                      |
| Test Data             | Deterministic factories with scenario-specific overrides                         |
| Cross-Browser         | Chromium, Firefox, and WebKit execution                                          |
| Containerization      | Reproducible Playwright execution with Docker                                    |
| CI/CD                 | GitHub Actions with Playwright quality gates and dedicated performance execution |
| Diagnostics           | Playwright diagnostics and k6 HTML performance reports preserved as CI evidence  |
| Engineering Standards | Architecture documentation, testing standards, and ADRs                          |

## Architecture at a Glance

```mermaid
flowchart TD
    A[Playwright Test Suite]
    PERF[k6 Performance Workload]

    A --> B[API Testing]
    A --> C[UI Testing]
    A --> D[Accessibility Testing]
    A --> E[Visual Regression Testing]

    B --> F[Domain API Clients]
    F --> G[TypeBox Schemas]
    G --> H[AJV Runtime Validation]

    C --> I[Page Objects / Component Objects]
    I --> J[Playwright Fixtures]
    J --> K[Programmatic Authentication]

    D --> L[AccessibilityScanner]
    L --> M[Central WCAG Policy]
    M --> N[Axe Analysis]

    E --> O[Native Screenshot Assertions]
    O --> P[Versioned Baselines]

    H --> Q[Test Infrastructure]
    K --> Q
    N --> Q
    P --> Q

    Q --> R[Docker]
    Q --> S[GitHub Actions]

    PERF --> R
    PERF --> S

    R --> T[Reproducible Runtime]
    R --> U[Runtime TEST_ENV]
    R --> V[Ephemeral Containers]

    S --> W[Quality Gates]
    S --> X[Single Image Build]
    X --> Y[API Project]
    X --> Z[Accessibility Project]
    X --> AA[Visual Project]
    X --> AB[UI Browser Matrix]

    AB --> AC[Chromium]
    AB --> AD[Firefox]
    AB --> AE[WebKit]

    S --> AF[Test Reports & Failure Diagnostics]
```

## Engineering Approach

This repository is intentionally developed as an **automation engineering system rather than a collection of automated tests**.

The framework favors:

- explicit responsibility boundaries;
- reusable but focused abstractions;
- runtime validation instead of trusting compile-time types alone;
- API-driven setup where browser interaction is not the behavior under test;
- deterministic and isolated test data;
- reproducible execution across local and CI environments;
- build-once, configure-at-runtime container execution;
- explicit CI ownership between Playwright test execution and performance workloads;
- actionable diagnostics when execution fails;
- documented architectural decisions and trade-offs.

New capabilities are introduced only when they demonstrate a real testing or architectural requirement.

> **Project status:** Active development. The current foundation includes API/UI automation, contract validation, programmatic authentication, automated WCAG accessibility testing, native Playwright visual regression testing, k6 API performance testing, Dockerized execution, cross-browser testing, and GitHub Actions CI. Additional Quality Engineering capabilities are introduced incrementally as the framework evolves.

## Quick Navigation

- [Architecture](docs/ARCHITECTURE.md)
- [Testing Standards](docs/TESTING_STANDARDS.md)
- [Framework Requirements](docs/FRAMEWORK_REQUIREMENTS.md)
- [Architecture Decision Records](docs/adr/)
- [Performance Testing](#performance-testing)
- [Docker Execution](#docker-execution)
- [CI Pipeline](#ci-pipeline)
- [Running Locally](#running-locally)

## Technology Stack

| Area                      | Technology                    |
| ------------------------- | ----------------------------- |
| Test Framework            | Playwright                    |
| Language                  | TypeScript                    |
| API Testing               | Playwright APIRequestContext  |
| Runtime Schema Validation | TypeBox + AJV                 |
| UI Automation             | Playwright Browser Automation |
| Accessibility Testing     | @axe-core/playwright          |
| Visual Regression         | Playwright Screenshot Testing |
| Performance Testing       | k6                            |
| Containerization          | Docker                        |
| Container Registry        | GitHub Container Registry     |
| CI/CD                     | GitHub Actions                |
| Formatting                | Prettier                      |
| Target Application        | UPEX DOJO                     |

## Architecture

The framework separates test behavior from reusable infrastructure.

### API flow

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
  ├── Static<T> → compile-time type
  └── AJV → runtime validation
  ↓
HTTP assertion
  ↓
Schema validation
  ↓
Business assertions
```

Successful provider responses are validated at runtime before their data is trusted by the test.

### UI flow

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

API and programmatic setup are used where appropriate to keep UI tests focused on the browser behavior being verified.

### Accessibility flow

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

Automated accessibility checks use the framework's central WCAG 2.2 Level AA policy and intentionally fail when configured axe rules report violations.

Automated axe coverage provides a quality signal for supported automated rules; it does not replace manual accessibility testing or prove complete WCAG conformance.

### Visual regression flow

```text
Deterministic test state
  ↓
Page Object / Component locator
  ↓
Native Playwright screenshot assertion
  ↓
Version-controlled approved baseline
  ↓
Visual comparison
```

Visual regression coverage uses native Playwright screenshot assertions for representative page-level and component-level visual contracts.

Approved baselines are generated and reviewed in the canonical Docker/Linux runtime, stored with the visual specs, and version-controlled with the framework. CI compares current rendering against committed baselines and does not automatically update them.

Detailed baseline creation, review, and update rules are defined in [`docs/TESTING_STANDARDS.md`](docs/TESTING_STANDARDS.md).

### Performance flow

```text
k6 setup
  ↓
API authentication
  ↓
Authenticated task-read workload
  ↓
Workload-specific metrics
  ↓
Performance thresholds
  ↓
PASS / FAIL
```

The current k6 baseline measures authenticated task-read behavior with a controlled `2 VU / 30s` workload.

The measured operation owns dedicated `task_read_duration` and `task_read_failures` metrics so setup traffic does not contaminate its performance quality gate.

Current calibrated thresholds are:

```text
task_read_duration
→ p(95) < 500 ms

task_read_failures
→ rate < 1%
```

For the complete architectural rules, see [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

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
  api/
  ui/
  smoke/
  regression/
  accessibility/
  visual/
  security/

.github/
  workflows/
```

Some directories represent planned framework capabilities and will be populated as those capabilities are introduced.

## API Testing

API tests are implemented as browser-independent Playwright tests.

The framework uses a schema-first contract strategy:

```text
HTTP response
    ↓
status assertion
    ↓
parse response
    ↓
runtime schema validation
    ↓
typed business assertions
```

TypeBox schemas provide both compile-time TypeScript types and runtime contracts validated through AJV.

This prevents provider responses from being trusted through TypeScript casting alone.

API clients remain responsible for HTTP interaction, while assertions remain in the test layer.

## UI Testing

UI automation follows Page Object and Component Object boundaries.

Page Objects represent page-level behavior, while Component Objects encapsulate reusable UI regions.

Authentication setup is separated from the behavior under test. Protected UI scenarios use a programmatically authenticated browser context rather than repeating UI login unless login itself is the scenario being tested.

Locator scope follows the actual application DOM, including support for portal-rendered UI elements.

## Accessibility Testing

Automated accessibility testing uses `@axe-core/playwright` through a reusable `AccessibilityScanner`.

The current framework policy targets automated WCAG 2.2 Level AA coverage through a centralized set of axe rule tags.

Accessibility assertions remain in specs, while diagnostic formatting is separated from pass/fail logic.

Representative golden coverage includes both:

```text
public page
→ standard page context
→ accessibility fixture

authenticated page
→ authenticatedPage context
→ authenticatedAccessibility fixture
```

The dedicated accessibility Playwright project currently executes through Chromium once rather than duplicating the same accessibility suite across the full browser matrix.

Real accessibility violations remain failing quality signals. The framework does not suppress violations or use `continue-on-error` merely to keep CI green.

Automated axe analysis does not replace manual accessibility testing for requirements that cannot be reliably automated.

## Visual Regression Testing

Visual regression testing uses Playwright's native screenshot assertions rather than introducing a separate visual-testing abstraction.

The current golden coverage includes:

```text
authenticated dashboard
→ page-level visual contract

deterministic task card
→ component-level visual contract
```

Visual scenarios use deterministic API-driven setup and existing Page Object or locator ownership before screenshot comparison.

The dedicated `visual` Playwright project currently executes through Chromium in the canonical Docker/Linux runtime. Visual coverage is not duplicated across Firefox and WebKit unless a concrete cross-browser visual risk justifies additional browser-specific baselines.

Approved screenshot baselines are stored alongside the visual specs under Playwright-managed snapshot directories and are committed to Git.

Baseline creation and updates are explicit review operations. CI performs comparison against committed baselines and never automatically approves rendering changes through `--update-snapshots`.

For the complete baseline lifecycle and visual testing rules, see [`docs/TESTING_STANDARDS.md`](docs/TESTING_STANDARDS.md).

## Performance Testing

API performance testing uses k6 through a runtime boundary separate from Playwright.

The current baseline exercises authenticated task reads against the UPEX DOJO API without creating task data during the measured workload.

k6 setup registers and authenticates a performance user, then creates a dedicated task outside the measured workload. The authenticated state is reused during execution.

k6 teardown deletes the dedicated task after the workload completes. The generated performance user remains because the target application does not expose a supported account-deletion endpoint.

Current workload:

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

The workload is deliberately small because the hosted UPEX DOJO environment is shared infrastructure. It is a controlled performance baseline rather than a stress, spike, soak, or capacity test.

Performance quality is evaluated through workload-specific metrics:

```text
task_read_duration
→ p(95) < 500 ms

task_read_failures
→ rate < 1%
```

The thresholds were introduced after repeated baseline calibration rather than being selected as arbitrary SLA values.

Threshold failure produces a non-zero k6 exit code.

The performance run also generates:

```text
performance-results/task-read-load.html
```

as human-readable execution evidence.

## Authentication

The target application exposes separate API and browser authentication mechanisms:

```text
API authentication
→ Bearer JWT

Browser authentication
→ Auth.js session
```

The framework preserves this distinction through explicit fixture states:

```text
testUserData
→ generated only

registeredTestUser
→ registered through API

authenticatedTestUser
→ registered + API authenticated

authenticatedPage
→ programmatically authenticated browser context
```

This keeps setup fast while preserving correct authentication boundaries.

## Test Data

Reusable test data is generated through domain factories.

Factories provide valid defaults with explicit overrides:

```text
valid defaults
+
scenario overrides
=
test-specific data
```

Negative tests can intentionally generate partial or invalid payloads when required.

Factories remain independent from HTTP execution, UI interaction, assertions, and fixture lifecycle.

## Docker Execution

Docker provides reproducible execution environments while preserving runtime ownership between Playwright test execution and k6 performance testing.

The test image is built from the official Playwright image matching the framework's installed Playwright version:

```text
mcr.microsoft.com/playwright:v1.62.1-noble
```

The image contains the Linux runtime and browser dependencies required for Playwright execution, while project dependencies are installed reproducibly through:

```text
npm ci
```

This Playwright image owns Playwright-based API, accessibility, visual, and browser execution. Performance testing runs separately through the pinned k6 Docker image rather than extending the Playwright image with k6.

The framework's Playwright image follows:

```text
build once
→ configure at runtime
```

Target environment selection is therefore not baked into the Playwright image.

For example:

```bash
docker run --rm \
  -e TEST_ENV=hosted \
  playwright-enterprise-tests
```

The same image can execute a specific Playwright project by overriding the default container command:

```bash
docker run --rm \
  -e TEST_ENV=hosted \
  playwright-enterprise-tests \
  npx playwright test --project=api
```

This keeps the container image reusable rather than creating separate images for API, accessibility, visual, and browser projects.

### Container Lifecycle

Test containers are treated as ephemeral execution environments.

```text
Docker image
    ↓
container starts
    ↓
Playwright executes
    ↓
process returns exit code
    ↓
container stops
    ↓
container removed
```

`--rm` removes the stopped container automatically after execution.

The container exit code represents the test-process result and can therefore be consumed by the calling execution environment.

### Docker Artifacts

Container filesystems are ephemeral, so test outputs that must survive container removal are persisted outside the container lifecycle.

For local Docker execution, Playwright reports and test results can be bind-mounted to the host:

```bash
docker run --rm \
  -e TEST_ENV=hosted \
  -v "$(pwd)/playwright-report:/app/playwright-report" \
  -v "$(pwd)/test-results:/app/test-results" \
  playwright-enterprise-tests
```

This preserves:

```text
playwright-report/
test-results/
```

on the host even after the container is removed.

Local Docker artifact persistence and CI artifact upload are separate concerns. GitHub Actions continues to preserve CI execution evidence through its artifact upload strategy.

## CI Pipeline

GitHub Actions provides automated quality validation and containerized test execution.

Current execution architecture:

```text
quality
├── Prettier
└── TypeScript typecheck
        ↓
build-image
├── docker build once
├── image tag = github.sha
└── push to GitHub Container Registry
        ↓
        ├── api
        │   └── pull same SHA image → --project=api
        │
        ├── accessibility
        │   └── pull same SHA image → --project=accessibility
        │
        ├── visual
        │   └── pull same SHA image → --project=visual
        │
        └── ui matrix
            ├── pull same SHA image → chromium
            ├── pull same SHA image → firefox
            └── pull same SHA image → webkit
```

The quality gate currently validates:

```text
Prettier
→ TypeScript typecheck
```

After quality validation succeeds, CI builds the reusable Playwright test image once.

The image is tagged with the current commit SHA, published to GitHub Container Registry, and reused by the API, accessibility, visual, and UI jobs.

API tests execute once because they are browser-independent.

Accessibility tests execute once through the dedicated Chromium-based accessibility project.

Visual regression tests execute once through the dedicated Chromium-based visual project and compare current rendering against committed baselines without updating them.

UI and smoke tests execute through browser-specific Playwright projects using a GitHub Actions matrix.

The API, accessibility, visual, and UI jobs pull and execute the same previously built SHA-tagged Docker image rather than installing project dependencies or Playwright browsers independently on their runners.

Test containers are ephemeral and execute with `--rm`.

Playwright report and test-result directories are bind-mounted from the containers to the GitHub Actions runners so CI can upload them as workflow artifacts after container execution.

Executable Playwright images are distributed through GitHub Container Registry; GitHub Actions artifacts remain reserved for reports and failure diagnostics.

### Performance CI

Performance execution is owned by the separate:

```text
.github/workflows/performance.yml
```

workflow.

The current hosted performance baseline is intentionally triggered through:

```text
workflow_dispatch
```

rather than normal pull-request execution.

The workflow resolves the selected `TEST_ENV` through the shared environment configuration, runs the pinned k6 Docker runtime, enforces the performance thresholds, and preserves the generated HTML report as a CI artifact.

## Playwright Projects

The current project ownership is:

```text
api
→ tests/api/**

accessibility
→ tests/accessibility/**
→ Chromium

visual
→ tests/visual/**
→ Chromium

chromium
firefox
webkit
→ tests/ui/**
→ tests/smoke/**
```

This prevents HTTP-only API tests from being redundantly executed once per browser, keeps automated accessibility and visual regression execution explicit and non-duplicated, and preserves cross-browser coverage where browser behavior matters.

## Reports and Diagnostics

CI preserves execution evidence through Playwright artifacts.

```text
HTML report
→ uploaded for every test execution

Failure diagnostics
→ uploaded when execution fails
```

Artifacts are separated by execution responsibility and browser so failures remain attributable to the correct job.

Accessibility CI evidence is preserved separately through:

```text
playwright-report-accessibility
test-results-accessibility
```

Visual regression CI evidence is preserved separately through:

```text
playwright-report-visual
test-results-visual
```

Playwright is configured to retain additional diagnostics for failed or retried execution, including screenshots, video, and traces according to the configured policy.

Docker-based local execution can preserve the same generated Playwright output directories through bind mounts, independently of CI artifact handling.

Performance CI preserves the generated k6 HTML report separately as:

```text
performance-report-task-read
```

## Environment Configuration

The framework supports explicit target environments through `TEST_ENV`.

Current environment definitions include:

```text
hosted
local
ci
```

Environment URLs are defined in:

```text
config/environments/environments.json
```

The TypeScript environment adapter consumes the same configuration through:

```text
config/environments/environment.ts
```

The GitHub Actions workflows explicitly target:

```text
TEST_ENV=hosted
```

Docker execution can select the same target at container runtime:

```text
docker run -e TEST_ENV=hosted ...
```

The performance workflow resolves the selected environment's `apiBaseUrl` from the shared JSON configuration and supplies it to k6 as `TARGET_BASE_URL`.

The execution environment and test target environment are intentionally treated as separate concepts.

For example:

```text
execution environment
→ local machine
→ Docker container
→ GitHub Actions runner

test target environment
→ selected through TEST_ENV
```

## Running Locally

Install dependencies:

```bash
npm ci
```

Install Playwright browsers:

```bash
npx playwright install
```

Run the complete configured test suite:

```bash
npm test
```

Run API tests only:

```bash
npx playwright test --project=api
```

Run accessibility tests only:

```bash
npx playwright test --project=accessibility
```

Run visual tests only:

```bash
npx playwright test --project=visual
```

Run a browser project:

```bash
npx playwright test --project=chromium
```

Run formatting validation:

```bash
npx prettier --check .
```

Run TypeScript validation:

```bash
npm run typecheck
```

### Running with Docker

Build the reusable Playwright test image:

```bash
docker build -t playwright-enterprise-tests .
```

Run the complete configured suite against the hosted target:

```bash
docker run --rm \
  -e TEST_ENV=hosted \
  playwright-enterprise-tests
```

Run only the API project:

```bash
docker run --rm \
  -e TEST_ENV=hosted \
  playwright-enterprise-tests \
  npx playwright test --project=api
```

Run only the accessibility project:

```bash
docker run --rm \
  -e TEST_ENV=hosted \
  playwright-enterprise-tests \
  npx playwright test --project=accessibility
```

Run only the visual project against the committed baselines:

```bash
docker run --rm \
  -e TEST_ENV=hosted \
  -v "$(pwd)/playwright-report:/app/playwright-report" \
  -v "$(pwd)/test-results:/app/test-results" \
  playwright-enterprise-tests \
  npx playwright test --project=visual
```

Run the complete suite while preserving reports and test results on the host:

```bash
docker run --rm \
  -e TEST_ENV=hosted \
  -v "$(pwd)/playwright-report:/app/playwright-report" \
  -v "$(pwd)/test-results:/app/test-results" \
  playwright-enterprise-tests
```

### Running Performance Tests with Docker

Resolve the hosted API URL from the shared environment configuration:

```bash
TARGET_BASE_URL=$(node -e "
  const environments = require('./config/environments/environments.json');
  process.stdout.write(environments.hosted.apiBaseUrl);
")
```

Create the report directory:

```bash
mkdir -p performance-results
```

Run the current performance baseline:

```bash
docker run --rm \
  --user "$(id -u):$(id -g)" \
  -e TARGET_BASE_URL="$TARGET_BASE_URL" \
  -e K6_WEB_DASHBOARD=true \
  -e K6_WEB_DASHBOARD_PORT=-1 \
  -e K6_WEB_DASHBOARD_EXPORT=/reports/task-read-load.html \
  -v "$PWD/performance/k6:/scripts" \
  -v "$PWD/performance-results:/reports" \
  grafana/k6:1.8.1 \
  run /scripts/taskReadLoad.js
```

The HTML report is written to:

```text
performance-results/task-read-load.html
```

## Engineering Standards

The repository contains explicit architecture and implementation standards.

Before making framework changes, contributors should read:

- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)
- [`docs/TESTING_STANDARDS.md`](docs/TESTING_STANDARDS.md)
- [`AGENTS.md`](AGENTS.md)
- relevant Architecture Decision Records under [`docs/adr/`](docs/adr/)

The framework follows a simple extension rule:

```text
reuse
→ extend
→ create
```

New abstractions are introduced only when demonstrated responsibility, reuse, or complexity justifies them.

## AI-Assisted Development

The repository is structured to support AI-assisted engineering without allowing generated code to define the architecture.

AI coding agents are instructed to:

- inspect existing implementations before generating code;
- follow documented architectural boundaries;
- use equivalent implementations as golden references;
- reuse or extend existing abstractions before creating new ones;
- preserve schema-first API contracts;
- preserve authentication and fixture boundaries;
- select the correct Playwright execution project;
- reuse the established accessibility scanner, WCAG policy, fixtures, formatter, and assertion pattern for accessibility coverage;
- preserve deterministic visual setup, existing Page Object or locator ownership, and the established baseline policy for visual regression coverage;
- preserve the separate k6 performance runtime boundary, controlled workload design, workload-specific metrics, and calibrated threshold policy for performance coverage;
- validate formatting, types, and affected tests before completion.

Repository-level agent behavior is defined in [`AGENTS.md`](AGENTS.md), with GitHub Copilot-specific instructions in [`.github/copilot-instructions.md`](.github/copilot-instructions.md).

Architecture drives generated code, not the other way around.

## Target Application

The framework currently tests **UPEX DOJO**, a full-stack application exposing both browser workflows and REST APIs.

The target provides realistic scenarios for:

- user registration and authentication;
- authenticated browser sessions;
- task management;
- API contract testing;
- API/UI integration;
- automated accessibility testing;
- visual regression testing;
- controlled API performance baseline testing;
- negative testing;
- controlled network failure scenarios.

The framework treats the target application as an external provider and models observed runtime behavior rather than assuming undocumented contracts.

## Project Status

Current implemented foundation:

```text
Framework architecture         ✅
Reusable fixtures              ✅
Test-data factories            ✅
API automation                 ✅
API authentication             ✅
Runtime contract validation    ✅
API/UI integration             ✅
Network mocking                ✅
Page/Component architecture    ✅
Programmatic browser auth      ✅
Cross-browser execution        ✅
Automated accessibility        ✅
WCAG policy                    ✅
Accessibility CI gate          ✅
Visual regression testing      ✅
Versioned visual baselines     ✅
Visual CI gate                 ✅
k6 performance testing         ✅
Performance quality thresholds ✅
Performance HTML reporting     ✅
Dedicated performance CI       ✅
Shared environment config      ✅
Docker test execution          ✅
Runtime container config       ✅
Container artifact persistence ✅
GitHub Actions CI              ✅
GHCR image distribution        ✅
CI quality gates               ✅
CI artifacts                   ✅
Browser matrix execution       ✅
Agent engineering standards    ✅
```

Additional Quality Engineering capabilities will be introduced as the framework evolves.

## Design Philosophy

The goal of this repository is not to maximize abstraction or demonstrate the largest possible number of tools.

The framework favors:

- explicit responsibility boundaries;
- type safety;
- runtime validation;
- reusable but focused abstractions;
- deterministic setup;
- reproducible execution;
- maintainable test structure;
- efficient CI execution;
- meaningful diagnostics;
- documented architectural decisions.

A passing test is necessary, but maintainability, reliability, reproducibility, and architectural consistency are part of the definition of quality.
