# ADR-011: ESLint for the Architecture Lint

## Status

Accepted

---

## Context

`npm run lint:architecture` enforces the mechanical part of `AGENTS.md` and `TESTING_STANDARDS.md`: layer boundaries, Playwright rules, and the shapes of the golden spec templates. Until this decision it was one custom script, `framework/tools/architecture.ts` (about 1500 lines). The script read TypeScript source with regular expressions and had no tests of its own. In use:

- reformatted or multi-line code could slip past a pattern, or match one by accident;
- every new rule meant more regex in one file, with no test showing that it reports what it should and nothing else;
- the checks ran only from the command line, not in the editor;
- a custom linter is harder to explain and maintain than the industry-standard one.

ESLint with `typescript-eslint` was blocked because the repository used TypeScript 7. TypeScript 7 is the native compiler and has no JavaScript API, and `typescript-eslint` 8.x supports only TypeScript below 6.1. No code in the repository depended on TypeScript 7.

---

## Decision

The architecture lint runs on ESLint (flat config, `framework/tools/eslint.config.mjs`), and TypeScript is pinned to `~6.0`.

- **Standard rules** cover what they can express: `eslint-plugin-playwright` (fixed waits, focused tests, web-first assertions, missing awaits and similar), `no-restricted-syntax` selectors (raw locators, SQL in specs, `test.step`, casts on `response.json()`), and `no-restricted-imports` per folder (layer boundaries).
- **The project's own rules** live in `framework/tools/eslint-plugin/`, one file per rule, written against the syntax tree with `@typescript-eslint/utils`. They cover the template shapes the standard rules cannot express: field coverage, response assertion order, error fields, role credentials, inline payloads, scenario arrays and similar. Each rule has a `RuleTester` test (`framework/tools/eslint-plugin/tests/`, template-only), which `npm run qa:selftest` runs.
- **Test plans** (`test-plans/*.md`) are checked by the same plugin on their Markdown syntax tree through `@eslint/markdown`: risks, one technique per case, coverage and steps (`plan-*` rules).
- **`framework/tools/architecture.ts`** keeps only the checks that are not about one source file: plan case IDs against the spec titles, no `--update-snapshots` in automation files, and that every cited `<file>#<anchor>` exists.
- Every message keeps the format `[<rule id>] <message> (<source>)`, so the rule ID and the written rule it enforces stay visible. The command name `npm run lint:architecture` is unchanged for people, agents and CI.

---

## Consequences

### Positive

- Every source check reads the syntax tree; regular expressions remain only for text that is not code (Markdown plan cells, YAML and shell lines, comment markers, SQL keywords inside strings).
- Each rule is small and has its own valid and invalid cases. A rule that stops reporting fails the self-test.
- The VS Code ESLint extension shows the same problems while editing, including in test plans.
- The tools are standard ones a reviewer already knows.

### Trade-offs

- The code is not smaller: the rules are the same. The config, the plugin and the remaining script together are about 1900 lines against the old 1500, and the tests come on top of that.
- TypeScript stays on 6.0. **Exit condition:** move back to TypeScript 7 when `typescript-eslint` supports it.
- More dev dependencies: `eslint`, `typescript-eslint`, `@typescript-eslint/utils`, `eslint-plugin-playwright` and `@eslint/markdown`, which brings its Markdown parser packages.
- The plugin is TypeScript loaded through Node's type stripping, so it needs Node 22.18 or newer (the repository requires 22.19).
- When a golden template changes, the rules that describe its shape may need to change too; the canonical specs are linted like all other code, so a mismatch fails immediately.

---

## Related Decisions

```text
ADR-007 → reusable template architecture
ADR-008 → AI-assisted engineering
ADR-010 → agents outside the template
```
