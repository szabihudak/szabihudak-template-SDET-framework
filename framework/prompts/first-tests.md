# First Tests

Configure login and create the first tests for this application: at most 2 API tests and at most
2 UI tests. Their purpose is to establish the project's own golden examples, not coverage. The
rules in AGENTS.md apply throughout.

Never ask for, read, write or log passwords, tokens or other secrets. Read only variable names in
`.env` and `.env.example`, apart from `TEST_ENV`.

## Phase 1 – Discover (read-only)

Use the hints the human wrote after the command first. Besides AGENTS.md, read these sources and no others:

| Item                   | Source                                                                                                                                                                                                                                                                                                             |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Target environment     | `TEST_ENV` in `.env` (else `.env.example`); its `webBaseUrl`, `apiBaseUrl`, `openApiUrl` and `allow` in `config/environments/environments.json`                                                                                                                                                                    |
| Modules, login, roles  | `modules`, `auth` and `roles` in `config/framework.config.ts`                                                                                                                                                                                                                                                      |
| Test account           | `npm run doctor`. The line `credentials for role "<name>" are set` means `.env` holds that role's account: report "test account found in .env" and do not ask for it                                                                                                                                               |
| API contract and login | OpenAPI MCP: `list-api-endpoints`, `get-api-endpoint-schema`. Never call `invoke-api-endpoint`. Without the MCP server: `openApiUrl`, an OpenAPI file in the repository, or GET requests to `/openapi.json`, `/swagger.json`, `/v3/api-docs`, `/api-docs`, `/docs`, `/swagger` under `apiBaseUrl` and `webBaseUrl` |
| Login flow and pages   | Playwright MCP on `webBaseUrl`: the sign-in page, its fields, the requests it loads (for example `/api/auth/csrf`) and where it redirects. Do not submit forms, sign up or delete anything                                                                                                                         |
| Golden examples        | The sources in AGENTS.md → Read Before Changing Code, for the templates you will use                                                                                                                                                                                                                               |

Output a table: item, value found, source.

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
   need them. If the application uses another login method, say so instead of proposing a
   configuration.
2. Each test: behavior verified, test type and Playwright project, golden example or template ids,
   files to create or change, evidence (contract section or observed page), open questions.

Mark everything in phases 1 and 2 that you could not verify as UNVERIFIED. End with: "Approve, or
tell me what to change. Then run `/first-tests-build`." Stop and wait.

## Phase 3 – Build and validate (after approval)

Implement only the approved proposal.

1. Login: update `config/framework.config.ts` and `.env.example` (one USERNAME/PASSWORD pair per
   role). Run `npm run qa:sync-ci-secrets`, then `npm run doctor`.
   - Every role logs in: say so in one line and continue.
   - Credentials missing: name the variables, ask the human to run `npm run onboard`, and wait.
   - A login check fails: show the failing line. Fix your own configuration only when the evidence
     shows the mistake; otherwise stop and report.
2. Tests: build in this order, each file from its golden example or template.
   - Fixtures first: start `src/fixtures/test-fixtures.ts` from the `app-fixtures` template.
   - API: schema → client → factory → fixture → spec.
   - UI: Page Object → fixture → spec.
3. Run the AGENTS.md validation commands for the project of each new test, and fix your own
   mistakes. If a failure looks like an application defect, stop and report it.
4. Report: files created or changed, each command with its result, open questions, and the GitHub
   Actions secrets `npm run qa:sync-ci-secrets` listed (the human adds them in the repository
   settings). After the human accepts the tests, register them in `config/approved-examples.json`.
