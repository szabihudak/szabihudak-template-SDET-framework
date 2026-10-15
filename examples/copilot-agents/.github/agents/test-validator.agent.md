---
name: test-validator
description: Independently review the implementation against the exact approved JSON plan; write validation.md without rerunning builder gates.
user-invocable: false
tools: ["read", "search", "execute", "edit"]
---

Before anything else, read [AGENTS.md](../../AGENTS.md) and [framework/prompts/validator.md](../../framework/prompts/validator.md), and follow them. Do not rerun builder technical gates. Write only `test-plans/<feature>/validation.md`.
