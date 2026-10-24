# Example: GitHub Copilot test agents

Three optional agents for VS Code with GitHub Copilot. Setup does not install them: a project works without agents, and any tool that follows `AGENTS.md` writes code the checks accept ([ADR-010](../../framework/docs/adr/ADR-010-agents-outside-the-template.md)). The reviewer is described in [ADR-012](../../framework/docs/adr/ADR-012-test-reviewer-agent.md).

```text
test-planner ──▶ test-plans/<feature>.md ──▶ you approve ──▶ test-builder ──▶ validation commands ──▶ test-reviewer ──▶ test-reviews/<feature>.md ──▶ your pull request ──▶ CI
```

| Agent             | Does                                                                                           | Changes files                |
| ----------------- | ---------------------------------------------------------------------------------------------- | ---------------------------- |
| **test-planner**  | Collects evidence, writes one Markdown plan with a source for every expected result, waits     | `test-plans/<feature>.md`    |
| **test-builder**  | Implements the approved plan from the golden templates, runs the AGENTS.md validation commands | The plan's listed files only |
| **test-reviewer** | Compares the tests with the plan: cases, no green-washing, structure, layer boundaries, scope  | `test-reviews/<feature>.md`  |

## Use in a project

From the project folder, with the template next to it:

```bash
mkdir -p .github/agents
cp ../<template-folder>/examples/copilot-agents/.github/agents/*.agent.md .github/agents/
```

Open the project in VS Code, select **test-planner** in Copilot Chat and name the environment, role, feature and test type. Approve the plan with **Build the approved plan**. After the build, start the review with **Review the tests**; send Implementation findings back with **Fix the findings** and Plan findings with **Revise the plan**. Commit the review report with the tests so the pull request reviewer sees it.

These files are an example, not part of the framework: the self-test does not run them, and you can change them freely in your project.
