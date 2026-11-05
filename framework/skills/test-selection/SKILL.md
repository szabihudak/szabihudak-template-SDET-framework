---
name: test-selection
description: "Choose the Playwright tests a change, a pull request, case IDs, a plan or a regression level needs, with a reason for each, and run them locally or in CI. Use when deciding what to run after a change."
---

# Test selection

> Part of the example agents: change it freely in your project. Its source is `framework/skills/test-selection/` in the template repository.

Follow [AGENTS.md](../../../AGENTS.md). Every test in a selection has a reason, and nothing runs before the user confirms the run plan.

## Scopes

Only changes in this repository count; the application's own repository is out of scope.

| Scope                              | Selection                                                                                                                                                                       |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `changed [base]`                   | Changes against the default branch, or `base`, committed or not: `git diff`, then the impact rules below                                                                        |
| `pr <number or URL>`               | The pull request's changed files (`gh pr diff --name-only`), then the impact rules. Its description is a weak signal: a feature it names adds that plan's cases, marked as such |
| `cases <ID>...`                    | The tests whose titles start with these case IDs (`--grep`)                                                                                                                     |
| `feature <name>`                   | Every case of `test-plans/<name>.md`                                                                                                                                            |
| `regression [High, Medium or Low]` | The plan cases with `Regression: Yes`, optionally only those of that priority or higher                                                                                         |
| `failed`                           | The failures of the last local run (`--last-failed`)                                                                                                                            |
| `full`                             | Every project `framework/tools/ci-plan.ts` plans for the environment                                                                                                            |
| files, folders or `--project`      | Exactly what the user names                                                                                                                                                     |

### Impact rules

When in doubt, select more, never less.

| Changed                                                                                               | Selected                                                                                                                                                 |
| ----------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tests/**/*.spec.ts`                                                                                  | that spec                                                                                                                                                |
| `src/pages`, `src/components`, `src/api`, `src/data`, `src/database`, `src/mocks`                     | the specs that import it, directly or through other files: `npx playwright test --list --only-changed=<base>`                                            |
| `src/fixtures/test-fixtures.ts`                                                                       | every spec that imports the fixtures, which is usually all of them. You may suggest a narrower run by the fixtures that changed, but select the wide one |
| `test-plans/<feature>.md`                                                                             | the specs in the plan's Files table                                                                                                                      |
| `framework/`, `config/`, `playwright.config.ts`, `package.json`, `package-lock.json`, `tsconfig.json` | `full`                                                                                                                                                   |
| `.github/workflows/`                                                                                  | nothing locally; suggest a CI run                                                                                                                        |
| documentation, `test-reviews/`, `ci-analysis/`, agent files only                                      | nothing; say so                                                                                                                                          |

## Process

1. **Resolve the inputs.** For `changed` with no changes, ask what to run.
2. **Check the environment.** Read its `allow` flags. Leave out database tests where `allow.database` is false, destructive tests where `allow.destructive` is false, and performance unless the user asks for it and `allow.performance` is true; say what you left out and why. Warn that tests create data in a shared environment such as `hosted`.
3. **Select.** Apply the scope, then confirm the selection with `npx playwright test --list` and the same filters. List every test with its case ID, project and the reason it is selected.
4. **Show the run plan** and wait: the selection, the exact command, the environment, the target and the warnings. Run nothing before the user confirms.
5. **Run.**
   - **local:** `TEST_ENV=<environment> npx playwright test <filters>`, with the selection passed as files, `--grep`, `--only-changed`, `--last-failed` or `--test-list <file>` under `test-runs/<timestamp>/`.
   - **ci:** the branch must be on the remote with the changes to test; if it is not, say so and offer a local run. Start `gh workflow run playwright.yml --ref <branch> -f environment=<environment> -f projects=<comma-separated> -f grep="<case IDs joined by |>"`, then follow it with `gh run watch` and give its URL.
6. **Report.** For a local run, take each failed and flaky case, its error and its attachments from `npm run qa:failures -- --json`. Write `test-runs/<timestamp>/summary.md` from [the run summary template](test-run-summary.template.md).
