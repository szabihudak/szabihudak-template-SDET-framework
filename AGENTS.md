# Agent Instructions

These rules apply to every AI tool and every human contributor. Detailed reasoning lives in the documents listed below; this file holds the rules you must not break and where to look.

## Read Before Changing Code

1. `config/approved-examples.json`: this project's reviewed golden examples. Use them first.
2. `framework/templates/index.json`: the generic golden templates and when to use each.
3. `framework/docs/ARCHITECTURE.md`: layer responsibilities and execution boundaries.
4. `framework/docs/TESTING_STANDARDS.md`: implementation rules per layer and test type.
5. `framework/docs/AI_ASSISTED_QA_WORKFLOW.md`: evidence, proposal and review boundaries for AI work.
6. `framework/docs/adr/`: decisions, especially ADR-007 (template architecture).

## Workflow

```text
understand the behavior
→ find the golden example for the same responsibility (config/approved-examples.json, then framework/templates/index.json)
→ identify the layers and the execution project
→ reuse → extend → create (only what is missing)
→ propose, and wait for human review
→ implement from the golden template
→ validate (commands below)
→ human approval
```

Do not start by generating code. Do not create an abstraction for hypothetical reuse or symmetry.

## Ownership

```text
framework/     template-owned. Do not edit it in a project; change it in the template.
  core/        the framework itself (login, fixtures, schema validation, reporting)
  templates/   golden templates and their catalogue (index.json)
  tools/       doctor, lint, ci-plan, sync-ci-secrets
  prompts/     first-tests task, run by /first-tests and /first-tests-build
  docs/        standards, architecture, ADRs
src/           project-owned application layer: schemas, clients, factories,
               pages, components, mocks, fixtures.
tests/         project-owned specs.
config/        project-owned configuration and approved examples.
```

Import the framework as `@framework/...` and the application layer as `@app/...` (aliases in `tsconfig.json`). `framework/core` never imports `src` or `tests`.

## Layer Rules

| Layer                   | Owns                                                       | Never                                     |
| ----------------------- | ---------------------------------------------------------- | ----------------------------------------- |
| Schema (TypeBox)        | provider request/response contracts                        | duplicate TypeScript interfaces           |
| API client              | HTTP requests; raw responses; fail-fast setup helpers      | assertions                                |
| Factory                 | valid defaults + overrides; partial payloads               | API calls, UI, assertions, lifecycle      |
| Fixture                 | setup, state, dependencies, cleanup                        | hiding a single line of code              |
| Page / Component Object | locators and user actions for the `Page` it was built from | assertions; reuse across `Page` instances |
| Domain database client  | parameterized SQL and record mapping                       | assertions; string-interpolated SQL       |
| Mock                    | only the network behavior the scenario needs               | inventing states the UI does not support  |
| Spec                    | scenario orchestration and all assertions                  | raw locators, raw SQL, fixed waits        |

## Hard Rules

- Successful API responses: HTTP assertion → `validateSchema()` → business assertions. Never cast `response.json()`.
- Negative responses are not validated against success schemas.
- API authentication (bearer token) and browser authentication (session) are separate. Use the fixtures; use UI login only when login is the behavior under test.
- `TEST_ENV` selects the target. Database access, destructive reset and performance measurement run only where `config/environments/environments.json` allows them. Never weaken those permissions to make a test run.
- Accessibility: use the `accessibility` / `authenticatedAccessibility` fixtures and the central WCAG policy. Never suppress violations.
- Visual: native `toHaveScreenshot()` with the shared options. Never run `--update-snapshots` to make a failure pass; baselines are generated in the Docker/Linux runtime and approved by a human.
- Performance: never change thresholds or Lighthouse severities to make an unexplained failure pass. Keep setup traffic outside the measured operation.
- Never weaken an assertion, skip a test, or suppress a real failure to get a green run. Report it.
- Never invent provider behavior. When evidence is missing or conflicting, say so.
- Never commit secrets. Credentials come from `.env` (git-ignored) or CI secrets.

## Validation

Run before considering work complete:

```bash
npx prettier --check .
npm run typecheck
npm run lint:architecture
npm run qa:templates:check
npx playwright test --project=<affected project>
```

Run the affected tests against the target environment. Do not claim a command passed unless it ran and passed. If it could not run, say so.

## Golden Template Changes

Generic templates in `framework/templates/` are derived from canonical files in the reference application and must reproduce them exactly (`npm run qa:templates:check`). Change a pattern in the canonical file first, then run `npm run qa:templates:extract -- <id>` and `npm run qa:templates:build`.

In a project, register reviewed examples in `config/approved-examples.json` instead of editing `framework/templates/`.

## Documentation

Update the documentation when a change alters a layer responsibility, a golden pattern, an execution boundary, authentication, environment permissions, CI ownership or a quality gate. Consider an ADR for an architectural decision. Routine tests that follow an existing pattern need no documentation change.
