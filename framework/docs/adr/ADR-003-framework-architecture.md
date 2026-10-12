# ADR-003: Enterprise Quality Engineering Platform Architecture

## Status

Accepted

---

## Context

The objective of this repository is not to build a simple Playwright automation project.

The objective is to build an enterprise-grade Quality Engineering Platform that demonstrates modern QA engineering practices expected from Senior QA Automation Engineers, SDETs and Quality Engineering Leads.

The architecture must support multiple testing disciplines while remaining maintainable, scalable and easy to extend.

The framework should allow independent evolution of different testing capabilities without requiring architectural redesign.

The architecture should grow from demonstrated engineering needs rather than introducing layers, abstractions, or tooling only for portfolio presence.

---

# Quality Engineering Domains

The platform currently supports the following quality domains:

- UI Automation
- API Automation
- Accessibility Testing
- Visual Regression Testing
- Performance Testing
- Test Data Management
- Environment Management
- CI/CD
- Docker Execution
- Reporting & Observability

Additional domains may be introduced when they provide demonstrated engineering value.

Deferred capabilities include:

- Security Testing
- AI-assisted QA

---

# Architecture

```text
playwright-enterprise-framework/
│
├── config/
│   └── environments/
│
├── framework/docs/
│   └── adr/
│       ├── ADR-001-target-application.md
│       ├── ADR-002-realworld-implementation.md
│       ├── ADR-003-framework-architecture.md
│       └── ADR-004-target-application-upex-dojo.md
│
├── performance/
│   └── k6/
│
├── src/
│   ├── accessibility/
│   │   ├── constants/
│   │   └── utils/
│   │
│   ├── api/
│   │   ├── clients/
│   │   ├── constants/
│   │   ├── models/
│   │   ├── schemas/
│   │   └── utils/
│   │
│   ├── components/
│   ├── data/
│   ├── fixtures/
│   ├── mocks/
│   ├── pages/
│   ├── utils/
│   │
│   └── visual/
│       └── constants/
│
├── tests/
│   ├── accessibility/
│   ├── api/
│   ├── smoke/
│   ├── ui/
│   └── visual/
│
├── .github/
│   ├── workflows/
│   │   ├── ghcr-cleanup.yml
│   │   ├── playwright.yml
│   │   └── performance.yml
│   └── copilot-instructions.md
│
├── AGENTS.md
├── Dockerfile
├── README.md
├── playwright.config.ts
├── package.json
├── package-lock.json
└── tsconfig.json
```

---

# Layer Responsibilities

## Tests

Contains executable test scenarios organized by testing responsibility.

Tests should describe observable behaviour and assertions.

Reusable framework implementation should remain outside test specifications where reuse or architectural ownership is demonstrated.

---

## Fixtures

Responsible for Playwright dependency injection and shared test setup.

Examples:

- authenticated browser state
- API clients
- page objects
- component objects
- generated test data

Fixtures should compose existing framework capabilities rather than become a general-purpose service layer.

---

## Pages

Contains page-level browser abstractions.

Responsibilities:

- locators
- page actions
- page-level navigation

Page Objects should model browser interaction boundaries without owning unrelated business workflows or assertions.

---

## Components

Contains reusable UI component abstractions.

Components are introduced when a reusable UI boundary is demonstrated rather than created speculatively.

Examples include reusable navigation, cards, dialogs, forms, and other independently meaningful UI elements.

---

## API

Contains strongly typed REST API infrastructure.

Responsibilities:

- API clients
- endpoint and API constants
- request and response models
- runtime response schemas
- API-specific utilities
- authentication required for API communication

The API layer should model observed provider contracts and keep transport concerns separate from browser automation.

A generic service layer should not be introduced unless a demonstrated architectural need requires one.

---

## Data

Responsible for reusable test-data creation and deterministic scenario setup.

Responsibilities may include:

- factories
- builders
- reusable datasets
- generated unique test data

Test data infrastructure should support test isolation and avoid unnecessary shared mutable state.

---

## Mocks

Contains reusable network-mocking infrastructure where demonstrated reuse exists.

Mocking should remain explicit and scenario-driven.

