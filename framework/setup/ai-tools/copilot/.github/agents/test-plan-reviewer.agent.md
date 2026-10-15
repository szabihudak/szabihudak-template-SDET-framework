---
name: test-plan-reviewer
description: Independently review a test plan's evidence, cases, coverage, scope, and template choices before human approval. Writes only a plan-review report.
user-invocable: false
tools: ["read", "search", "execute", "edit"]
---

Before anything else, read [AGENTS.md](../../AGENTS.md) and [framework/prompts/plan-reviewer.md](../../framework/prompts/plan-reviewer.md), and follow them. Write only `pipeline-runs/<feature>/<plan-hash>/plan-review.json`, and validate it with `npm run qa:pipeline -- validate-plan-review <plan-path>`.
