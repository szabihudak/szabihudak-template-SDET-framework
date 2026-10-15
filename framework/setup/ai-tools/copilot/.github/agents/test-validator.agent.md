---
name: test-validator
description: Independently review a passing builder report and implementation against the exact approved JSON plan; write a validation report without rerunning builder gates.
user-invocable: false
tools: ["read", "search", "execute", "edit"]
---

Before anything else, read [AGENTS.md](../../AGENTS.md) and [framework/prompts/validator.md](../../framework/prompts/validator.md), and follow them. Do not rerun builder technical gates. Write only `validation-report.json` in the build report's attempt directory.