Mocks must not hide integration behaviour that the test is intended to validate.

---

## Accessibility

Contains reusable accessibility infrastructure.

Responsibilities:

- axe-core integration
- centralized WCAG policy
- accessibility scanning
- human-readable accessibility diagnostics

Accessibility pass/fail assertions remain in specs rather than being owned by the reusable accessibility layer.

Automated accessibility testing provides an automated quality signal and must not be represented as complete WCAG compliance.

---

## Visual Regression

Contains reusable visual-comparison policy where shared configuration is justified.

Visual regression execution remains owned by the dedicated Playwright visual project and visual test specifications.

Approved baselines are version-controlled with the relevant visual specs.

Baseline generation and comparison use the canonical Docker/Linux rendering environment.

CI performs comparison only and must not automatically generate or approve replacement baselines.

Native Playwright screenshot comparison is the current implementation.

Applitools is deferred and should only be introduced if a demonstrated requirement justifies the additional platform and operational complexity.

---

## Performance

Performance testing is intentionally separated from Playwright execution.

The platform uses k6 for performance workloads instead of browser-based load generation.

Performance workloads are owned under:

```text
tests/performance/k6/
```

The current implementation focuses on controlled authenticated API performance baseline testing.

Performance tests include:

- API load
- smoke load
- stress (deferred)
- spike (deferred)
- endurance (deferred)

Performance setup that is not itself the measured target should remain separate from workload-specific measurements.

Performance quality gates use workload-specific metrics and enforceable thresholds.

Hosted shared environments must use deliberately bounded workloads. Stress, spike, endurance, and large-scale capacity testing require an appropriate controlled environment before activation.

Performance execution uses its own pinned k6 container runtime rather than extending the Playwright image with k6.

---

## Reporting & Observability

Reporting and diagnostics are owned by the execution capability that produces them rather than by a speculative generic reporting layer.

Playwright execution can provide:

- HTML reports
- traces
- screenshots
- videos
- CI artifacts

Accessibility failures should preserve actionable accessibility diagnostics.

Visual failures should preserve expected, actual, and diff evidence where available.

Performance execution should preserve a human-readable HTML report containing workload metrics and threshold results.

Reporting abstractions should only be introduced when demonstrated cross-cutting reuse requires them.

---

# Quality Domains

## UI Automation

Playwright.

Browser projects provide cross-browser execution where the testing responsibility requires it.

---

## API Automation

Playwright API testing with strongly typed clients and runtime schema validation.

---

## Accessibility

Playwright with `@axe-core/playwright`.

Automated accessibility validation is owned by a dedicated Playwright project and remains a visible quality signal when real violations are detected.

---

## Visual Regression

Native Playwright screenshot comparison.

The current visual strategy uses deterministic page-level and component-level comparisons with version-controlled baselines.

Later, if justified by demonstrated requirements:

- Applitools

---

## Performance

k6.

Performance execution is intentionally separated from Playwright and uses a dedicated containerized runtime and CI workflow.

---

## Security

Dedicated automated security testing is deferred.

Security-sensitive engineering practices such as credential handling, authentication boundaries, and negative authorization behaviour may still be validated where they are part of existing API or UI scenarios.

A dedicated security-testing capability should only be introduced when its scope and execution ownership are explicitly designed.

Potential future scope includes:

- invalid or expired authentication
- unauthorized and forbidden access
- security headers
- input validation
- OWASP-oriented checks

---

## AI-assisted QA

Dedicated AI runtime integration is deferred.

AI may assist engineering workflows, but AI-generated implementation must remain subject to the same architecture, validation, and review standards as manually written code.

AI-specific runtime features should only be introduced when they provide demonstrated product or engineering value.

---

## Observability

The framework should expose enough evidence to investigate failures efficiently.

Evidence depends on the execution domain and may include:

- traces
- logs
- screenshots
- videos
- accessibility diagnostics
- visual comparison evidence
- performance reports
- CI artifacts

Observability should help explain failures rather than merely record that a failure occurred.

---

# Design Principles

