# ADR-010: Agents Outside the Template

## Status

Accepted

Supersedes ADR-009. Amends ADR-007 and ADR-008.

---

## Context

ADR-009 installed four GitHub Copilot agents into every project: a planner and a builder, each with a verifier subagent, connected by a JSON plan, two hash-bound reports and the `qa:plan` and `qa:pipeline` checkers. In use:

- most template changes went into the prompts and the pipeline tooling, and Copilot's agent format changes faster than the framework;
- the self-test pinned prompt phrases, so a wording change in a prompt was a framework change;
- engineers new to the pipeline got stuck in review loops of a process they had not written;
- the gates that reject wrong code (`lint:architecture`, `qa:templates:check`, typecheck, the tests, CI) are deterministic and do not depend on any agent.

---

## Decision

Setup installs no AI agents. The template keeps what every project needs whatever tool writes its code:

- the framework, the golden templates, `TESTING_STANDARDS.md` and `ARCHITECTURE.md`;
- `AGENTS.md`, loaded by GitHub Copilot through `.github/copilot-instructions.md`;
- `.vscode/mcp.json` with the Playwright and OpenAPI MCP servers;
- the deterministic gates and CI.

Writing agents is the project engineer's choice. `examples/copilot-agents/` holds two optional agents, a planner that writes one Markdown plan (`test-plans/<feature>.md`, a source for every expected result) and a builder that implements an approved plan and runs the `AGENTS.md` validation commands. They need no tooling of their own. The approval of the code is the pull request and its CI run.

The ADR-009 pipeline remains in the history at commit `e9edbfc`. A structured plan or a review agent returns only when real use shows a defect the simple flow does not catch.

---

## Consequences

### Positive

- The framework no longer changes with the Copilot agent format; the self-test checks the framework, not prompt wording.
- Projects have no plan or report tooling to learn; any tool that follows `AGENTS.md` produces code the gates accept.
- The example agents are short enough to read and change in one sitting.

### Trade-offs

- No independent plan review or implementation review by default; human review of the plan and the pull request replace them.
- Plans are Markdown without a schema, hash or scope check.
- Login is configured by hand in `config/framework.config.ts`, guided by the project README and `npm run doctor`, instead of being proposed by the planner.
- Projects may use different agent flows. The self-test does not run the examples, so they can fall behind Copilot changes.
- Projects that copy the new `framework/` must remove the `qa:plan` and `qa:pipeline` steps from their workflows.

---

## Related Decisions

```text
ADR-007 → reusable template architecture
ADR-008 → AI-assisted engineering
ADR-009 → Copilot agent pipeline (superseded)
```
