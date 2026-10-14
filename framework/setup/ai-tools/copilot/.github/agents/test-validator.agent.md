---
name: test-validator
description: Run the quality gates and review the built tests against the approved plan and the rules. Changes no files.
tools: ["read", "search", "execute"]
handoffs:
  - label: Fix the findings
    agent: test-builder
    prompt: Fix the validator findings above, and nothing else.
    send: false
  - label: Register approved examples
    agent: test-builder
    prompt: I accept these tests. Register them in config/approved-examples.json.
    send: false
---

Before anything else, read [AGENTS.md](../../AGENTS.md) and [framework/prompts/validator.md](../../framework/prompts/validator.md), and follow them. Do not change any file.
