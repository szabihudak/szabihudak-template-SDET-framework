# Framework Requirements

## Purpose

The framework is designed to demonstrate enterprise-level Quality Engineering practices using Playwright and TypeScript against a production-like web application.

The framework should be scalable, maintainable, CI-friendly, and suitable for UI, API, accessibility, visual, and performance testing.

## Functional Requirements

The framework must support:

- UI end-to-end testing
- API testing
- Authentication and session reuse
- Multiple user roles
- Cross-browser execution
- Parallel execution
- Test retries
- Test tagging and filtering
- Environment-specific configuration
- Test data management
- Screenshots on failure
- Video recording when required
- Playwright traces
- HTML and machine-readable reporting
- CI/CD execution
- Docker-based execution
- Accessibility testing
- Visual regression testing
- Version-controlled visual regression baselines
- Deterministic page-level and component-level visual comparison
- Reproducible visual baseline generation and comparison through a canonical Docker/Linux runtime
- Dedicated compare-only visual regression execution in CI
- Performance testing
- API and UI test composition
- Mocking and network interception
- Secrets management
- Multiple deployment environments

## Non-Functional Requirements

The framework should be:

### Maintainable

Tests should be easy to understand, modify, and debug.

### Scalable

The architecture should remain manageable as the test suite grows to hundreds or thousands of tests.

### Reliable

The framework should minimize flaky tests and provide useful diagnostic information when failures occur.

Visual regression tests should establish deterministic rendered state before comparison and must not rely on automatic baseline updates to hide unstable or unexpected differences.

### Fast

Tests should support parallel execution, efficient authentication, and appropriate separation between UI, API, dedicated accessibility coverage, and dedicated visual regression coverage.

### Reusable

Common functionality should be implemented once and reused through fixtures, helpers, domain abstractions, and shared utilities.

New abstractions should only be introduced where they provide demonstrated reuse or architectural value.

### CI-Friendly

The framework must run consistently in local environments, CI pipelines, and containers.

Visual regression comparison must use committed approved baselines and a reproducible rendering environment. CI must compare against those baselines rather than generating or automatically approving replacements.

### Observable

Failures should provide sufficient logs, screenshots, traces, videos, reports, accessibility diagnostics, and visual comparison evidence for efficient troubleshooting.

Visual regression failures should provide expected, actual, and diff evidence where available.

### Secure

Credentials, tokens, and other sensitive information must never be committed to source control.

### Extensible

New testing capabilities should be addable without requiring major redesign of the framework.

## Target Test Application

The framework currently targets UPEX DOJO, a production-like web application used to demonstrate enterprise Quality Engineering practices across UI and API layers.

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
- network interception and mocking;
- browser-rendered states suitable for automated accessibility validation;
- deterministic browser-rendered states suitable for visual regression testing.

The application intentionally supports two authentication contexts used by the framework:

- REST API authentication through Bearer JWT tokens;
- browser authentication through an Auth.js session.

This distinction allows the framework to demonstrate realistic API setup, programmatic browser authentication, authenticated UI testing, API/UI composition, accessibility validation of both public and authenticated browser states, and deterministic authenticated visual regression scenarios without relying on slow UI-based setup.

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
- UI and API layers are both covered;
- test architecture is clearly documented;
- failures are easy to diagnose;
- tests can execute in parallel;
- environments and secrets are handled cleanly;
- Docker execution is supported;
- automated accessibility checks are integrated through a dedicated Playwright project and CI quality gate;
- accessibility failures remain visible as real quality signals rather than being suppressed for pipeline success;
- visual regression checks are integrated through a dedicated Playwright project and CI quality gate;
- approved visual baselines are version-controlled and generated through the canonical Docker/Linux rendering environment;
- visual baseline changes require explicit review rather than automatic CI approval;
- visual failures provide actionable comparison evidence;
- the repository can be confidently presented during a Senior QA / SDET interview.
