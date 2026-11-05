# ADR-016: Pull Request Opener, Analyst Attempts and Local Runs

## Status

Accepted

Amends ADR-010 (the optional examples gain a pull request opener), ADR-013 (the CI failure analyst reports per run attempt and analyzes local runs) and ADR-015 (setup offers the pull request opener). Setup still includes no agents by default. Amended by ADR-017 (the agents' procedures and output formats are skills). Amended by ADR-018 (the hand-off proposes golden examples).

---

## Context

Trying the example agents in a generated project showed three gaps:

- After a PASS review the change was committed and pushed by hand. The review report was not formatted, and the project's pre-push hook (`format:check`) rejected the push.
- A rerun of a failed CI run keeps the run ID and raises its attempt number. The CI failure analyst wrote `ci-analysis/<run-id>/analysis.md`, so the analysis of attempt 2 had nowhere of its own to go: the file still held attempt 1, while the chat summary named it as the new report.
- A failed local run had no root cause analysis; test-runner only pointed to the report and the trace.

---

## Decision

### pr-opener

`examples/copilot-agents/` gains a sixth optional agent, **pr-opener**, chosen alone in setup:

```text
test-reviewer (PASS) ──▶ pr-opener ──▶ hand-off plan ──▶ you confirm ──▶ branch · commit · push ──▶ draft pull request ──▶ CI
```

- It starts only from a PASS review that is newer than every file of the change, and only with the plan's `create` and `extend` files, the plan and the review report in the change. Any other changed file stops it.
- It runs the validation commands that need no environment (format, typecheck, architecture lint, template check); the tests run in CI on the pull request.
- It shows the branch, the files, the commit message and the pull request before it writes anything, then commits each file by name on a new branch, pushes and opens a **draft** pull request with the plan, the review and the case IDs.
- It never commits to the default branch, never uses `--no-verify` or a force push, and never merges, approves, marks ready or changes settings. The pull request and its CI run stay the approval (ADR-010).
- It has no hand-off from test-reviewer: a hand-off button to an agent the project did not choose would not work, so the reviewer's CP3 names it, and the build pipeline stays a choice of three.

### Planner and reviewer output

test-planner and test-reviewer run `npx prettier --write` on the plan and the review report they write, because both are committed and the pre-push hook checks them.

### CI failure analyst

- **Attempts:** the analyst takes the latest attempt, or the one named in the URL or the request, uses only the job IDs of that attempt and writes `ci-analysis/<run-id>/attempt-<n>/analysis.md` with its artifacts beside it. An artifact created before the attempt started is not evidence for it. The report compares its findings with the reports of earlier attempts.
- **Verification:** the analyst reads its report back before the summary and does not name a report it could not write.
- **Local runs:** `local` analyzes `test-results/results.json` and its attachments, writes `ci-analysis/local-<timestamp>/analysis.md` and has no pipeline cause. test-runner names it as the next step after a local failure when the project has it.

The agent keeps its name, so answers files that list `ci-failure-analyst` stay valid.

### Checks as code

What can be decided without judgement is a script in `framework/tools/agent-checks/`, not a paragraph of an agent's prompt. The agents run the script and act on its result; they decide only what needs judgement, such as a failure's cause.

| Command                    | Used by                         | Decides                                                                                                                                                        |
| -------------------------- | ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run qa:handoff-check` | pr-opener                       | whether a reviewed change may be handed off: PASS review, newer than every changed file, only the plan's files, the plan and the review; the files to commit   |
| `npm run qa:run-attempt`   | ci-failure-analyst              | one attempt of a run: its status, failed and skipped jobs, the artifacts of this attempt and of earlier ones, its report folder and the earlier reports        |
| `npm run qa:failures`      | ci-failure-analyst, test-runner | the failed and flaky tests of a `results.json`, with case IDs, errors, attempts and which attachments exist, also for a CI artifact downloaded to this machine |

They only read, print a summary or `--json`, and exit with 1 when the hand-off must stop or there is nothing to read. Their tests (`framework/tools/agent-checks/tests/`) run in the self-test; `qa:run-attempt` is tested on recorded GitHub API responses, not on a live run. A person can run them too, without an agent.

---

## Consequences

### Positive

- Reviewed tests reach a draft pull request without hand-made commits that miss a file or include `.env`.
- The checks the agents depend on are tested in CI; a prompt change cannot break them.
- Every attempt of a run has its own analysis, and a summary never points to a stale report.
- A local failure gets the same analysis as a CI failure.

### Trade-offs

- pr-opener needs the GitHub CLI signed in with permission to push and to create pull requests.
- The review freshness check compares file modification times; a change that keeps a file's time, such as a checkout, is not detected.
- Earlier reports in `ci-analysis/<run-id>/analysis.md` stay where they are; the analyst neither moves nor reads them.
- One more example agent to keep current with the Copilot agent format; the self-test checks that setup copies it, not what it does.

---

## Related Decisions

```text
ADR-010 → agents outside the template
ADR-012 → test reviewer agent
ADR-013 → CI failure analyst agent
ADR-014 → test runner agent
ADR-015 → project generator, agent choice and configurator download
```
