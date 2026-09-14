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

Do not create a new client, schema, constant collection, factory, fixture, Page Object, Component Object, accessibility abstraction, mock, utility, or architectural layer before checking whether the existing architecture can be reused or extended.

Do not treat "add a test" as a request to modify only the spec file.

Determine which architectural layers are genuinely required by the behavior.

Preserve:

- schema-first API contracts;
- runtime validation before trusting provider data;
- domain types where available;
- fixture dependency boundaries;
- API vs browser authentication separation;
- Page Object and Component Object responsibility boundaries;
- accessibility scanner and WCAG policy ownership;
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

Preserve authentication boundaries:

```text
API
→ Bearer JWT

Browser
→ Auth.js session
```

Do not treat API authentication and browser authentication as interchangeable.

Use UI login only when login behavior itself is under test.

Do not introduce new abstractions such as a generic base client, service layer, generic factory, generic mock service, helper wrapper, fixture, or accessibility abstraction unless demonstrated reuse or complexity justifies them.

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

An accessibility change may require:

```text
fixture
→ accessibility spec
```

or may reuse the existing scanner, policy, formatter, and fixtures without introducing any new abstraction.

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

For accessibility work, run:

```bash
npx playwright test --project=accessibility
```

A failing accessibility project may represent a real application accessibility violation rather than a framework defect.

Do not hide or reinterpret that failure merely to claim validation passed.

Run broader regression scope when shared framework infrastructure changes.

Do not claim validation passed unless it was actually executed successfully.

Update documentation when a change modifies:

- architectural responsibility;
- established golden patterns;
- authentication strategy;
- dependency direction;
- framework-wide implementation standards;
- major technology choices.

If the requested change conflicts with the documented architecture:

1. identify the conflict;
2. explain why the current pattern is insufficient;
3. propose the smallest architectural change;
4. update the appropriate documentation or ADR;
5. only then implement the new pattern.

Architecture must drive generated code, not the other way around.