- SOLID where applicable
- DRY without premature abstraction
- KISS
- Composition over inheritance
- Domain-oriented structure
- Strong typing
- Small reusable modules
- Configuration over hardcoding
- Explicit execution ownership
- Reuse before extension before creation
- Abstractions introduced only when demonstrated reuse or architectural value exists

---

# Test Isolation

Every test should be independently executable.

Tests must not depend on execution order or state created by another test.

Where appropriate:

API-driven setup should prepare deterministic data.

UI tests should focus on browser-visible behaviour rather than slow UI-based setup when equivalent API setup is available.

Generated data should avoid unnecessary collisions and shared mutable state.

Performance setup should remain outside measured workload metrics when setup itself is not the performance target.

---

# Configuration

Execution targets are environment-driven.

Supported environment intent includes:

```text
TEST_ENV=hosted
TEST_ENV=local
TEST_ENV=ci
```

Environment URLs are owned by a shared runtime-neutral configuration source.

Playwright consumes that configuration through its TypeScript environment adapter.

Other runtimes, including k6 execution through CI, may resolve the same environment source without depending on Playwright or Node.js-specific framework abstractions.

No hardcoded environment URLs in tests or reusable framework layers.

No hardcoded credentials or secrets.

---

# CI/CD

The framework uses GitHub Actions and containerized execution.

Playwright-based execution and performance execution have deliberately separate CI ownership.

The Playwright CI path owns:

- static quality gates
- Playwright API execution
- browser execution
- accessibility execution
- visual regression comparison

The Playwright test image is built once for trusted workflow execution, tagged by commit SHA, distributed through GitHub Container Registry, and consumed by downstream Playwright jobs using the same immutable image reference.

Performance execution is owned by a dedicated manually triggered workflow and uses the pinned official k6 container image.

Performance testing is not part of the normal pull-request execution path.

CI evidence such as reports, traces, screenshots, visual diffs, and performance reports remains separate from executable container-image distribution.

Potential future CI platforms may include:

- Azure DevOps
- GitLab CI

They should only be introduced when a concrete requirement justifies supporting another CI platform.

---

# Success Criteria

The platform should demonstrate:

✓ Maintainable Playwright-based UI automation

✓ Strongly typed API automation with runtime contract validation

✓ Reusable authentication and deterministic test setup

✓ Cross-browser execution

✓ Automated accessibility quality gates

✓ Native visual regression with controlled baseline ownership

✓ Controlled API performance baseline testing with k6

✓ Environment-driven execution

✓ Reproducible containerized execution

✓ Explicit separation between Playwright and performance runtime ownership

✓ GitHub Actions CI/CD

✓ Actionable diagnostics and execution evidence

✓ Architecture that evolves from demonstrated engineering needs rather than speculative abstractions

✓ Senior-level Quality Engineering practices

Deferred capabilities such as dedicated security testing and AI runtime integration are not required for the current architecture to satisfy these criteria.

---

# Consequences

## Advantages

- clear responsibility boundaries
- independently evolvable testing capabilities
- reduced coupling between Playwright and performance execution
- reusable infrastructure without unnecessary abstraction layers
- reproducible execution
- explicit CI ownership
- actionable diagnostic evidence
- architecture aligned with the implemented repository
- easier technical explanation during Senior QA / SDET interviews
- room for future capabilities without requiring speculative implementation today

## Trade-offs

- multiple execution runtimes require explicit ownership and documentation
- deterministic visual testing requires controlled baseline management
- external hosted environments limit safe performance workload intensity
- architecture requires discipline to prevent unnecessary abstraction growth
- CI evidence and executable container distribution require separate lifecycle management

These trade-offs are accepted because the resulting boundaries improve maintainability, reproducibility, diagnostic quality, and controlled extensibility.

---

# Evolution

The architecture is expected to evolve when a demonstrated testing or engineering requirement justifies a new capability.

New folders, layers, abstractions, tools, and execution paths should not be introduced solely to make the repository appear more enterprise-like.

Future capabilities should follow the same engineering sequence:

```text
requirement
→ design
→ smallest architecturally complete implementation
→ validation
→ documentation
```

Architecture documentation must be updated when implementation changes invalidate an existing architectural statement.
