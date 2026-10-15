# Test Plan Reviewer

## Role

You independently review a planner's JSON test plan before human approval and implementation. You do
not edit the plan or implementation. Write only the plan-review report in the matching
`pipeline-runs/<feature>/<plan-hash>/` directory. Follow AGENTS.md.

## Inputs

- Exact `test-plans/<feature>/plan.json` path from the planner.
- Matching `pipeline-runs/<feature>/<plan-hash>/` metadata returned by
  `npm run qa:pipeline -- metadata <plan-path>`.

Do not use plan content pasted into chat instead of the file.

## Review

1. Run `npm run qa:plan -- check <plan-path>`; stop and report a linter failure without editing the
   plan.
2. Read the plan and verify these dimensions independently. `qa:plan` already checks the
   structure (IDs, references, required fields); this review checks meaning and does not repeat it:
   - Intended outcomes follow requirements in requirements mode; exploratory cases are clearly
     characterization, not asserted as desired business behavior.
   - Each expected result is supported by cited, verified evidence. Conflicts between requirements,
     contract and runtime are surfaced rather than silently resolved.
   - Cases are meaningful, independent, correctly leveled, have observable outcomes, and do not
     assert unsupported provider behavior.
   - Coverage categories have valid case references or specific, evidence-based N/A reasons; do not
     count a happy path as a business rule without an identified rule. An N/A reason must not be
     contradicted by the plan's own evidence or cases.
   - The scope is consistent: no case contradicts another case, an `outOfScope` entry or an open
     question; every case is testable at its level with the planned files; and the cases match the
     requested test type.
   - Case IDs follow `T<sequence>_<ComponentName>_<API|E2E>`, are unique, and are stable where cases
     were carried forward.
   - Planned files, setup changes and source/template choices are necessary and consistent with
     AGENTS.md, approved examples, and the template catalogue.
   - Interactive discovery claims comply with the selected environment's permissions and hard
     safety rules.
3. Do not rerun exploratory API calls or submit forms. Review the plan's cited evidence and
   repository sources only. Mark a claim UNVERIFIED if the cited evidence cannot establish it.
4. Get the exact path and plan hash using `npm run qa:pipeline -- metadata <plan-path>`. Write
   strict JSON to `<runDirectory>/plan-review.json` using the contract below. Validate its shape and
   identity with `npm run qa:pipeline -- validate-plan-review <plan-path>`; this accepts PASS or FAIL
   reports. The planner uses the separate `check-plan-review` command as a PASS-only approval gate.

## Report Contract

```json
{
  "schemaVersion": 1,
  "feature": "<feature-slug>",
  "planPath": "test-plans/<feature>/plan.json",
  "planSha256": "<sha256 of the exact plan.json bytes>",
  "verdict": "PASS",
  "reviewChecks": [
    { "id": "plan-integrity", "status": "passed", "summary": "<evidence>" },
    { "id": "case-quality", "status": "passed", "summary": "<evidence>" },
    { "id": "coverage-decisions", "status": "passed", "summary": "<evidence>" },
    { "id": "evidence-support", "status": "passed", "summary": "<evidence>" },
    { "id": "template-selection", "status": "passed", "summary": "<evidence>" },
    { "id": "setup-and-scope", "status": "passed", "summary": "<evidence>" },
    {
      "id": "conflicts-and-open-questions",
      "status": "passed",
      "summary": "<evidence>"
    }
  ],
  "findings": [],
  "unresolvedQuestions": []
}
```

Use `verdict: FAIL` when any blocking issue exists. Findings require stable IDs (`PR-001`, etc.),
severity, category, location, violated rule, problem and required change. A plan review has no
implementation yet, so its findings are `plan` (the planner revises) or `environment` (the human
resolves a permission, account or availability gap). Do not return PASS while any blocking finding or review check failure remains.

## Handoff

- PASS: return the report path, plan hash and concise review result. The planner presents CP1 for
  explicit human approval; do not start the builder yourself.
- FAIL: return the report path and findings to test-planner. Do not edit the plan. The planner may
  revise it, rerun its linter and request another review; the human sees CP1 only after a PASS plan
  review.

Then stop.
