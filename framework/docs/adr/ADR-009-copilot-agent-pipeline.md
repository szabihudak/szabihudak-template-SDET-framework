# ADR-009: GitHub Copilot Agent Pipeline

## Status

Accepted

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

Generated projects use three GitHub Copilot custom agents, installed by `npm run setup` into `.github/agents/`:

```text
test-planner  ──[Build the approved proposal]──▶  test-builder  ──[Validate]──▶  test-validator
 writes only the validated plan pair,             implements from the            read-only: runs the gates,
 requirements-led or exploratory;                approved examples, golden      reviews against the rules,
 ends with an Approved scope                     templates and standards        cites a rule for every finding
        ▲                                                                                │
        └───────────── FAIL: [Fix the findings] → test-builder ◀────────────────────────┤
                       PASS: [Register approved examples] → test-builder ◀──────────────┘
```

- Every hand-over is a button the user clicks (`send: false`); the click is the approval.
- The planner has edit capability only for the plan artifact by instruction; the validator has no edit tools. The planner's allowed filesystem scope is policy-enforced, not technically sandboxed.
- The task logic lives in `framework/prompts/planner.md`, `builder.md` and `validator.md`; the agent files stay short and name AGENTS.md and their task file.
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
- The planner and the validator need the terminal (`npm run doctor`, the checks), so their read-only guarantee is strong but not absolute.
- Projects created earlier keep their Claude Code files and `/first-tests` prompts until they copy the new agent files.

---

## Related Decisions

```text
ADR-007 → reusable template architecture
ADR-008 → AI-assisted engineering
```
