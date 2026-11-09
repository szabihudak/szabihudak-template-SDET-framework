# ADR-020: Run Report

## Status

Accepted

Amends ADR-006 (CI execution: a run-report job after the test jobs) and ADR-013 (the CI failure analyst links the report).

---

## Context

CI runs one test job per Playwright project. Each job uploads its own Playwright HTML report and, on failure, its `test-results`. Reading a run meant opening one artifact per job, and the same failure in three browsers showed up as three unrelated failures. Nothing gave one view of the whole run, or a summary to paste into a pull request.

---

## Decision

### The report

`framework/core/reporting/RunReportReporter.ts` runs with every Playwright run. It records each test (project, file, title, case ID, outcome, attempts, duration, worker, first error, the paths of its screenshot, video and trace) in `run-report/data/<projects>.json`, then writes `run-report/index.html` for that run.

The page is one file with its data embedded; it needs no server and no network. It shows:

- **Overview:** the verdict, the pass rate (flaky tests count as passed, skipped tests are left out) and a map with one hexagon per test, grouped by project;
- **All tests:** search and filters by outcome and project;
- **Failures:** failed tests grouped into root causes (the same file and first error line, with numbers ignored, so one error in three browsers is one cause), with a first guess of the analyst's category (`app`, `test`, `env`, `unknown`) from the error text;
- **Timeline:** each test on its worker's lane, and the slowest tests;
- a Markdown summary to copy into a pull request, a print view to save as PDF, and a light theme.

`config/framework.config.ts` can set its `report.title` and `report.subtitle`; without them it uses the project's name.

### In CI

Every test job uploads its data file as `run-report-data-<job>`. The `run-report` job runs after all test jobs, also when they failed, draws one report of all of them with `npm run qa:run-report`, adds its summary to the run's summary page and uploads it as the `run-report` artifact. It runs no tests and needs no browser. Its steps continue on error: a missing report never fails a run.

---

## Consequences

- One artifact shows the whole run; the per-job Playwright reports and `test-results` stay, with the traces, screenshots and videos the report links to.
- The category is a guess from the error text. The CI failure analyst links the report but decides the cause from its own evidence (ADR-013).
- The run report adds a few seconds per test job and one short job at the end of the workflow.
- `npm run setup -- --update` does not change `playwright.config.ts` or workflows (ADR-019). An existing project adds the reporter to its `playwright.config.ts`, the `run-report/` folder to `.gitignore`, and the upload step and the `run-report` job from `framework/setup/starter/.github/workflows/playwright.yml` to its workflow.
