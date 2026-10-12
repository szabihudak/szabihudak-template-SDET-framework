# First Tests Prompt

Use this prompt with any AI coding tool (Copilot, Claude Code, Cursor, Codex) after `npm run setup` and `npm run doctor` pass. Setup configures no login, so the prompt first proposes the login configuration and roles, then produces the first one or two API tests and one or two UI tests for your application, following the golden templates.

The AI reads what the project already knows (environment, base URLs, login settings, roles) and discovers the API contract itself where it can. It asks you only for what it could not find, with a suggested default for each answer. You can skip the questions by writing hints after `/first-tests`, for example "UI: open the events list and one event; API: events list and get one".

Credentials never go into the prompt or the chat. You create the test accounts and put them into `.env` (and GitHub secrets) yourself.

If setup installed the `/first-tests` command (GitHub Copilot Chat in agent mode, or Claude Code), run it; it follows this prompt. Otherwise paste the whole block, with any hints at the end.

```text
Read AGENTS.md and follow it strictly.

Goal: create the first tests for this application: at most 2 API tests and at most 2 UI tests.
Their purpose is to establish the project's own golden examples, not coverage.

Step 0 – Gather the application context yourself (read-only)
Find each item below from the project and the application before asking me anything.
Use any hints I wrote with the command first.
- Target environment: TEST_ENV in .env (else .env.example), and its webBaseUrl, apiBaseUrl
  and permissions in config/environments/environments.json.
- Login and roles: auth and roles in config/framework.config.ts. Apart from TEST_ENV, read
  only the variable names in .env.example and .env, never their values.
- API contract: look for an OpenAPI/Swagger file in the repository, then try the usual
  paths under apiBaseUrl and webBaseUrl (/openapi.json, /swagger.json, /v3/api-docs,
  /api-docs, /docs, /swagger) with GET requests only. Use the application's public docs if linked.
- Main UI flow and API resource: infer candidates from the contract and the application's
  navigation (read only; do not submit forms).
Then show a short table: item, value found, source. Mark guesses as UNVERIFIED.
Ask me only about items you could not determine, in one message, each as a one-line question
with your suggested default (for example: roles "one role: user"; UI flow "sign in, open the main
list, open one item"; API resource "list and get one of the main resource"). If nothing is missing,
continue to step 1 without asking.
Never ask for passwords, tokens or other secrets.

Step 1 – Discover and configure login (read-only until approved)
- Read config/approved-examples.json, framework/templates/index.json and the templates you will use.
- Read the API contract found in step 0. If you can open the application in a browser, only navigate and read; do not submit forms or delete anything.
- Propose auth and roles for config/framework.config.ts (strategies: bearer or none for the API,
  nextAuth or none for the browser), with the evidence for each endpoint and field name.
  If the application uses another login method, say so; do not edit framework/core.
- After approval, update config/framework.config.ts and .env.example (one USERNAME/PASSWORD pair per role).
  Then stop: I create the test accounts, fill in .env, and run npm run doctor and npm run qa:sync-ci-secrets.
  Never ask for, write or log credentials.

Step 2 – Propose, then stop
For each test give: behavior verified, test type and Playwright project, golden template ids used,
files to create, evidence (contract section or observed page), and open questions.
Mark anything you could not verify as UNVERIFIED. Wait for my approval.

Step 3 – Implement after approval
- Start every file from its golden template; replace tokens and adapt fields, locators and data.
- Fixtures: start src/fixtures/test-fixtures.ts from the app-fixtures template (role accounts,
  authenticatedPageFor, apiTokenFor). The UPEX reference registers fresh users instead; do not copy that.
- API: schema → client → factory → fixture → spec. Positive test: status → validateSchema → assertions.
  Negative test: status → error assertions, no success schema.
- UI: Page Object (locators by role, label, then test id) → fixture → spec. Use authenticated fixtures,
  not UI login.
- Do not edit framework/core or framework/templates.

Step 4 – Validate
Run: npx prettier --check . ; npm run typecheck ; npm run lint:architecture ; npm run qa:templates:check ;
then the new tests against the target environment.
Fix your own mistakes. If a failure looks like an application defect, stop and report it.
Never weaken assertions, skip tests or change environment permissions to get a pass.

Step 5 – Report
List files created, commands run with results, and open questions.
After I approve, add the accepted files to config/approved-examples.json as project golden examples.
```

## Afterwards

Register the accepted tests in `config/approved-examples.json`:

```json
{
  "examples": [
    {
      "id": "api-spec",
      "need": "Orders API contract and authorization",
      "file": "tests/api/orders.spec.ts"
    }
  ]
}
```

From then on, people and AI tools use these files as the first reference for the same responsibility.
