---
name: golden-template-implementation
description: "Implement test code (schemas, API clients, factories, Page and Component Objects, mocks, fixtures, specs) from the approved examples and golden templates, and register reviewed files as approved examples. Use whenever writing or extending test code."
---

# Golden template implementation

> Template-owned: change this skill in the template repository (`framework/skills/golden-template-implementation/`), not in a project.

The rules every file must keep are in [AGENTS.md](../../../AGENTS.md): Layer Rules, Playwright Rules and Hard Rules. This skill is how to apply them when you write test code.

## Find the pattern

1. [config/approved-examples.json](../../../config/approved-examples.json): this project's reviewed examples. Take the one whose `need` matches the responsibility of the file you write.
2. [framework/templates/index.json](../../../framework/templates/index.json): the generic golden templates. Each has an `id`, the `need` it serves, its `template`, the `output` path and name of the file it creates, and `rules`, the [TESTING_STANDARDS.md](../../../framework/docs/TESTING_STANDARDS.md) section to read.
3. Read that section, and the Playwright rules in `AGENTS.md` that apply to the file.

Reuse what exists, extend a file while its name still describes its responsibility, and create only what is missing.

## Implement

1. **Read the plan**

- For each file, read its golden example or template and the linked `TESTING_STANDARDS.md` section.
- Read the related Playwright rules in `AGENTS.md`.

2. **Implement**

- Implement only the plan's cases and listed files, using the template's structure, naming, assertion placement and style.
- Prefix every Playwright `test()` title with the exact plan case ID and `: `, followed by a concise behavior; for table-driven cases, store each plan ID as `caseId` on its scenario and interpolate `caseId` into the generated test title.
- Keep tests independent and self-contained; do not rely on execution order. Use the lifecycle: create → setup → execute → teardown → cleanup.

In VS Code, type `qa-<id>` to insert a template as a snippet, then replace its tokens (such as `__Domain__`) and adapt the fields and locators.

## Report

Write the result in [the build report format](build-report.template.md): every changed file with its golden example or template, every case with its test and result, and every validation command with its result.

## Register an approved example

A file that passed review and CI can become this project's golden example for its responsibility, in [config/approved-examples.json](../../../config/approved-examples.json):

```json
{
  "examples": [
    {
      "id": "api-client",
      "need": "Orders API client",
      "file": "src/api/clients/OrderApiClient.ts"
    }
  ]
}
```

- `id`: the id of the golden template it replaces for this project.
- `need`: what it is for, as concretely as in `framework/templates/index.json`; tools choose an example by it.
- `file`: the file; `npm run qa:templates:check` fails when it does not exist.
- Register one reviewed example per responsibility, not every file.

You do not write these entries by hand: `npm run qa:approve-examples -- test-plans/<feature>.md` proposes, from a PASS review, the plan's `create` files whose template id has no example in the project yet, and `--write` adds them (`--only <id,...>` to choose). Commit them with the files they name, so the pull request's CI run checks both; pr-opener asks you and does this in its hand-off. It never replaces an existing example: to replace one, edit the entry yourself in a reviewed pull request.

## Change a golden template (template repository only)

Generic templates in `framework/templates/` are derived from canonical files in the reference application and must reproduce them exactly (`npm run qa:templates:check`). Change a pattern in the canonical file first, then run `npm run qa:templates:extract -- <id>` and `npm run qa:templates:build`. A project never edits `framework/templates/`; it registers an approved example instead.
