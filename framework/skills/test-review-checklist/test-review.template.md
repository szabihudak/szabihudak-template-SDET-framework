# <Feature> test review

Plan: `test-plans/<feature>.md` · Commit: <short HEAD> · Base: <default branch> · Date: <YYYY-MM-DD>
Verdict: PASS / CHANGES NEEDED

## Cases

| Case           | Test                                  | C1  | C2  | C3  | C4  | C7  | Result                      |
| -------------- | ------------------------------------- | --- | --- | --- | --- | --- | --------------------------- |
| T001_Login_API | tests/api/login.spec.ts › <test name> | ✔   | ✔   | ✔   | ✔   | ✔   | matches / differs / missing |

Extra tests (C5): <tests, or none>

## Structure

| Layer   | Plan decision | Path   | Exists / changed | Used by specs | Template | Result    |
| ------- | ------------- | ------ | ---------------- | ------------- | -------- | --------- |
| <layer> | <decision>    | <path> | ✔ / ✘            | ✔ / ✘         | ✔ / ✘    | OK / <S#> |

## Layer boundaries

- L1 locators in specs: OK, or <file:line>
- L2 comparisons in Page Objects: OK, or <file:line>

## No green-washing

- <G#>: OK, or <file:line> before → after

## Scope

- <OK, or files changed outside the plan>

## Findings

### F1 · <Implementation | Plan | Question> · <case ID or file> · <check>

- Plan: <the plan row and its source>
- Code: <what the code does, file:line>
- Suggested fix: <one sentence>
