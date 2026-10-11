# ADR-007: Reusable Template Architecture

## Status

Accepted

---

## Context

The framework was built against one target application, UPEX DOJO. Its architecture, standards, and quality gates are application-neutral, but the code mixes reusable infrastructure with UPEX-specific clients, schemas, pages, fixtures, and specs.

The framework should become a starting point for any automation project:

- install and configure against a new application without editing framework code;
- keep the established architecture, golden patterns, and quality gates;
- let humans and any AI tool write new tests from the same golden patterns;
- keep those patterns provably aligned with the validated UPEX implementation.

---

## Decision

### Ownership split

```text
src/framework/   template-owned core (env, config, auth, fixtures, reporters,
                 schema validation, accessibility, visual, database, ai)
src/app/         project-owned application layer (schemas, clients, factories,
                 pages, components, mocks, domain database clients, fixtures)
.qa/             template-owned tooling (golden templates, index, scripts)
config/          project-owned configuration
tests/           project-owned specs
```

Dependencies flow one way: `src/app` and `tests` may import `src/framework`; `src/framework` never imports `src/app`.

### Configuration

- `config/framework.config.ts` selects modules, browsers, execution settings, and the authentication strategy. It is validated at startup.
- `config/environments/environments.json` owns target URLs and per-environment permissions (`allow.database`, `allow.destructive`, `allow.performance`). Safety guards check permissions instead of environment names.
- `TEST_ENV` is required. A run never silently targets a shared environment.
- Playwright projects are generated from the enabled modules and browsers.

### Golden templates

- Generic templates live in `.qa/templates/` with placeholders such as `__Domain__` and are catalogued in `.qa/index.json`.
- Each template is derived from one canonical UPEX file.
- A round-trip check renders every template with UPEX values and requires the output to match the canonical file exactly after formatting. Template and canonical file can therefore only change together.
- Project-specific patterns are registered in `.qa-project.json` and take precedence over generic templates.

### Installation

Installation is deterministic and does not involve AI:

```text
npm ci → npm run setup → .env → npm run doctor → npm run test:starter
```

Test creation after installation is tool-neutral: humans or any AI tool follow `AGENTS.md`, the golden templates, and the same lint, typecheck, CI, and review gates.

### Pilot

UPEX remains in this repository until the template is complete, so the existing suite stays a regression safety net. It then moves to a separate private pilot repository created through `npm run setup`, which also owns the round-trip check.

---

## Scope

### v1.0

- framework/app split with no behavior change;
- validated configuration, environment permissions, required `TEST_ENV`;
- `bearer` and `nextAuth` authentication strategies;
- golden templates, index, catalogue, editor snippets, round-trip check;
- `setup`, `doctor`, starter tests;
- architecture lint rules in the CI quality gate;
- short `AGENTS.md` and a tool-neutral first-tests prompt;
- GitHub Actions only.

### Deferred until a real project needs it

- generators, custom AST conformance checker, `sync-core`;
- additional authentication strategies;
- OpenAPI code generation and UI discovery;
- additional AI providers and CI platforms;
- npm package distribution of the core.

---

## Definition of Done

- a fresh clone reaches green starter tests against a new application in under 15 minutes;
- two API and two UI tests written from the golden templates pass lint, typecheck, and a real run, and are accepted in review with only minor changes;
- this is proven on at least one application other than UPEX.

---

## Consequences

### Positive

- one source of truth for patterns used by humans and AI;
- template updates cannot overwrite project code;
- safety guards no longer depend on environment names.

### Trade-offs

- the round-trip check couples canonical UPEX files to templates by design;
- import paths change once during the split;
- template updates are git merges until the core is packaged.

---

## Related Decisions

```text
ADR-003 → framework architecture
ADR-005 → database validation and test data lifecycle
ADR-006 → localDocker and CI execution architecture
```
