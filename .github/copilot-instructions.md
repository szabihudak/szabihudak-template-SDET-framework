# GitHub Copilot Instructions

Follow `AGENTS.md` at the repository root. It lists the required reading, the golden template catalogue (`framework/templates/index.json`), the hard rules and the validation commands.

To plan, build and validate tests in a generated project, use the agents in `.github/agents/`: start with **test-planner**; its hand-overs lead to **test-builder** and **test-validator**. Their tasks are in `framework/prompts/`.
