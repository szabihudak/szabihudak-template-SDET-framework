---
name: test-builder
description: Implement only the human-approved test-plans/<feature>/plan.json scope, then run validation commands.
argument-hint: "Approved plan path, e.g. test-plans/login/plan.json"
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
    prompt: Validate the changes against the same approved plan JSON path and the builder's CP2 report.
    send: false
---

Before anything else, read [AGENTS.md](../../AGENTS.md) and [framework/prompts/builder.md](../../framework/prompts/builder.md), and follow them. In Build mode require the exact plan path from the human-approved planner hand-off; verify the plan pair before editing implementation files. Never edit plan JSON or its generated Markdown view.
