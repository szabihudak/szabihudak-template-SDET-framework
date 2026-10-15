# ADR-007: Reusable Template Architecture

## Status

Accepted

Amended by ADR-009 (setup no longer asks for an AI tool) and ADR-010 (setup installs no AI agents; optional examples in `examples/copilot-agents/`).

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
framework/core/   template-owned core (env, config, auth, fixtures, reporters,
                 schema validation, accessibility, visual, database, ai)
src/         project-owned application layer (schemas, clients, factories,
                 pages, components, mocks, domain database clients, fixtures)
.qa/             template-owned tooling (golden templates, index, scripts)
config/          project-owned configuration
tests/           project-owned specs
```

Dependencies flow one way: `src` and `tests` may import `framework/core`; `framework/core` never imports `src`.

### Configuration

- `config/framework.config.ts` selects modules, browsers, execution settings, and the authentication strategy. It is validated at startup.
- `config/environments/environments.json` owns target URLs and per-environment permissions (`allow.database`, `allow.destructive`, `allow.performance`). Safety guards check permissions instead of environment names.
- `TEST_ENV` is required. A run never silently targets a shared environment.
- Playwright projects are generated from the enabled modules and browsers.

### Golden templates

- Generic templates live in `framework/templates/` with placeholders such as `__Domain__` and are catalogued in `framework/templates/index.json`.
- Each template is derived from one canonical UPEX file.
- A round-trip check renders every template with UPEX values and requires the output to match the canonical file exactly after formatting. Template and canonical file can therefore only change together.
- Project-specific patterns are registered in `config/approved-examples.json` and take precedence over generic templates.

### Installation

Installation is deterministic and does not involve AI:

```text
./install.sh in the template clone:
stage 1  npm ci → npm run setup → ../<project name> (project files only, own git history, .env)
                → npm ci → configured browsers → npm run doctor   (in the new folder)
stage 2  npm run onboard (optional) → test account in .env → npm run doctor
```

Stage 2 asks only for the test account, never on an unattended run, and can be skipped or rerun with `npm run onboard`; the AI steps (`/first-tests`) follow it and stay outside the installer.

The template clone is never modified, so it serves every new project and nothing is pushed back to the template by accident. `--in-place` converts the current folder instead, for repositories created with GitHub's "Use this template".

### No Built-In AI Provider

The template has no AI provider integration. The earlier OpenAI-based failure analysis and test design tooling, its unit tests, CLI scripts and workflow were removed: coding agents (GitHub Copilot, Claude Code) do both with the whole repository and Playwright's own evidence as context, without a separate API key, cost, model maintenance or data path to an external API. AI assistance is the agent workflow in `AGENTS.md` and the `/first-tests` commands, recorded in ADR-008.

### Project Layout

Everything the template owns lives under one folder, `framework/`, with the running code in `framework/core/`, so a project sees at a glance what is its own and a template update can replace that folder as a whole:

```text
framework/       template-owned; replaced as a whole on a template update
  core/          the framework itself, imported as @framework/...
  templates/     golden templates and their catalogue (index.json)
  tools/         doctor, lint, ci-plan, sync-ci-secrets
  docs/          standards, architecture, ADRs
src/             project-owned application layer, imported as @app/...
tests/           project-owned specs
config/          project-owned configuration and approved examples
```

Imports go through the `@framework/` and `@app/` aliases from `tsconfig.json`, so golden templates and generated code do not depend on directory depth. `AGENTS.md`, `.github/` and `.vscode/` stay at the root because tools look for them there.

Setup configures no login and installs no tests. Login and roles are configured with the first tests, because they need evidence from the application; credentials stay with the human (`.env`, GitHub secrets), and `npm run qa:sync-ci-secrets` adds the role secrets to the workflows. Test creation after installation is tool-neutral: humans or any AI tool follow `AGENTS.md`, the golden templates, and the same lint, typecheck, CI, and review gates.

### Reference Implementation

UPEX stays in this repository as the reference implementation, alongside the template. It owns the canonical files, so the round-trip check and the UPEX CI keep proving the golden templates against working code. A separate pilot repository was considered and rejected: for a single maintainer it doubles secrets, package permissions and update merges without adding validation.

`npm run setup` replaces the UPEX paths listed in `framework/setup/project-files.json`, together with template-only files such as the setup self-test, with the starter files in every new project. The original pre-template framework is preserved at tag `upex-original-v1.0`.

---

## Scope

### v1.0

- framework/app split with no behavior change;
- validated configuration, environment permissions, required `TEST_ENV`;
- `bearer` and `nextAuth` authentication strategies;
- golden templates, index, catalogue, editor snippets, round-trip check;
- `setup`, `doctor`, `qa:sync-ci-secrets`;
- architecture lint rules in the CI quality gate;
- short `AGENTS.md` and a tool-neutral first-tests prompt;
- generic GitHub Actions workflows installed by `setup`: a quality gate, test jobs planned from the enabled modules and run in the official Playwright image against the `TEST_ENV` repository variable, and a manual performance workflow; GitHub Actions only.

### Deferred until a real project needs it

- generators, custom AST conformance checker, `sync-core`;
- additional authentication strategies;
- OpenAPI code generation and UI discovery;
- additional AI providers and CI platforms;
- npm package distribution of the core.

---

## Definition of Done

- a fresh clone passes `npm run doctor` against a new application in under 15 minutes;
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
ADR-008 → AI-assisted engineering
ADR-009 → GitHub Copilot agent pipeline
```
