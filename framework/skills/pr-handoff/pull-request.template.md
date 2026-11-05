## <Feature> tests

Plan: `test-plans/<feature>.md` · Review: `test-reviews/<feature>.md` (PASS, <review date>)

| Case           | Test                                  |
| -------------- | ------------------------------------- |
| T001_Login_API | tests/api/login.spec.ts › <test name> |

## Files

- <path>: <create or extend>

## Checks run before opening

- `npx prettier --check .`: passed
- `npm run typecheck`: passed
- `npm run lint:architecture`: passed
- `npm run qa:templates:check`: passed

The Playwright tests run in CI on this pull request. Mark it ready for review when CI passes.
