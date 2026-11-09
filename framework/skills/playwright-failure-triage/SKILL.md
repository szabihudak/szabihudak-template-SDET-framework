---
name: playwright-failure-triage
description: "Find the root cause of failed Playwright tests, from a CI run attempt or the last local run: collect the evidence, group failures by cause, decide env, app, test, pipeline or unknown, and write the analysis from its template. Use when a test run failed."
---

# Playwright failure triage

> Template-owned: change this skill in the template repository (`framework/skills/playwright-failure-triage/`), not in a project.

Follow [AGENTS.md](../../../AGENTS.md), especially its failure analysis rules: state which evidence you opened, and never present an unopened artifact or uncertain evidence as a confirmed defect. You analyze and report; you do not fix, rerun or change anything.

## CI runs

The report folder is `ci-analysis/<run-id>/attempt-<n>/`, one per attempt, so the analysis of a rerun never overwrites or hides the analysis of an earlier attempt.

1. **Overview.** Run `npm run qa:run-attempt -- <run URL or ID> [--attempt <n>] --json` (without a run: the latest run; without an attempt: its latest attempt). It returns the workflow, commit, branch, event, the attempt and its start, the failed jobs with their IDs and failed steps, the skipped jobs, the artifacts created during this attempt and those left from earlier attempts, the report folder (`reportDir`) and the reports of earlier attempts. Use these facts as they are; do not work them out again. Name the skipped jobs without analyzing them. If the command fails, report its error and stop.
2. **Collect.** For each failed job, its log (`gh run view --job <job-id> --log-failed`, with the job IDs from step 1) and the artifacts (`gh run download <run-id> --dir <reportDir>/artifacts`). Only the artifacts listed under this attempt are evidence; an artifact of an earlier attempt goes under Not available. Artifacts of this repository's CI:
   - `test-results-<job>`, on failure only: `results.json` with every test, error, retry and attachment; screenshots (`only-on-failure`), videos (`retain-on-failure`) and traces, which exist only for retried attempts (`on-first-retry`);
   - `playwright-report-<job>`: the HTML report;
   - `run-report`, from the run-report job: one page of every test job, with the failures grouped into root causes (ADR-020). Link it in the report; its categories are a first guess from the error text, not evidence, and never replace your own verdict;
   - `performance-report-*`: the k6 and Lighthouse reports;
   - the application log, printed in the job log by the step that shows the UPEX logs on failure.
3. **Separate the failures.** Test jobs: `npm run qa:failures -- <reportDir>/artifacts/test-results-<job>/results.json --json` lists each failed and flaky test with its case ID, error, attempts and which attachments exist; a test that passed on a retry is flaky. Other jobs (quality, build, self-test): each failed step from step 1.
4. **Group** failures with one root cause into one finding: when the application did not start and 30 tests failed, that is one env finding that affects 30 tests.
5. **Analyze each finding.** Read the error and its location; open the screenshot, video and trace where they exist; read the application log around the failure; find the plan row by the case ID that starts the test title (`T001_Login_API: ...`) in `test-plans/`; compare the run's commit with the previous successful run on the branch (`git log`, `git diff`) when a change may explain the failure.
6. **Compare with earlier attempts.** For each report of an earlier attempt that step 1 lists, read its findings and say for each whether this attempt still shows it or no longer does. Never copy an earlier finding into this report without evidence from this attempt.
7. **Decide** the cause by [causes.md](causes.md), with a confidence and the evidence behind it.
8. **Write the report** to `<reportDir>/analysis.md` from [the analysis template](failure-analysis.template.md).
9. **Verify the report.** Read the file back. Its heading must name this run and attempt, and its Findings line must match your findings. If the file could not be written or does not match, do not name it as the report: say so in the Summary.

## Local runs

With `local`, analyze the last local Playwright run on this machine:

- **Evidence:** `npm run qa:failures -- --json` lists the failed and flaky tests of `test-results/results.json` with their errors, attempts and attachments; open the screenshots, videos and traces it names, and `playwright-report/`. When a `test-runs/<timestamp>/summary.md` of test-runner is newer than `results.json`, read its scope, environment and command. When the command finds no `test-results/results.json`, say that there is no local run to analyze and stop.
- **Report:** `ci-analysis/local-<timestamp>/analysis.md`, with the time of `results.json`; downloaded nothing, so no `artifacts/` folder. It uses [the analysis template](failure-analysis.template.md) with `# Failure analysis: local run <timestamp>` as its heading, `Run: local · Environment: <TEST_ENV> · Commit: <short sha> · Branch: <branch>` as its first line, and no Failed jobs or Earlier attempts line; its Log and Artifact entries are `not available`.
- **Process:** steps 4 to 9 as for CI. Compare the working tree with the default branch (`git status`, `git diff`) when a change may explain the failure.
- **Limits:** there is no job log, no application log unless the user gives you one, and no **pipeline** cause; an error of the local setup (`.env`, browsers, the target unreachable from this machine) is **env**. Traces exist only for retried tests: with `retries: 0` locally, say under Not available that no trace was recorded.
