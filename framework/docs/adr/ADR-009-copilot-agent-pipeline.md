# ADR-009: GitHub Copilot Agent Pipeline

## Status

Superseded by ADR-010: setup no longer installs the agents. The pipeline below is the state of commit `e9edbfc`.

Amends ADR-007 (setup no longer asks for an AI tool) and ADR-008 (the commands and the way the rules are loaded).

---

## Context

Generated projects supported two AI tools, Claude Code and GitHub Copilot, through two prompts: `/first-tests` (read-only planning) and `/first-tests-build` (implementation). In use, this showed four problems:

- every agent feature needed separate entry files, MCP configuration, setup options and self-test scenarios per tool;
- the build step found the approved proposal only because it was still in the same chat, so the hand-over was implicit and broke in a new session;
- read-only planning was enforced only during the command's own turn, not for follow-up messages;
- running the checks and reviewing the result depended on the builder remembering to do it.

GitHub Copilot custom agents combine instructions, allowed tools and explicit hand-overs to other agents, which addresses all four.

---

## Decision

Generated projects use four GitHub Copilot custom agents, installed by `npm run setup` into `.github/agents/`. Two of them are verifiers that run as subagents, one before and one after implementation:

```text
test-planner ──subagent──▶ test-plan-reviewer          writes review.md (semantic review)
     │  FAIL: planner revises the plan (at most three cycles; asks the human at once
     │        when a finding needs a fact only the human can supply)
     │  PASS: CP1, the human approves this plan version
     ▼
[Build the approved proposal]
     ▼
test-builder ──technical gates, qa:pipeline scope──▶
     └──subagent──▶ test-validator                     writes validation.md
                       implementation finding → test-builder fixes (at most three cycles)
                       plan finding           → [Revise the plan] → test-planner → review → CP1 again
                       environment finding    → reported to the human
                       PASS                   → human review → [Register approved examples]
```

- The two verifiers have separate roles. The plan reviewer checks what the plan linter (`qa:plan`) cannot: that expected results follow from cited sources, that coverage and N/A decisions agree with the evidence, and that the scope does not contradict itself. The implementation validator compares the diff, the implemented tests and the build report with the approved plan; it does not rerun the builder's technical gates.
- Reports are files, not chat summaries: `test-plans/<feature>/review.md` and `validation.md`, Markdown for the human with a fixed header (`Plan SHA-256:`, `Verdict:`), one line per required check and one heading per finding. Each new cycle replaces the file; git keeps the history. `npm run qa:pipeline` takes only the feature name: `review` and `validation` pass only for a PASS report of the current plan hash, and `scope` also requires that git shows no changed file outside the plan. A revised plan has a new hash, so an earlier review or approval never applies to it.
- The builder records the technical gates in its final chat report rather than in a report file; CI reruns the same gates. The hand-off buttons always show, so the builder itself refuses a plan whose review did not pass and registers examples only after a passing validation.
- Each subagent is invoked with one fixed line naming the plan, so the caller cannot steer the review, and the verifiers ignore anything else in the invocation.
- The human decisions are the plan approval at CP1 and the final acceptance; the hand-overs between them are buttons the user clicks (`send: false`), and the click is the approval. The builder invokes the validator without a human checkpoint in between.
- The planner-to-builder hand-off identifies the approved `test-plans/<feature>/plan.json`; the builder checks the JSON/Markdown pair and uses JSON, not a chat summary, as its scope authority.
- The builder does not edit plan JSON or its generated Markdown. A scope change returns to planning and requires renewed human approval.
- The planner edits only the plan artifact, and the two verifiers write only their own report; these filesystem scopes are policy-enforced, not technically sandboxed. The verifiers are not user-invocable and have no hand-off buttons.
- The task logic lives in `framework/prompts/planner.md`, `plan-reviewer.md`, `builder.md` and `validator.md`; the agent files stay short and name AGENTS.md and their task file.
- `AGENTS.md`, `TESTING_STANDARDS.md`, the golden templates and the linter stay tool-neutral Markdown and code.
- Setup no longer asks for an AI tool. It installs `.github/copilot-instructions.md`, the agents and `.vscode/mcp.json` (Playwright MCP, and the OpenAPI MCP server when a contract URL is given). The Claude Code files and the `/first-tests` prompts are removed.
- The validator does not replace CI; CI remains the independent final check.

Work on the template repository itself is unaffected and can use any tool.

---

## Consequences

### Positive

- One set of agent files; fewer setup options and self-test scenarios.
- The hand-over from planning to building to validation is explicit, and each step waits for the user.
- Read-only planning and validation hold for the whole conversation.
- Checking and review are a separate role, and the same agents serve every later test, not only the first ones.

### Trade-offs

- Generated projects expect VS Code with GitHub Copilot. Another tool can still follow `AGENTS.md` and the task files, without the agents and hand-overs.
- Custom agents and hand-overs are a recent Copilot feature; their syntax and behavior may change and are verified in a generated project.
- The planner and the verifiers need the terminal (`npm run doctor`, the checks) and the verifiers need edit access for their report, so their read-only guarantee is strong but not absolute.
- A verifier is another model reading the same evidence; it reduces but does not replace human review, and CI remains the independent run of the technical gates.
- Projects created earlier keep their Claude Code files and `/first-tests` prompts until they copy the new agent files.

---

## Related Decisions

```text
ADR-007 → reusable template architecture
ADR-008 → AI-assisted engineering
```
