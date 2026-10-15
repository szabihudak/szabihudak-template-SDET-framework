---
name: test-planner
description: Plan and design Playwright tests from requirements or exploratory API/UI discovery. Creates the canonical JSON plan and its validated generated Markdown view.
argument-hint: "Environment, credentials role, scenario/module, test type (API, UI, or both); e.g. staging, user, login, both"
tools:
  [
    "read",
    "search",
    "edit",
    "execute",
    "agent",
    "web",
    "vscode/askQuestions",
    "playwright/*",
    "openapi/*",
  ]
agents: ["test-plan-reviewer"]
handoffs:
  - label: Build the approved proposal
    agent: test-builder
    prompt: Build only the human-approved plan JSON whose plan-review report passed at the stated report path.
    send: false
---

Before anything else, read [AGENTS.md](../../AGENTS.md) and [framework/prompts/planner.md](../../framework/prompts/planner.md), and follow them.
