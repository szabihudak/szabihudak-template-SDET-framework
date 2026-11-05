# ADR-017: Agent Skills

## Status

Accepted

Amends ADR-010 and ADR-015 (setup installs the framework's skills in every project, and the skills of the example agents a user chooses) and ADR-016 (the agents' procedures move into skills).

---

## Context

The six example agents were 690 lines of prompt. Most of it was procedure: how to write a plan, the review checklist, the failure categories, the scopes of a test run, the hand-off steps and the output formats. Procedures shared by several agents, such as running the validation commands, were written into each of them; a person working without an agent could not use any of it.

GitHub Copilot, and other tools, now load Agent Skills: a folder with a `SKILL.md` and supporting files. Only a skill's name and description are always in context; its instructions load when a task matches or when it is started from the `/` menu, and its supporting files only when the instructions reference them. Nothing loads a skill on every request; that is what instructions files such as `AGENTS.md` are for.

---

## Decision

Rules, procedures and roles each have one place:

| Where                       | What                                                             | Loaded                            |
| --------------------------- | ---------------------------------------------------------------- | --------------------------------- |
| `AGENTS.md`                 | rules for every tool and person; the lint cites them             | always                            |
| `.github/agents/*.agent.md` | an agent's role, inputs, permissions, constraints and checkpoint | when the agent is selected        |
| `.github/skills/<name>/`    | a procedure and the templates of what it writes                  | when a task needs it, or from `/` |

The skills live in one folder of the template, `framework/skills/`, and setup copies them to `.github/skills/` of a project:

| Skill                            | Contents                                                                       | Installed          |
| -------------------------------- | ------------------------------------------------------------------------------ | ------------------ |
| `validation-gates`               | running the validation commands, acting on failures, reporting results         | always             |
| `golden-template-implementation` | finding the pattern, implementing from it, approved examples, template changes | always             |
| `playwright-failure-triage`      | CI attempts and local runs, `causes.md`, the analysis template                 | always             |
| `test-plan-writing`              | the planning process and the plan template                                     | with test-planner  |
| `test-review-checklist`          | the review process, `checklist.md` and the review template                     | with test-reviewer |
| `test-selection`                 | scopes, impact rules, the run and the run summary template                     | with test-runner   |
| `pr-handoff`                     | the hand-off check, the branch, commit and draft pull request, its template    | with pr-opener     |

- A skill explains how to apply the rules; it never restates or changes them, and `AGENTS.md` wins where they differ. Where a rule matters at one step, the skill names it and links to `AGENTS.md`.
- The output templates (plan, review, analysis, run summary, pull request, build report) sit next to the skill that writes them. Golden code templates stay in `framework/templates/`.
- An agent links its skills, so they load whenever the agent runs, instead of depending on Copilot to match a description. The agents keep their roles, handoffs and checkpoints; their behavior is unchanged.
- The three framework skills are template-owned, like `framework/`; the agent skills are part of the examples and project-owned. Each skill says which it is.
- `AGENTS.md` keeps every rule the lint cites. Its Golden Template Changes section keeps the rule and points to the skill for the steps.

The self-test checks that setup installs the framework skills without agents and every skill with all agents, that each `SKILL.md` has valid YAML frontmatter whose `name` is its folder and whose `description` has at most 1024 characters, and that every relative link in an agent or a skill resolves inside the project. Unit tests check that the plan template has every section and column the plan rules read, and that the Files table, the review verdict and the analysis heading are in the formats `qa:handoff-check` and the analyst read.

---

## Consequences

### Positive

- The agents shrink from 690 to about 320 lines; a procedure is changed in one place.
- People and other tools use the same procedures from the `/` menu, without an agent.
- The templates the tools parse are tested against them.

### Trade-offs

- A skill's automatic loading depends on Copilot matching its description; agents link theirs, a person may have to start one from `/`.
- Projects created before this change have no skills; they copy `framework/skills/<name>/` into `.github/skills/<name>/` by hand.
- Tools without Agent Skills support read the skill files only when told to.

---

## Related Decisions

```text
ADR-010 → agents outside the template
ADR-015 → project generator, agent choice and configurator download
ADR-016 → pull request opener, analyst attempts and local runs
```
