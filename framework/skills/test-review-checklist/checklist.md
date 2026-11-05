# Test review checks

## C: Cases match the plan

For every row of the plan's Cases table, find its `test()` and compare:

- **C1 Steps:** the test performs the plan's steps, in order.
- **C2 Expected result:** an assertion checks the observable outcome the plan names, not only part of it.
- **C3 Type:** a Negative case really sends invalid, missing or unauthorized input.
- **C4 Test data:** the test uses the data the plan describes, such as the boundary value.
- **C5 No extra tests:** every `test()` in the listed specs belongs to a plan case.
- **C6 No missing cases:** every plan case has a test.
- **C7 Expected values from the source:** asserted values come from the plan's Source; only a Source of `observed` allows a value taken from a response.

## G: No green-washing

A test may pass only because the application does what the plan expects. In an existing test, the removed lines are the evidence: anything stricter before the change than after it is a finding. In a new test, measure against C2 and C7.

- **G1** Weak assertions: `toBeDefined()` or `toBeTruthy()` on a field where the plan names its value.
- **G2** Removed assertions without an equally strict replacement.
- **G3** Looser matchers: `toBe` → `toContain`, `toEqual` → `toBeTruthy`, `toHaveText` → `toBeVisible`, `toHaveLength(n)` → `toBeGreaterThan(0)`.
- **G4** Expected values changed to the actual result, such as a status or message, without the plan's Source.
- **G5** `expect.soft` in place of an assertion.
- **G6** Branches that skip the behavior under test, such as an early `return` on a status.
- **G7** Accepted failure: `test.fail()`, `test.fixme()`, retries in `test.describe.configure()`.
- **G8** Fixed waits, raised timeouts, retries in `playwright.config.ts`.
- **G9** Looser schemas or data: a new `Type.Optional`, `Type.Any`, `Type.Unknown` or union member, or factory data that avoids the failing branch.
- **G10** Updated snapshots, baselines or performance thresholds.
- **G11** Deleted or renamed tests, or a case ID moved to an easier test.
- **G12** CI escapes: `continue-on-error`, `|| true`, a removed workflow step.
- **G13** New lint escapes: a `// quarantine:` or `// partial:` comment added in this change. Only a person may quarantine a test or accept a partial comparison.

## S: The structure exists and is used

Measure against the plan's Files table and the layers the chosen spec template uses, directly or through its fixtures.

- **S1** Every `create` file exists at the template's `output` path and name.
- **S2** Every `extend` file changed, and its name still describes its responsibility.
- **S3** Every `reuse` file is used, not duplicated.
- **S4** API: every endpoint the tests call has an API client method; every request body a request schema; every successful response a response schema checked with `validateSchema()`; payloads come from a factory.
- **S5** UI: every page the tests visit has a Page Object, repeated parts a Component Object; locators and user actions live there.
- **S6** Setup belongs in fixtures: authenticated clients and Pages, test data and its cleanup come from `src/fixtures/test-fixtures.ts`. A spec may build a Page or Component Object on a Page a fixture gave it; a fixture only for that would hide trivial construction (Fixture Standard).
- **S7** Mocks are in `src/mocks/`, database checks in a domain database client under `src/database/clients/`.
- **S8** Repeated domain values and messages are constants in `src/api/constants/`, not strings copied into tests.
- **S9** Each new file follows its golden template and `canonical` example: methods, naming, exports, fail-fast setup helpers.
- **S10** A layer the spec template needs is in neither the Files table nor the change: a Plan finding.

## L: Layer boundaries

- **L1 No locators in specs.** A spec calls Page and Component Object methods and uses locators they expose. Report what the lint misses under `tests/`: `page.evaluate()` reading the DOM; selectors held in variables or constants; selectors passed to a Page Object; helper files under `tests/` that hold locators.
- **L2 No comparisons in Page Objects.** A Page or Component Object returns locators, performs actions and reads data; the spec compares. Report what the lint misses under `src/pages/`, `src/components/`, `src/fixtures/` and `src/api/clients/`: comparisons of values read without `await` in the same expression; expected values written into the object; `waitFor()` used as a hidden check in a `verify...()` method; branches on application state that decide the correct behavior.

## Scope

- Only the files in the plan's Files table changed. `framework/` and the plan are unchanged. `test-reviews/` is not part of the scope.
