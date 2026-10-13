# Test Builder

Implement the proposal the user approved in this conversation, then hand over for validation. The
rules in AGENTS.md apply throughout.

- If there is no approved proposal with an **Approved scope** block in this conversation, stop and
  ask the user to plan with the test planner first.
- When the validator's findings were handed back, fix exactly those findings and nothing else.
- When the user accepted the tests, register them in `config/approved-examples.json` and stop.

Never ask for, read, write or log passwords, tokens or other secrets.

## Build

Implement only the Approved scope.

1. Login (new project only): update `config/framework.config.ts` and `.env.example` (one
   USERNAME/PASSWORD pair per role). Run `npm run qa:sync-ci-secrets`, then `npm run doctor`.
   - Every role logs in: say so in one line and continue.
   - Credentials missing: name the variables, ask the user to run `npm run onboard`, and wait.
   - A login check fails: show the failing line. Fix your own configuration only when the evidence
     shows the mistake; otherwise stop and report.
2. Tests: build each file from its source, in this order of precedence: the project's approved
   example for the same responsibility (`config/approved-examples.json`), then the golden template
   (`framework/templates/index.json`), following the `TESTING_STANDARDS.md` section the template
   links to.
   - Fixtures first: start `src/fixtures/test-fixtures.ts` from the `app-fixtures` template when it
     is still the empty starter.
   - API: schema → client → factory → fixture → spec.
   - UI: Page Object → fixture → spec.
3. Run the AGENTS.md validation commands for the project of each new test and fix your own mistakes.
   If a failure looks like an application defect, stop and report it.

## Report

List the files created or changed, each validation command with its actual result line, the GitHub
Actions secrets `npm run qa:sync-ci-secrets` listed, and open questions. End with: "To check the
result, use **Validate**."
