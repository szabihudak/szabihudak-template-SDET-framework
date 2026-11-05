---
name: validation-gates
description: "Run the validation commands (Prettier, typecheck, architecture lint, template check, the affected Playwright project), act on their failures and report each result truthfully. Use before calling a change done, and when a check fails."
---

# Validation gates

> Template-owned: change this skill in the template repository (`framework/skills/validation-gates/`), not in a project.

The commands every change runs, and the rule that only a command that ran and passed counts, are in [AGENTS.md](../../../AGENTS.md) under Validation. This skill is how to run them and what to do with what they report.

## Run

1. `npx prettier --check .`. On failure, format the files you changed with `npx prettier --write <files>`; never reformat files you did not change. The pre-push hook runs the same check.
2. `npm run typecheck`.
3. `npm run lint:architecture`. Every problem names the rule it enforces, such as `(AGENTS.md#layer-rules)`: read that rule and fix the code, never the rule, and never with a disable comment. On a test plan, `plan-*` problems are the plan format; `planned-case-id-in-test-title` stays red until the specs exist.
4. `npm run qa:templates:check`.
5. `TEST_ENV=<environment> npx playwright test --project=<affected project>`, narrowed to a planned feature with `--grep "<case IDs joined by |>"`.

## When a check fails

- Fix what fails in your own change. Report a failure you did not cause, with the evidence you inspected.
- When a response contradicts the plan's expected result or the contract (a status, a field, a value), stop: do not change the expected result, the schema or the assertion. Report the case, the expected and the actual value and the source of each ([AGENTS.md](../../../AGENTS.md), Hard Rules).
- Never weaken an assertion, skip a test, add a fixed wait, raise a timeout or update a snapshot to get a green run. Switching a whole-object comparison to `expect.objectContaining` or `toMatchObject`, or adding a field to a schema because a response has it, is weakening.
- For a failed Playwright run, `npm run qa:failures` lists each failed and flaky test with its error and evidence; the playwright-failure-triage skill finds the cause.

## Report

| Command   | Result                              |
| --------- | ----------------------------------- |
| <command> | passed / failed / not run: <reason> |

A command that could not run is `not run`, with the reason; never `passed`.
