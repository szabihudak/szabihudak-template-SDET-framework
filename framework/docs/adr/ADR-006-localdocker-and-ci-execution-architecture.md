# ADR-006: LocalDocker and CI Execution Architecture

## Status

Accepted

Amended by ADR-007: the quality job also runs the architecture rules, the golden template check and the framework unit tests, with a 10-minute ceiling, and a `template-selftest` job verifies `npm run setup`. `TEST_ENV` is required; there is no default environment.

---

## Context

The framework originally treated Docker primarily as a reproducible Playwright execution environment.

As the platform evolved, this became insufficient.

The functional test suite now requires a reproducible application-under-test runtime in addition to the reusable Playwright test runtime.

The framework must support:

- native developer execution against a local application;
- containerized local execution;
- browser-independent API tests;
- direct database validation;
- accessibility testing;
- visual regression;
- browser-matrix UI execution;
- reproducible CI execution;
- immutable execution artifacts;
- explicit application and test-runtime ownership;
- environment-specific runtime configuration;
- durable diagnostics outside ephemeral containers.

The active target application, UPEX DOJO, is maintained in a separate source repository.

The framework must therefore define how that external application source is built and executed for local and CI validation without duplicating application ownership.

The system also uses a dedicated Neon PostgreSQL test database rather than a local PostgreSQL container.

Performance execution has separate runtime requirements and should not be forced into the same execution model as functional Playwright testing.

---

## Decision

Adopt `localDocker` as the canonical reproducible functional execution environment for containerized local execution and the main Playwright CI workflow.

The functional topology is:

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

The test container also receives `DATABASE_URL` when direct persistence validation is required.

The UPEX application and Playwright framework use separate Docker images because they represent separate runtime and ownership responsibilities.

---

## Execution Environments

The framework distinguishes target environment selection from execution context.

### Native Local Execution

```text
TEST_ENV=local
→ Playwright runs on the developer machine
→ application target = http://localhost:3000
```

This mode is useful for fast developer-native execution when UPEX is already running locally.

### Containerized Local Execution

```text
TEST_ENV=localDocker
→ Docker Compose
→ UPEX application container
→ Playwright test container
→ application target = http://upex-local:3000
```

Inside the Playwright container, `localhost` refers to the test container itself.

The UPEX application is therefore accessed through the Docker Compose network alias:

```text
upex-local
```

### Hosted Execution

```text
TEST_ENV=hosted
→ deployed UPEX application
```

Hosted execution remains available for capabilities that intentionally target the deployed application.

The main functional CI workflow does not use the hosted application.

### Performance Execution

Performance execution remains separate and targets the hosted application through the dedicated performance workflow.

```text
functional Playwright CI
→ localDocker

performance workflow
→ hosted
```

---

## Application Runtime Ownership

The UPEX application source remains owned by:

```text
upex-galaxy/upex-dojo
```

The framework owns the reproducible application-under-test runtime required for test execution.

That runtime is defined by:

```text
Dockerfile.upex-local
docker-compose.yml
docker-compose.local.yml
```

`Dockerfile.upex-local` builds UPEX from the external source repository.

The local Compose override provides UPEX source through an additional Docker build context:

```text
framework repository
→ Dockerfile.upex-local

../upex-dojo
→ additional build context
→ UPEX application source
```

This preserves source ownership while allowing the framework to control its test execution environment.

---

## Separate Image Responsibilities

The functional system uses two primary images.

### Playwright Test Image

Built from:

```text
Dockerfile
```

Responsibilities:

- Node/npm runtime;
- Playwright framework source;
- Playwright browser binaries;
- test dependencies;
- API, database, accessibility, visual, and UI execution.

The Playwright image does not own the application runtime.

### UPEX Application Image

Built from:

```text
Dockerfile.upex-local
```

Responsibilities:

- UPEX source;
- UPEX production build;
- UPEX application runtime;
- application-owned database schema and seed commands.

The UPEX image does not own Playwright test execution.

---

## Build Once / Run Many

The Playwright image is intentionally reusable across Playwright projects.

```text
one Playwright image
        ↓
        ├── api
        ├── database
        ├── accessibility
        ├── visual
        ├── chromium
        ├── firefox
        └── webkit
```

Separate images must not be created merely because Playwright has separate projects.

Project responsibility remains a Playwright configuration concern.

Docker provides the execution environment.

---

## Docker Compose Ownership

`docker-compose.yml` defines the shared functional runtime contract.

It contains:

```text
app
→ UPEX application image

tests
→ Playwright test image
```

The application service:

- receives `DATABASE_URL`;
- receives runtime authentication configuration;
- exposes port 3000 for native host access;
- uses the `upex-local` network alias;
- exposes a health check;
- runs in production mode.

The test service:

- receives `TEST_ENV=localDocker`;
- receives `DATABASE_URL`;
- waits for application readiness;
- persists reports and test results through bind mounts.

`docker-compose.local.yml` provides local-build overrides for both images.

---

## Database Topology

The current functional Docker architecture does not include PostgreSQL as a Compose service.

The database topology is:

```text
UPEX application container
        │
        └── dedicated Neon PostgreSQL

Playwright database tests
        │
        └── dedicated Neon PostgreSQL
```

