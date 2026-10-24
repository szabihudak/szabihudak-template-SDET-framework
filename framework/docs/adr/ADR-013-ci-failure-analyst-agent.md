# ADR-013: CI Failure Analyst Agent

## Status

Accepted

Amends ADR-010 (the optional examples gain a CI failure analyst). Setup still installs no agents.

---

## Context

When a CI run fails, someone reads the job log, downloads the `test-results-<job>` and `playwright-report-<job>` artifacts, opens screenshots, videos and traces, reads the application log and decides whether the environment, the application, the test or the pipeline is at fault. The evidence is spread over several places, and two traps recur:

- a failure blamed on the test is made green, although the application is wrong;
- an artifact nobody opened is cited as evidence.

`AGENTS.md` already requires failure analysis to name the evidence it inspected. The test title starts with its plan case ID, so a failed test leads to its plan row, its expected result and that result's source.

---

## Decision

`examples/copilot-agents/` gains a fourth optional agent, **ci-failure-analyst**, independent of the planner, builder and reviewer:

```text
CI run ──▶ ci-failure-analyst ──▶ ci-analysis/<run-id>/analysis.md ──▶ you decide and act
```

- It analyzes the given run, or the latest one; when that run succeeded, it says so and stops.
- For every failed job it reads the log and downloads the artifacts with the GitHub CLI, groups failures with one root cause, and decides the cause: `env`, `app`, `test`, `pipeline` or `unknown`, with a confidence and the evidence it opened. Flaky, a test that passed on a retry, is a flag, not a cause. An `app` verdict needs the plan's Source or the contract.
- Every finding names the job, the cause, the failed case with its expected and actual result, the analysis, the verdict, a suggested fix with its owner, and links to the log lines, artifacts, screenshots, videos and traces.
- It changes nothing: no fixes, reruns, comments or issues. It writes only under `ci-analysis/<run-id>/`, which is git-ignored, because traces and videos can contain session data.
- It has no hand-offs. There is no healer agent: only a `test` cause is fixed in test code, and fixing a test because it fails invites green-washing; the person who reads the analysis decides who acts.
- CI is unchanged. Traces are kept on the first retry only, so a failure without a retry has none; the analysis says when this leaves the cause `unknown`.

---

## Consequences

### Positive

- One report per failed run gathers the evidence and links it to the plan.
- The categories separate what the test team fixes from what goes to developers, infrastructure or CI.
- The agent cannot make a failing test green.

### Trade-offs

- It needs the GitHub CLI signed in with read access to the repository's Actions.
- Artifacts are kept for 7 days; an older run can be analyzed from its logs only.
- A model reading logs can misjudge a cause; the confidence and the evidence list let the reader check it.
- One more example agent to keep current with the Copilot agent format; the self-test does not run it.

---

## Related Decisions

```text
ADR-010 → agents outside the template
ADR-012 → test reviewer agent
```
