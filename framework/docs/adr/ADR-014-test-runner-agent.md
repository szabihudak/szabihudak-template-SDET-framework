# ADR-014: Test Runner Agent

## Status

Accepted

Amends ADR-010 (the optional examples gain a test runner). Setup still installs no agents.

---

## Context

Choosing what to run is the step people skip: after a change they run everything, which is slow, or one spec, which misses what the change broke. The repository already has what a selection needs:

- Playwright selects by changed files and their imports (`--only-changed`), by title (`--grep`), by a list (`--test-list`), by the last failures (`--last-failed`) and by project;
- every test title starts with its plan case ID, and the plans record each case's priority and regression decision;
- `framework/tools/ci-plan.ts` decides which projects CI runs for an environment, and the environments' `allow` flags decide where database, destructive and performance tests may run.

A CI run of only some projects or cases was not possible: the generated Playwright workflow had no inputs for a manual run.

---

## Decision

`examples/copilot-agents/` gains a fifth optional agent, **test-runner**:

```text
scope · target · environment ──▶ test-runner ──▶ selection with reasons ──▶ you confirm ──▶ local run or CI run ──▶ test-runs/<timestamp>/summary.md
```

- **Scopes:** changes against the default branch (the default; when nothing changed it asks), a pull request of this repository, case IDs, a feature's plan, the regression cases by priority, the last failures, a full run, or files and projects named by the user. Changes in the application's own repository are out of scope.
- **Impact rules** map changed files to specs and prefer the wider selection: shared fixtures, the framework and the configuration select a full run.
- It shows the selection, each test with its reason, the command, the environment and the warnings, and runs nothing before the user confirms. It respects the environment's `allow` flags and leaves out what they forbid.
- **Targets:** a local `npx playwright test`, or a manual run of the generated Playwright workflow through the GitHub CLI.
- It changes no code and never makes a run green: no snapshot updates, retries, timeouts or skips. It writes only `test-runs/<timestamp>/`, git-ignored, and reports a run that selected nothing as empty, not passed. The Playwright HTML report, `results.json`, the attachments, the CI job summary and the artifacts stay as they are; the summary links to them.

The generated Playwright workflow (`framework/setup/starter/.github/workflows/playwright.yml`) gains three optional `workflow_dispatch` inputs, so a manual run can be narrowed:

- `environment`: the `TEST_ENV` to test against; empty keeps the repository variable;
- `projects`: comma-separated Playwright projects. `ci-plan.ts` reads them as `CI_PROJECTS`, keeps only those of its plan and refuses names it does not plan, such as `performance`;
- `grep`: a title filter such as `T001_Login_API|T004_Task_API`. The test step passes it to Playwright with `--pass-with-no-tests`, because a filter can leave a project of the matrix without tests.

Inputs reach the shell as environment variables, never inlined into a script, so an input cannot inject commands. Pushes and pull requests run as before. The template repository's own workflow, which builds and runs the reference application, is unchanged.

---

## Consequences

### Positive

- A change runs the tests it can affect, with the reason for each, before it reaches CI.
- The same selection can run in CI, in the same image and environment as every other CI run.
- A run cannot be made green by the runner.

### Trade-offs

- A selection by changed files is only as good as the import graph and the impact rules; a test that depends on a change without importing it, such as through shared application data, is missed unless the run is wide.
- `--pass-with-no-tests` makes an empty manual run green in CI; the runner reports it as empty.
- A CI run needs the branch on the remote and the GitHub CLI signed in with permission to run workflows.
- One more example agent to keep current with the Copilot agent format; the self-test checks the workflow inputs and `ci-plan.ts`, not the agent.

---

## Related Decisions

```text
ADR-010 → agents outside the template
ADR-013 → CI failure analyst agent
```
