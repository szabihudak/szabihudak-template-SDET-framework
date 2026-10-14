---
name: test-planner
description: Plan and design Playwright tests from the project's rules, approved examples, golden templates and the running application. Changes no files.
tools:
  [
    "read",
    "search",
    "execute",
    "web",
    "vscode/askQuestions",
    "playwright/*",
    "openapi/*",
  ]
handoffs:
  - label: Build the approved proposal
    agent: test-builder
    prompt: Build the approved proposal above.
    send: false
---

Before anything else, read [AGENTS.md](../../AGENTS.md) and [framework/prompts/planner.md](../../framework/prompts/planner.md), and follow them. Do not change any file.
