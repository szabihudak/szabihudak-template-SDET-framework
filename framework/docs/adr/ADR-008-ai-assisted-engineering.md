# ADR-008: AI-Assisted Engineering

## Status

Accepted

Amended by ADR-009 (the `/first-tests` prompts and Claude Code files were replaced by Copilot agents) and ADR-010 (setup installs no agents; projects choose their own). The principles below are unchanged.

---

## Context

AI coding agents can design, write and review tests, but they produce plausible code that can drift from the framework's patterns, invent provider behavior, or claim validation that did not happen. The framework needs a way to use them that keeps the architecture, the evidence and the approval with the repository and the human.

The approach was validated in proofs of concept against the UPEX DOJO reference implementation, recorded in `framework/docs/portfolio/AI_ASSISTED_QA_VALIDATION.md`.

---

## Decision

### Agents, not a provider integration

The framework has no AI provider integration (ADR-007). Test design, implementation, review and failure analysis are done by coding agents, such as GitHub Copilot and Claude Code, with the repository as context. There is no separate API key, cost or data path.

### One rule file

`AGENTS.md` holds the rules for every agent and contributor. It is loaded automatically: through `CLAUDE.md` in Claude Code and through `.github/copilot-instructions.md` in Copilot. Detail comes from the `TESTING_STANDARDS.md` section each golden template links to. Agents never need the full set of documents.

### Review first

```text
evidence and golden example
→ proposal
→ human review
→ implementation from the golden template
→ deterministic validation
→ human approval
```

An agent proposes before it changes files, and its output is a proposal until it passes review and the validation commands. `/first-tests` runs discovery and the proposal with the edit tools disabled; `/first-tests-build` implements only an approved proposal.

### Evidence by source

An agent keeps three kinds of evidence apart and marks anything it could not verify:

```text
repository        → architecture, ownership, golden templates
provider contract → OpenAPI, read through OpenAPI MCP
running app       → pages, roles, behavior, observed through Playwright MCP
```

Evidence about the application never decides the structure of the code. OpenAPI MCP reads contracts; scenario-relevant invocation is permitted only for exploratory discovery when the selected environment has `allow.interactiveDiscovery: true`. Playwright MCP may submit relevant forms under the same permission. Both remain limited to test-owned data and non-destructive actions; deletion, resets and irreversible actions require explicit human approval and are not part of planner discovery. Requirements define intended behavior when present. Without requirements, observed/contract behavior is labeled as characterization rather than assumed correct.

### Golden template compliance

Following a golden template means the same behavior, architecture, structure and style: test placement, layer ownership, fixture and factory usage, naming, interaction patterns and assertion placement.

---

## Validation

The proofs of concept used GitHub Copilot and Copilot agent mode against UPEX:

- **Assisted generation:** a negative create-task test for an unsupported priority. Human review narrowed a whole-object cast to a single-field type escape, then Prettier, typecheck and the targeted run passed.
- **Agent review:** asked to validate the same test, the agent inspected the owning layers, ran the validation, and correctly concluded that no change was needed. It reported the error-message detail it could not confirm instead of asserting it.
- **OpenAPI MCP:** the agent found the machine-readable contract and reported method, path, required fields, allowed values, statuses and authentication, separately from the repository evidence, without calling the API.
- **Playwright MCP:** the agent explored the task-creation dialog and reported an accessibility-tree inconsistency as an uncertainty rather than inventing structure. The resulting UI test first put an input action in the spec; review moved it into the Page Object, the established pattern, and the test passed in Chromium.

The review step caught drift in both generation runs; that is the main reason review and structural compliance are part of the decision.

Cursor was not evaluated. Claude Code follows the same `AGENTS.md` workflow but was not part of these runs.

---

## Consequences

### Positive

- One set of rules for people and every agent, enforced partly by `lint:architecture` and `qa:templates:check`.
- Provider facts and repository assumptions are reported separately, so invented behavior is easier to spot.
- Agents spend context on the rules and sections a task needs.

### Trade-offs

- Every change still needs human review; the agent does not approve its own work.
- Rules that cannot be checked mechanically depend on the agent following `AGENTS.md` and on review.
- MCP servers are optional; without them an agent reads the contract over HTTP and has no browser evidence.

---

## Related Decisions

```text
ADR-007 → reusable template architecture, no AI provider integration
```
