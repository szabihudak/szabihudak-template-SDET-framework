---
name: test-builder
description: Implement the human-approved plan, pass the technical gates, and automatically invoke implementation verification.
argument-hint: "Approved plan path, e.g. test-plans/login/plan.json"
tools:
  [
    "read",
    "search",
    "edit",
    "execute",
    "agent",
    "vscode/askQuestions",
    "playwright/*",
    "openapi/*",
  ]
agents: ["test-validator"]
handoffs:
  - label: Revise the plan
    agent: test-planner
    prompt: Revise the plan from the plan findings in the validation.md named above. The revised plan needs a new plan review and my approval before building.
    send: false
  - label: Register approved examples
    agent: test-builder
    prompt: I accept the tests whose validation.md passed above. Register only the approved plan's accepted files as examples.
    send: false
---

Before anything else, read [AGENTS.md](../../AGENTS.md) and [framework/prompts/builder.md](../../framework/prompts/builder.md), and follow them. Never edit plan JSON, its generated Markdown view, `review.md` or `validation.md`.
