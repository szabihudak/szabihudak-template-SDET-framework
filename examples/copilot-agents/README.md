# Example: GitHub Copilot test agents

Six optional agents for VS Code with GitHub Copilot. Setup includes only the ones you choose, none by default: a project works without agents, and any tool that follows `AGENTS.md` writes code the checks accept ([ADR-010](../../framework/docs/adr/ADR-010-agents-outside-the-template.md), [ADR-015](../../framework/docs/adr/ADR-015-project-generator-and-configurator.md)). The reviewer is described in [ADR-012](../../framework/docs/adr/ADR-012-test-reviewer-agent.md), the CI failure analyst in [ADR-013](../../framework/docs/adr/ADR-013-ci-failure-analyst-agent.md), the test runner in [ADR-014](../../framework/docs/adr/ADR-014-test-runner-agent.md), the pull request opener and the analyst's attempts and local runs in [ADR-016](../../framework/docs/adr/ADR-016-pr-opener-agent.md). [agent-workflow-v3.svg](agent-workflow-v3.svg) shows how they work together, with the skills each one follows and the commands it runs. Each agent holds its role, permissions and checkpoint; the procedures it follows and the templates of what it writes are skills in [framework/skills](../../framework/skills), which setup installs in `.github/skills/` with the agent ([ADR-017](../../framework/docs/adr/ADR-017-agent-skills.md)).

```text
test-planner ──▶ test-plans/<feature>.md ──▶ you approve ──▶ test-builder ──▶ validation commands ──▶ test-reviewer ──▶ test-reviews/<feature>.md ──▶ pr-opener ──▶ you confirm ──▶ draft pull request ──▶ CI

scope · target · environment ──▶ test-runner ──▶ you confirm ──▶ local or CI run ──▶ test-runs/<timestamp>/summary.md

failed CI run attempt or local run ──▶ ci-failure-analyst ──▶ ci-analysis/<run-id>/attempt-<n>/analysis.md ──▶ you decide and act
```

| Agent                  | Does                                                                                                                                                     | Changes files                                                                         |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| **test-planner**       | Collects evidence, writes one Markdown plan with a source for every expected result, waits                                                               | `test-plans/<feature>.md`                                                             |
| **test-builder**       | Implements the approved plan from the golden templates, runs the AGENTS.md validation commands                                                           | The plan's listed files only                                                          |
| **test-reviewer**      | Compares the tests with the plan: cases, no green-washing, structure, layer boundaries, scope                                                            | `test-reviews/<feature>.md`                                                           |
| **test-runner**        | Selects the tests a change, plan or request needs, with a reason for each; runs them locally or in CI after you confirm                                  | `test-runs/<timestamp>/` (git-ignored)                                                |
| **ci-failure-analyst** | Analyzes the failed jobs of the latest or a given CI run attempt, or the last local run; one finding per root cause: env, app, test, pipeline or unknown | `ci-analysis/<run-id>/attempt-<n>/` or `ci-analysis/local-<timestamp>/` (git-ignored) |
| **pr-opener**          | Checks that the change is the reviewed one, commits it on a new branch, pushes it and opens a draft pull request after you confirm                       | Git commit and branch; changes no files                                               |

## Use in a project

Setup asks which agents to include and copies them to `.github/agents/`: the build pipeline (test-planner, test-builder and test-reviewer, which hand work to each other), test-runner, ci-failure-analyst and pr-opener. In an answers file, list them under `agents`. To add them to an existing project, from its folder, with the template next to it:

```bash
mkdir -p .github/agents .github/skills
cp ../<template-folder>/examples/copilot-agents/.github/agents/*.agent.md .github/agents/
cp -R ../<template-folder>/framework/skills/* .github/skills/
```

Open the project in VS Code, select **test-planner** in Copilot Chat and name the environment, role, feature and test type. Approve the plan with **Build the approved plan**. After the build, start the review with **Review the tests**; send Implementation findings back with **Fix the findings** and Plan findings with **Revise the plan**. Commit the review report with the tests so the pull request reviewer sees it. With a PASS review, select **pr-opener** with the plan: it shows the branch, files, commit and pull request it would create, and after you confirm commits on a new branch, pushes and opens a draft pull request. It needs the GitHub CLI signed in with permission to push and to create pull requests; it never merges.

To run tests, select **test-runner** and name the scope (`changed`, `pr 42`, `cases T001_Login_API`, `feature login`, `regression High`, `failed`, `full` or files), the target (`local` or `ci`) and the environment; without a scope it runs what changed against the default branch. A CI run starts the Playwright workflow by hand with its `environment`, `projects` and `grep` inputs and needs the branch pushed and the GitHub CLI signed in with permission to run workflows.

When a CI run fails, select **ci-failure-analyst** and give it the run URL, or nothing for the latest run. A rerun keeps its run ID: the analyst takes the latest attempt, or the one you name (`attempt 2`), and writes one report per attempt. For the last local run, give it `local`. It needs the GitHub CLI signed in with read access to the repository's Actions (`gh auth login`). It fixes nothing; the analysis names the owner of each fix.

These files are an example, not part of the framework: the self-test checks that setup copies the chosen ones but does not run them, and you can change them freely in your project.
