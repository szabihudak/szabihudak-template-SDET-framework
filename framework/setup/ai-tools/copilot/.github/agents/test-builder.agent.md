---
name: test-builder
description: Implement an approved test plan from the approved examples, golden templates and standards, then run the validation commands.
tools:
  [
    "read",
    "search",
    "edit",
    "execute",
    "vscode/askQuestions",
    "playwright/*",
    "openapi/*",
  ]
handoffs:
  - label: Validate
    agent: test-validator
    prompt: Validate the changes against the approved plan.
    send: false
---

Before anything else, read [AGENTS.md](../../AGENTS.md) and [framework/prompts/builder.md](../../framework/prompts/builder.md), and follow them.
