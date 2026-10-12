# Framework Requirements

## Purpose

The framework is designed to demonstrate enterprise-level Quality Engineering practices using Playwright and TypeScript against a production-like web application.

The framework should be scalable, maintainable, CI-friendly, and suitable for UI, API, database, accessibility, visual, performance, and AI-assisted Quality Engineering workflows.

## Functional Requirements

The framework must support:

- UI end-to-end testing
- API testing
- Direct database validation against a dedicated test database
- Authentication and session reuse
- Multiple user roles
- Cross-browser execution
- Parallel execution
- Test retries
- Test tagging and filtering
- Environment-specific configuration through a shared runtime-neutral environment source
- Test data management
- Screenshots on failure
- Video recording when required
- Playwright traces
- HTML and machine-readable reporting
- CI/CD execution
- Docker-based execution
- Reproducible local application execution through Docker Compose for `localDocker`
- Separate runtime ownership appropriate to Playwright test execution, k6 API performance testing, and Lighthouse browser-performance measurement
- Accessibility testing
- Visual regression testing
- Version-controlled visual regression baselines
- Deterministic page-level and component-level visual comparison
- Reproducible visual baseline generation and comparison through a canonical Docker/Linux runtime
- Dedicated compare-only visual regression execution in CI
- Controlled API performance baseline testing with workload-specific metrics and enforceable thresholds
- Browser-performance baseline testing through Lighthouse / LHCI
- Authenticated browser-performance testing through deterministic Playwright scenario setup followed by Lighthouse measurement
- Shared Lighthouse threshold and severity policy across standalone and authenticated browser-performance execution
- Dedicated manually triggered performance execution in CI
- API and UI test composition
- Mocking and network interception
- Secrets management
- Multiple deployment environments
- Explicit guarded reset of the dedicated test database to the application-owned seeded baseline
- Immutable CI container images for the Playwright framework and local UPEX application runtime
- AI-assisted failure analysis and test design by coding agents from Playwright evidence and explicit requirement context
- Mandatory human review of AI output before engineering decisions or implementation changes
- Repository-aware AI-assisted engineering using documented architecture, testing standards, and validated Golden Templates
- Separation of repository evidence, provider-contract evidence, and runtime browser evidence during AI-assisted engineering
- Deterministic validation of AI-assisted implementation changes before human approval

## Non-Functional Requirements

The framework should be:

### Maintainable

Tests should be easy to understand, modify, and debug.

### Scalable

The architecture should remain manageable as the test suite grows to hundreds or thousands of tests.

### Reliable

The framework should minimize flaky tests and provide useful diagnostic information when failures occur.

Database validation should use a dedicated disposable test database and preserve resulting test state during normal execution so failed persistence behavior remains inspectable. Destructive reset must be explicit, guarded, and restore the application-owned schema and baseline seed state.

Visual regression tests should establish deterministic rendered state before comparison and must not rely on automatic baseline updates to hide unstable or unexpected differences.

Browser-performance coverage should reuse existing deterministic framework setup where that setup already represents the required application state rather than duplicating business-state initialization solely for performance measurement.

AI-generated analysis and test design must remain advisory and must not replace deterministic execution evidence or human review.

### Fast

Tests should support parallel execution, efficient authentication, and appropriate separation between UI, API, database, dedicated accessibility coverage, and dedicated visual regression coverage.

### Reusable

Common functionality should be implemented once and reused through fixtures, helpers, domain abstractions, and shared utilities.

New abstractions should only be introduced where they provide demonstrated reuse or architectural value.

### CI-Friendly

The framework must run consistently in local environments, CI pipelines, and containers.

The main Playwright CI workflow should execute API, database, accessibility, visual, and browser projects against a reproducible local UPEX application runtime started through Docker Compose, while performance execution remains a separate hosted-target workflow.

Visual regression comparison must use committed approved baselines and a reproducible rendering environment. CI must compare against those baselines rather than generating or automatically approving replacements.

Performance execution should preserve the runtime boundary appropriate to the measurement responsibility: k6 for API workload performance and Lighthouse with a Node/Chrome-or-Chromium runtime for browser-performance measurement.

### Observable

Failures should provide sufficient logs, screenshots, traces, videos, reports, accessibility diagnostics, visual comparison evidence, application logs, and database validation evidence for efficient troubleshooting.

Visual regression failures should provide expected, actual, and diff evidence where available.

