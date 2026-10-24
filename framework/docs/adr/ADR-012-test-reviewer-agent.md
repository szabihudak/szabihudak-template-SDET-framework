# ADR-012: Test Reviewer Agent

## Status

Accepted

Amends ADR-010 (the optional examples gain a reviewer agent). Setup still installs no agents.

---

## Context

ADR-010 removed the ADR-009 verifiers and left the review of generated tests to the human reviewing the pull request. It names the condition for a review agent to return: a defect the simple flow does not catch.

The deterministic gates reject code that breaks a written rule. They do not see:

- a test that passes but does not check what its plan case expects, or uses other steps, data or a weaker expected value;
- a test made green by weakening it: a removed or looser assertion, an expected value changed to the actual result, a looser schema, or a `// quarantine:` or `// partial:` escape the lint accepts;
- a layer the plan or the spec template requires that was never built or is bypassed: a missing API client, schema, Page Object or fixture registration;
- layer boundaries broken in forms the lint does not match: a selector passed to `page.click()` in a spec, or a Page Object that compares application state and returns a boolean.

Each needs the plan, the diff and the templates read together. The builder is the wrong agent to judge its own work.

---

## Decision

`examples/copilot-agents/` gains a third optional agent, **test-reviewer**, that reviews the implemented tests against the approved plan:

```text
test-planner ──▶ CP1 ──▶ test-builder ──▶ CP2 ──▶ [Review the tests] ──▶ test-reviewer ──▶ test-reviews/<feature>.md ──▶ CP3
                                                                              │
                              Implementation findings ── [Fix the findings] ──▶ test-builder (one round)
                              Plan findings ─────────── [Revise the plan] ───▶ test-planner ──▶ CP1 again
```

- It reviews five groups: cases against the plan (C), no green-washing (G), the required structure exists and is used (S), layer boundaries in specs and Page Objects (L), and scope. It skips what `npm run lint:architecture` already reports.
- It changes no code, tests, schemas or plan. It writes one Markdown report, `test-reviews/<feature>.md`, and replaces it on every run; git keeps the history. The report lives outside `test-plans/`, so the plan lint does not read it as a plan.
- The report header records the reviewed commit for the reader. No tool checks it: there is no plan hash, no report checker and no CI gate.
- The user starts the review with a hand-off button from CP2 (`send: false`). The reviewer starts in a new context with only the plan name, so the builder's summary cannot steer it.
- Findings are Implementation, Plan or Question. The builder fixes Implementation findings once; after that, and for every other finding, the user decides. There is no automatic loop.
- The reviewer does not run the tests or the gates; the builder and CI do. CI remains the final independent check, and the pull request remains the approval of the code.

### Lint candidates

Parts of G and L are syntax patterns and belong in `lint:architecture`, where they run on every change and in CI. Candidates, not part of this decision:

- extend `no-raw-locators-in-specs` to `page.$()`, `$$()`, `$eval()`, `$$eval()` and to `page` actions called with a selector;
- extend `no-assertions-outside-specs` to `expect` under another name, `test.expect`, `node:assert` and `chai`;
- `no-trivial-assertions`: `expect(<literal>)`, and `toBeDefined()` or `toBeTruthy()` on a response;
- `no-swallowed-errors` in specs: empty `catch` and `.catch(() => {})`;
- `no-conditional-assertions`: `expect` inside `if` in a spec;
- `no-comparisons-in-page-objects`: `===`, `!==` and `throw` on application state under `src/pages/` and `src/components/`;
- `no-page-object-construction-in-specs`: `new <Name>Page()` in a spec.

When one becomes a rule, the reviewer stops checking it.

---

## Consequences

### Positive

- A second reader compares the tests with the plan before the pull request, with file and line evidence.
- Green-washing and missing layers that pass every gate are reported instead of reaching review unnoticed.
- The report is a file, so the builder's fix round and the pull request reviewer read the same findings.

### Trade-offs

- A reviewer is another model reading the same evidence; it reduces but does not replace human review.
- The reviewer needs edit access for its report, so its read-only guarantee is policy, not a sandbox.
- A report can be stale when code changes after the review; the commit in its header shows it.
- One more example agent to keep current with the Copilot agent format; the self-test does not run it.

---

## Related Decisions

```text
ADR-009 → Copilot agent pipeline (superseded)
ADR-010 → agents outside the template
ADR-011 → ESLint for the architecture lint
```