This decision keeps the database runtime aligned with the current application environment while still isolating functional validation from the shared hosted application.

Database lifecycle decisions are documented separately in ADR-005.

---

## CI Architecture

The main Playwright CI workflow uses GitHub Actions.

The dependency model is:

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

The `quality` job performs static validation before image construction.

Current validation includes:

```text
npm ci
Prettier check
TypeScript typecheck
```

The `build-images` job builds and publishes both functional images.

Downstream test jobs pull immutable image versions and execute through Docker Compose.

---

## Immutable Image Identity

The Playwright test image is tagged with the framework commit SHA:

```text
playwright-enterprise-tests:${github.sha}
```

The UPEX image is tagged with the exact resolved UPEX source commit SHA.

```text
upex-local:${UPEX_SHA}
```

This produces two independently traceable identities:

```text
framework commit
→ Playwright image

UPEX source commit
→ UPEX application image
```

Downstream jobs consume those exact versions.

This prevents individual test jobs from rebuilding source independently and ensures consistent execution within a workflow run.

---

## UPEX Source Resolution

CI checks out the configured UPEX target branch:

```text
UPEX_REF=staging
```

The workflow resolves the exact UPEX commit:

```text
git rev-parse HEAD
```

The resulting commit SHA becomes the UPEX image identity.

This means the functional test result can be traced to both:

- the exact framework revision;
- the exact UPEX source revision.

---

## Functional CI Execution

Each functional job:

```text
checkout framework
        ↓
authenticate to GHCR
        ↓
pull immutable Playwright image
        ↓
pull immutable UPEX image
        ↓
generate ephemeral NextAuth secret
        ↓
start UPEX with Docker Compose
        ↓
wait for health check
        ↓
run one Playwright responsibility
        ↓
upload reports / diagnostics
        ↓
stop Compose environment
```

Functional responsibilities are separated into independent jobs.

Current jobs are:

```text
api
database
accessibility
visual
ui
```

The UI job uses a browser matrix.

---

## Browser Matrix Decision

UI and smoke tests are browser-dependent and execute across:

```text
chromium
firefox
webkit
```

The UI matrix uses:

```text
fail-fast: false
```

A browser-specific failure must not automatically cancel the remaining browser executions.

This preserves complete cross-browser diagnostic signal.

API, database, accessibility, and visual responsibilities are not multiplied across the browser matrix.

---

## Playwright Project Ownership

CI selects execution through Playwright project boundaries:

```text
api
→ --project=api

database
→ --project=database

accessibility
→ --project=accessibility

visual
→ --project=visual

ui
→ --project=chromium
→ --project=firefox
→ --project=webkit
```

Docker does not redefine test ownership.

The same image can execute different projects because project selection is a test-runner concern.

---

## Retry Ownership

Global Playwright retry behavior applies where appropriate.

Database execution explicitly disables retries.

```text
database
→ retries: 0
```

Performance execution also disables retries, but performance is outside this functional CI architecture.

Database retry rationale is documented in ADR-005.

---

## CI Permissions

The workflow follows least-privilege permissions.

Default functional workflow access is:

```text
contents: read
```

The image-building job additionally requires:

```text
packages: write
```

because it publishes images to GitHub Container Registry.

Downstream test jobs require:

```text
packages: read
```

to pull immutable images.

Package permissions are scoped to the jobs that require them.

---

## Runtime Secrets

Runtime secrets are not embedded in Docker images.

The current functional runtime receives:

```text
DATABASE_URL
NEXTAUTH_SECRET
```

`DATABASE_URL` is provided through CI secrets.

`NEXTAUTH_SECRET` is generated ephemerally per functional job.

Runtime secrets belong to execution configuration rather than image build layers.

---

## Artifact Persistence

Containers are ephemeral.

Outputs that must survive container removal are persisted outside the container.

Current Compose bind mounts include:

```text
/app/playwright-report
→ playwright-report/

/app/test-results
→ test-results/
```

GitHub Actions then uploads those directories as workflow artifacts.

This creates two separate persistence responsibilities:

```text
Docker bind mount
→ survive container lifecycle

GitHub Actions artifact
→ survive runner lifecycle
```

Executable container images are distributed through GHCR and are not treated as workflow-report artifacts.

---

## Failure Diagnostics

Functional CI preserves diagnostic evidence.

Playwright jobs upload:

```text
playwright-report
```

for successful and failed runs.

Failure-specific diagnostics include:

```text
test-results
```

Application logs are printed when functional execution fails.

This is important because failures may originate from either:

- the test framework;
- the application-under-test runtime.

---

## Timeouts

CI jobs use explicit job-level timeout ceilings.

