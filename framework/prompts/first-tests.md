# First Tests

Configure login and create the first tests for this application: at most 2 API tests and at most
2 UI tests. Their purpose is to establish the project's own golden examples, not coverage.

AGENTS.md applies throughout. The work has three phases. `/first-tests` runs phases 1 and 2 and
must not change any file. `/first-tests-build` runs phase 3, only after the human approved the
phase 2 proposal in the same conversation.

Never ask for, read, write or log passwords, tokens or other secrets. Read only variable names in
`.env` and `.env.example`, apart from `TEST_ENV`.

## Phase 1 – Discover (read-only)

Use the hints the human wrote after the command first. Then read exactly these sources:

| Item                   | Source                                                                                                                                                                                                                                                                                                             |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Target environment     | `TEST_ENV` in `.env` (else `.env.example`); its `webBaseUrl`, `apiBaseUrl`, `openApiUrl` and `allow` in `config/environments/environments.json`                                                                                                                                                                    |
| Modules, login, roles  | `modules`, `auth` and `roles` in `config/framework.config.ts`                                                                                                                                                                                                                                                      |
| Test account           | `npm run doctor`. The line `credentials for role "<name>" are set` means `.env` holds that role's account: report "test account found in .env" and do not ask for it                                                                                                                                               |
| API contract and login | OpenAPI MCP: `list-api-endpoints`, `get-api-endpoint-schema`. Never call `invoke-api-endpoint`. Without the MCP server: `openApiUrl`, an OpenAPI file in the repository, or GET requests to `/openapi.json`, `/swagger.json`, `/v3/api-docs`, `/api-docs`, `/docs`, `/swagger` under `apiBaseUrl` and `webBaseUrl` |
| Login flow and pages   | Playwright MCP on `webBaseUrl`: the sign-in page, its fields, the requests it loads (for example `/api/auth/csrf`) and where it redirects. Navigate and read only: do not submit forms, sign up or delete anything                                                                                                 |
| Golden examples        | `config/approved-examples.json` first, then `framework/templates/index.json`, the templates you will use, and the rules section each template links to (`rules`)                                                                                                                                                   |

Output a table: item, value found, source. Mark guesses as UNVERIFIED.

If something is still missing, ask in one message, one line per item, each with a suggested
default (for example: roles "one role: user"; UI flow "sign in, open the main list, open one item";
API resource "list and get one of the main resource"). If the test account is missing, ask the
human to run `npm run onboard` in a terminal and wait; if they want to add it later, continue
without it. If nothing is missing, continue to phase 2 without asking.

## Phase 2 – Propose, then stop (read-only)

Give one proposal:

1. Login: `auth` and `roles` for `config/framework.config.ts` (API strategy `bearer` or `none`,
   browser strategy `nextAuth` or `none`), with the evidence for every endpoint and field name.
   Keep a role that already exists (`npm run onboard` adds `user`); add roles only when the tests
   need them. If the application uses another login method, say so: `framework/core` is not
   changed from a project.
2. Each test: behavior verified, test type and Playwright project, golden example or template ids,
   files to create or change, evidence (contract section or observed page), open questions.

Mark anything not verified as UNVERIFIED. End with: "Approve, or tell me what to change. Then run
`/first-tests-build`." Stop and wait.

## Phase 3 – Build and validate (after approval)

Implement only the approved proposal.

1. Login: update `config/framework.config.ts` and `.env.example` (one USERNAME/PASSWORD pair per
   role). Run `npm run qa:sync-ci-secrets`, then `npm run doctor`.
   - Every role logs in: say so in one line and continue.
   - Credentials missing: name the variables, ask the human to run `npm run onboard`, and wait.
   - A login check fails: show the failing line. Fix your own configuration only when the evidence
     shows the mistake; otherwise stop and report.
2. Tests: start every file from its golden example or template, replace the tokens, adapt fields,
   locators and data.
   - Fixtures: start `src/fixtures/test-fixtures.ts` from the `app-fixtures` template (role
     accounts, `authenticatedPageFor`, `apiTokenFor`). The UPEX reference registers fresh users
     instead; do not copy that.
   - API: schema → client → factory → fixture → spec. Positive test: status → `validateSchema()` →
     assertions. Negative test: status → error assertions, no success schema.
   - UI: Page Object (locators by role, label, then test id) → fixture → spec. Use the
     authenticated fixtures, not UI login.
3. Validate, and fix your own mistakes:

   ```bash
   npx prettier --check .
   npm run typecheck
   npm run lint:architecture
   npm run qa:templates:check
   npx playwright test --project=<project of each new test>
   ```

   If a failure looks like an application defect, stop and report it.

4. Report: files created or changed, each command with its result, open questions, and the GitHub
   Actions secrets `npm run qa:sync-ci-secrets` listed (the human adds them in the repository
   settings). After the human accepts the tests, add them to `config/approved-examples.json`.
