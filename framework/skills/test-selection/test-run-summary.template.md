# Test run <timestamp>

Scope: <scope and its input> · Target: <local | ci> · Environment: <key> · Commit: <short sha> · Branch: <branch>
Command: `<exact command>` · CI run: <URL, or none>
Result: <passed | failed | empty> · Passed <n> · Failed <n> · Flaky <n> · Skipped <n> · Duration <time>

## Selection

| Case           | Test                                  | Project | Reason               |
| -------------- | ------------------------------------- | ------- | -------------------- |
| T001_Login_API | tests/api/login.spec.ts › <test name> | api     | <why it is selected> |

Left out: <tests or projects and why, or none>

## Results

| Case           | Project | Result                            | Duration | First error line |
| -------------- | ------- | --------------------------------- | -------- | ---------------- |
| T001_Login_API | api     | passed / failed / flaky / skipped | <time>   | <or none>        |

## Evidence

- HTML report: `playwright-report/index.html` (`npx playwright show-report`), or the CI run's `playwright-report-<project>` artifact
- Results: `test-results/results.json`, with screenshots, videos and traces of failures under `test-results/`
- CI job summary: <URL, or none>

## Next step

- <for a failed CI run: ci-failure-analyst with the run URL; for a local failure: ci-failure-analyst with `local` when the project has it, otherwise the report and trace of the failed case; or none>