Current values are:

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
→ 15 minutes per browser
```

These values are safety limits rather than expected runtime targets.

---

## Concurrency

The workflow groups execution by workflow and logical branch or pull request.

Newer workflow executions cancel obsolete in-progress executions for the same logical change.

This prevents unnecessary resource consumption while avoiding cancellation of unrelated branches or pull requests.

---

## Visual Regression Runtime

Visual regression remains a dedicated Playwright project.

Its canonical rendering environment is the Playwright Docker/Linux runtime used by CI.

CI is compare-only.

CI must not automatically run:

```text
--update-snapshots
```

Approved visual baselines remain version-controlled repository assets.

---

## Performance Separation

Performance execution is intentionally excluded from the main functional Compose workflow.

API performance uses:

```text
grafana/k6
```

Browser performance uses:

```text
Lighthouse / LHCI
```

Performance execution has separate CI ownership because its runtime, target, and measurement responsibilities differ from functional test execution.

The functional Playwright image must not absorb k6 merely to create one universal test container.

---

## Image Retention

Test runs do not delete the images they used, so recent commit-SHA images stay available for reproduction. Registry retention is a separate maintenance responsibility owned by `.github/workflows/ghcr-cleanup.yml` (weekly, and on demand):

```text
playwright-enterprise-tests package versions
→ always keep the newest 3
→ keep any other version younger than 7 days
→ delete the rest
```

---

## Alternatives Considered

### Run Functional CI Against Hosted UPEX

Rejected as the primary functional CI model.

Advantages:

- no application image required;
- simpler workflow infrastructure;
- no local application startup.

Disadvantages:

- shared external application state;
- less reproducible execution;
- application revision may not be explicitly tied to a framework workflow run;
- hosted availability becomes a CI dependency;
- direct database validation should not target the shared hosted environment;
- visual and browser behavior becomes harder to isolate from shared deployment changes.

The hosted environment remains appropriate for explicitly hosted responsibilities such as current performance execution.

---

### Single Docker Image Containing UPEX and Playwright

Rejected.

Advantages:

- one image to build and distribute;
- superficially simpler CI topology.

Disadvantages:

- application and test-framework ownership become coupled;
- independent revision identity is lost;
- application and test dependencies share unnecessary lifecycle;
- downstream responsibility becomes less explicit.

Separate images better reflect the system boundaries.

---

### Rebuild Images Independently in Every Test Job

Rejected.

Advantages:

- jobs become individually self-contained;
- no registry dependency between build and execution jobs.

Disadvantages:

- repeated build cost;
- potential inconsistency across jobs;
- weaker traceability;
- no true build-once/run-many model;
- duplicate application and framework build work.

A shared immutable image build provides better reproducibility and efficiency.

---

### Run Playwright on the GitHub Runner and Only Containerize UPEX

Rejected as the canonical CI model.

Advantages:

- simpler test invocation;
- fewer test containers.

Disadvantages:

- local and CI Playwright runtime differ;
- canonical visual rendering becomes weaker;
- browser and OS dependencies depend directly on runner preparation;
- the reusable test image loses value.

Containerizing Playwright preserves a reproducible execution boundary.

---

### Add PostgreSQL to Docker Compose

Not selected for the current architecture.

Advantages:

- fully local functional stack;
- no remote database dependency;
- easy database recreation.

Disadvantages:

- changes the application's current database runtime characteristics;
- introduces another infrastructure service;
- duplicates a capability already provided by the dedicated Neon test database;
- not required by the current validation model.

A local PostgreSQL service may be reconsidered if a future requirement demonstrates clear value.

---

## Consequences

### Positive

- localDocker and CI use the same functional topology;
- the application-under-test revision is explicitly traceable;
- the framework revision is explicitly traceable;
- Playwright execution is reproducible;
- application and test runtime ownership remain separated;
- API, database, accessibility, visual, and browser responsibilities can execute independently;
- direct database validation has a safe localDocker execution boundary;
- CI can reuse immutable build artifacts;
- visual comparison uses a stable Linux runtime;
- diagnostics survive ephemeral containers.

### Trade-offs

- CI must build and publish two images;
- GHCR becomes part of the functional execution pipeline;
- functional jobs require Docker Compose startup;
- Neon remains an external runtime dependency;
- UPEX source must be resolvable before application-image construction;
- the workflow has more explicit infrastructure than direct hosted execution.

These trade-offs are accepted because they provide stronger reproducibility, traceability, isolation, and architectural ownership.

---

## Implementation References

The decision is implemented through:

```text
Dockerfile
Dockerfile.upex-local
docker-compose.yml
docker-compose.local.yml
config/environments/**
playwright.config.ts
.github/workflows/playwright.yml
.github/workflows/performance.yml
.github/workflows/ghcr-cleanup.yml
src/fixtures/test-fixtures.ts
framework/core/database/**
src/database/**
tests/api/**
tests/database/**
tests/accessibility/**
tests/visual/**
tests/ui/**
tests/smoke/**
```

---

## Related Decisions

```text
ADR-004
→ UPEX DOJO target application

ADR-005
→ database validation and test data lifecycle
```

---

## Follow-Up

Future execution changes should preserve these boundaries unless a concrete requirement demonstrates that they are no longer appropriate.

Examples that may justify a new ADR include:

- moving functional CI back to a hosted target;
- replacing GHCR-based immutable image distribution;
- introducing an isolated local PostgreSQL service as the canonical database runtime;
- moving the UPEX runtime definition into another ownership boundary;
- changing the functional CI topology from Docker Compose to another orchestration model.