Performance execution should preserve human-readable and machine-readable evidence appropriate to the measurement capability, including k6 workload results, Lighthouse browser-performance reports, and Playwright evidence for authenticated browser-performance scenarios.

### Secure

Credentials, tokens, database connection strings, and other sensitive information must never be committed to source control.

Destructive database operations must be restricted to the dedicated test-owned `localDocker` database boundary and require explicit safety confirmation.

AI-bound failure evidence must be sanitized before provider submission. Binary or visual artifact contents must not be assumed to be AI-visible merely because artifact metadata or paths are included in the evidence.

Secrets and credentials used by AI integrations must remain outside source control.

### Extensible

New testing capabilities should be addable without requiring major redesign of the framework.

AI capabilities should preserve explicit provider, schema, validation, and human-review boundaries so that future AI-assisted workflows can be added without coupling test execution directly to non-deterministic model output.

## Target Test Application

The framework currently targets UPEX DOJO, a production-like web application used to demonstrate enterprise Quality Engineering practices across UI, API, and persistence layers.

Application:

- Live application: `https://dojo.upexgalaxy.com`
- API documentation: `https://dojo.upexgalaxy.com/api/docs`
- Source repository: `upex-galaxy/upex-dojo`

The application provides realistic workflows including:

- user registration;
- authentication;
- authenticated user sessions;
- task management;
- task CRUD operations;
- REST API access;
- token-based API authentication;
- browser session authentication;
- API and UI workflow composition;
- persisted user and task state suitable for direct database validation;
- network interception and mocking;
- browser-rendered states suitable for automated accessibility validation;
- deterministic browser-rendered states suitable for visual regression testing;
- authenticated REST API operations suitable for controlled performance baseline testing;
- public and authenticated browser states suitable for Lighthouse browser-performance measurement.

The application intentionally supports two authentication contexts used by the framework:

- REST API authentication through Bearer JWT tokens;
- browser authentication through an Auth.js session.

This distinction allows the framework to demonstrate realistic API setup, programmatic browser authentication, authenticated UI testing, API/UI composition, database persistence validation, accessibility validation of both public and authenticated browser states, deterministic authenticated visual regression scenarios, controlled API performance testing, and authenticated browser-performance measurement without relying on slow UI-based setup.

## Out of Scope for Initial Version

The first version will not attempt to provide:

- full mobile native testing
- exhaustive security penetration testing
- large-scale production load testing
- infrastructure testing
- full Kubernetes orchestration

These areas may be introduced later if they provide clear portfolio or market value.

## Success Criteria

The framework will be considered successful when:

- tests can run locally and in CI;
- UI, API, and database persistence layers are covered;
- test architecture is clearly documented;
- failures are easy to diagnose;
- tests can execute in parallel;
- environments and secrets are handled cleanly;
- Docker execution is supported;
- local native execution and `localDocker` execution are both explicit and documented;
- the main Playwright CI workflow runs against a reproducible Docker Compose UPEX runtime rather than the shared hosted application;
- API, database, accessibility, visual, and browser jobs reuse immutable Playwright and UPEX images for a workflow execution;
- database validation uses typed domain clients and fixture-managed connection lifecycle;
- database tests execute through a dedicated browser-independent Playwright project with retries disabled;
- destructive test-database reset is explicit, guarded, restores the UPEX-owned schema and seed state, and verifies the baseline after restoration;
- automated accessibility checks are integrated through a dedicated Playwright project and CI quality gate;
- accessibility failures remain visible as real quality signals rather than being suppressed for pipeline success;
- visual regression checks are integrated through a dedicated Playwright project and CI quality gate;
- approved visual baselines are version-controlled and generated through the canonical Docker/Linux rendering environment;
- visual baseline changes require explicit review rather than automatic CI approval;
- visual failures provide actionable comparison evidence;
- controlled API performance baselines execute through a dedicated k6 runtime with workload-specific metrics and enforceable thresholds;
- browser-performance baselines execute through Lighthouse / LHCI with enforceable threshold and severity semantics;
- authenticated browser-performance coverage reuses deterministic Playwright setup and browser state before Lighthouse measurement;
- standalone and authenticated Lighthouse execution share the same version-controlled browser-performance quality policy;
- performance execution is owned by a dedicated manually triggered CI workflow rather than the normal pull-request test path;
- performance execution preserves k6, Lighthouse, and authenticated Playwright performance evidence as appropriate to each execution path;
- the repository can be confidently presented during a Senior QA / SDET interview;
