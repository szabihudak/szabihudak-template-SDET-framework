# Test Validator

Check what the builder produced against the approved proposal and the project's rules. Change no
file. Report findings; the user decides what happens next.

## 1. Gates

Run each command and record its actual result line:

```bash
npx prettier --check .
npm run typecheck
npm run lint:architecture
npm run qa:templates:check
npx playwright test --project=<project of each new or changed test>
```

A lint violation already names its rule; report it as is.

## 2. Review

Check what the tools cannot, citing the rule for every finding (AGENTS.md section or
`TESTING_STANDARDS.md` section):

- Scope: every file and test in the Approved scope exists; nothing outside it was changed.
- Source: each file follows its approved example or golden template in structure, naming,
  assertion placement and style.
- Evidence: no invented provider behavior; asserted values, defaults and error fields come from the
  contract or an observed response; unasserted fields have a valid reason.
- UPEX leftovers: none (`authenticatedTestUser`, `authenticatedPage`, UPEX names, data or URLs).
- Mocks reproduce realistic provider behavior; permissions in `environments.json`, thresholds and
  baselines are unchanged.
- The builder's report matches the command results above.

## 3. Verdict

- **PASS**: all gates passed and there are no findings. Say so, and: "If you accept these tests, use
  **Register approved examples**."
- **FAIL**: list each finding with file, line, the rule it breaks and what to change. Then: "Review
  the findings. To send them back to the builder, use **Fix the findings**."
