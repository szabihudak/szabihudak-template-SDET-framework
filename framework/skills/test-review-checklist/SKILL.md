---
name: test-review-checklist
description: "Review tests against their approved plan: cases, green-washing, structure, layer boundaries and scope, from the checklist, and write test-reviews/<feature>.md from the review template. Use when reviewing tests or a pull request with tests."
---

# Test review checklist

> Part of the example agents: change it freely in your project. Its source is `framework/skills/test-review-checklist/` in the template repository.

Follow [AGENTS.md](../../../AGENTS.md). The question is whether the tests check what the approved plan says, in the structure the templates require, and whether the change touches only what the plan allows. You compare and report; you do not fix.

## Process

1. **Read the plan,** the `TESTING_STANDARDS.md` sections it links, `framework/templates/index.json` and the golden templates its Files table names.
2. **Collect the change.** Run `git status` and `git diff` against the default branch. Apart from formatting your own report, run only commands that read; do not run the tests or the validation commands, test-builder and CI do.
3. **Review** every check in [checklist.md](checklist.md). Do not repeat what `npm run lint:architecture` already reports (plan format, case IDs in titles, skipped tests, boolean-wrapped, trivial and conditional assertions, swallowed errors, partial comparisons, assertions outside specs in any form, locators and selector-taking `page` methods in specs, comparisons and `throw` in Page Objects, schema strictness); look for what it cannot see.
4. **Write the report** to `test-reviews/<feature>.md` from [the review template](test-review.template.md), replacing an earlier one, and format it with `npx prettier --write test-reviews/<feature>.md`: the report is committed with the tests, and the pre-push hook rejects unformatted files.
5. **Stamp the report** with `npm run qa:review-stamp -- test-plans/<feature>.md`. It writes the Reviewed files section: the SHA-256 of every file of the change you reviewed, the plan included. The hand-off stops when any of them changes afterwards, so run it last, after the verdict, and never edit the section yourself. A report written again is stamped again.

## Findings

Give every finding the check, the file and line, the plan row it contradicts and the evidence. Classify it:

- **Implementation:** the code does not follow the plan or the structure. Goes back to test-builder.
- **Plan:** the plan is incomplete or contradicts itself, so the builder could not implement it correctly. Goes back to test-planner, then CP1 again.
- **Question:** a fact only the user knows. Goes to the user.

Every G finding is an Implementation finding. When the builder says the application really behaves differently, that is a difference to report under AGENTS.md, not a reason to accept the change. Write `UNVERIFIED` when you are not sure; it is not a finding. Do not suggest style changes, refactorings or more tests.
