---
name: test-plan-writing
description: "Plan Playwright tests for one feature: discover requirements and contract, rate risks, design cases by the Test Design Standard, choose the files and write test-plans/<feature>.md from the plan template. Use when planning or revising a test plan."
---

# Test plan writing

> Part of the example agents: change it freely in your project. Its source is `framework/skills/test-plan-writing/` in the template repository.

Follow [AGENTS.md](../../../AGENTS.md). The cases are designed by the Test Design Standard in [TESTING_STANDARDS.md](../../../framework/docs/TESTING_STANDARDS.md).

## Inputs

- **Environment:** a key in `config/environments/environments.json`.
- **Role:** a role in `config/framework.config.ts`, not a username or password.
- **Feature:** the behavior to plan, such as `login`.
- **Test type:** `API`, `UI` or `both`.

Ask for whatever is missing.

## Process

1. **Discover.** Read the requirements (`requirementsDoc` in `config/framework.config.ts`, or what the user gives you), for UI tests also the UI/E2E scenarios (`uiScenariosDoc`), the API contract, `config/framework.config.ts` (modules, `auth`, roles), `src/fixtures/test-fixtures.ts` and the existing `src/` and `tests/` code for this feature.
2. **Use MCP servers.** Utilize the Playwright and OpenAPI MCP servers to discover the application if the required documentation is not set, not clear, or incomplete, but only within the environment's `allow` permissions.
3. **Ask early.** When a case needs a fact only the user knows (an expected value, a requirement, an account), ask at once with a suggested answer.
4. **Rate the risks.** List what can go wrong for the user or the business in this feature, and rate each risk's impact and likelihood. A side effect of running the tests, such as accounts left in a shared environment, is an open question, not a risk. The level, the priority and the regression decision follow from them by the Test Design Standard in `framework/docs/TESTING_STANDARDS.md`.
5. **Design the cases.**
   - Happy path, boundary values, equivalence classes, business flows and error handling where they apply. Consider invalid and missing input and unauthenticated or unauthorized access for every behavior; they are Negative cases in the category of their technique. Every expected result names its source. If a category does not apply, explain why in the Coverage table.
   - Every case has one test design technique, its Type (Positive or Negative), the one risk it covers and its numbered steps.
   - Order the cases by category, then Positive before Negative, then Priority. Number new IDs in that order; keep the IDs of cases that already exist.
   - Plan exploratory testing as a charter for a person in the Coverage table when the feature has a risk that scripted cases cannot reach; otherwise say why it is not needed.
6. **Choose the files.** List every layer the chosen spec template uses, directly or through its fixtures (schema, API client, factory, Page or Component Object, mock, fixture registration). For each, decide reuse, extend, create or not needed, give the reason for not needed, and name the golden example or template (AGENTS.md, Read Before Changing Code). Extend a file only when its name still describes its responsibility after the change; otherwise create the file of the right domain. Plan a new schema for every new request and response body (Schema Standard). If login or roles are not configured yet, include the files that configure them.
7. **Write the plan** to `test-plans/<feature>.md` from [the plan template](test-plan.template.md): keep its sections, their order and the table columns, which `npm run lint:architecture` and test-builder read. If the file exists, extend it and keep its case IDs. Format it with `npx prettier --write test-plans/<feature>.md` (the pre-push hook rejects unformatted files), then run `npm run lint:architecture` and fix every `plan-*` problem it reports; `planned-case-id-in-test-title` stays red until test-builder writes the specs.
