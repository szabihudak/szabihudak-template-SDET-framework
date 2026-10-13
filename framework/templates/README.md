# Golden Templates

Generated from `framework/templates/index.json` by `npm run qa:templates:build`. Do not edit by hand.

Each template is a validated implementation with the application-specific names replaced by tokens.
Copy the template to its output path, replace the tokens, then adapt fields, locators and test data to your application.
In VS Code, type `qa-<id>` to insert a template as a snippet.

Project-specific examples registered in `config/approved-examples.json` take precedence over these templates.

## Tokens

| Token           | Meaning                                                               |
| --------------- | --------------------------------------------------------------------- |
| `__Domain__`    | Singular domain type name, e.g. Order                                 |
| `__domain__`    | Singular domain identifier, e.g. order                                |
| `__Domains__`   | Plural domain type name, e.g. Orders                                  |
| `__domains__`   | Plural domain identifier or API resource, e.g. orders                 |
| `__DOMAIN__`    | Upper-case domain constant prefix, e.g. ORDER                         |
| `__Page__`      | Page Object name without the Page suffix, e.g. OrdersOverview         |
| `__page__`      | Page Object fixture name without the Page suffix, e.g. ordersOverview |
| `__Component__` | Component Object class name, e.g. NavigationBar                       |

## Templates

| Id                      | Use when you need                                                                                                 | Template                                          | Output                                             | Rules                                                                              |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- | -------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `domain-constants`      | Reusable domain values such as supported statuses, with derived union types                                       | [template](api/domain-constants.template.ts)      | `src/api/constants/__domain__.ts`                  | [rules](../../framework/docs/TESTING_STANDARDS.md#constants-standard)              |
| `request-schema`        | Provider request contract for creating a resource                                                                 | [template](api/request-schema.template.ts)        | `src/api/schemas/__Domain__RequestSchema.ts`       | [rules](../../framework/docs/TESTING_STANDARDS.md#schema-standard)                 |
| `update-request-schema` | Provider request contract for partially updating a resource                                                       | [template](api/update-request-schema.template.ts) | `src/api/schemas/__Domain__UpdateRequestSchema.ts` | [rules](../../framework/docs/TESTING_STANDARDS.md#schema-standard)                 |
| `response-schema`       | Provider response contract, used for runtime validation                                                           | [template](api/response-schema.template.ts)       | `src/api/schemas/__Domain__ResponseSchema.ts`      | [rules](../../framework/docs/TESTING_STANDARDS.md#schema-standard)                 |
| `api-client`            | HTTP interaction with a domain endpoint: raw request methods plus fail-fast setup helpers                         | [template](api/api-client.template.ts)            | `src/api/clients/__Domain__ApiClient.ts`           | [rules](../../framework/docs/TESTING_STANDARDS.md#api-client-standard)             |
| `factory`               | Test data: complete valid object with overrides, plus partial request payloads                                    | [template](data/factory.template.ts)              | `src/data/__domain__Factory.ts`                    | [rules](../../framework/docs/TESTING_STANDARDS.md#factory-standard)                |
| `page-object`           | Page-level UI structure, actions and locator queries                                                              | [template](ui/page-object.template.ts)            | `src/pages/__Page__Page.ts`                        | [rules](../../framework/docs/TESTING_STANDARDS.md#page-object-standard)            |
| `component-object`      | Reusable UI region that is not a whole page                                                                       | [template](ui/component-object.template.ts)       | `src/components/__Component__.ts`                  | [rules](../../framework/docs/TESTING_STANDARDS.md#component-object-standard)       |
| `network-mock`          | Controlled network behavior for one scenario, leaving other requests untouched                                    | [template](ui/network-mock.template.ts)           | `src/mocks/__domain__ApiMock.ts`                   | [rules](../../framework/docs/TESTING_STANDARDS.md#mock-standard)                   |
| `app-fixtures`          | Application fixtures that provide API clients, Page Objects for a logged-in role and test-owned data with cleanup | [template](fixtures/app-fixtures.template.ts)     | `src/fixtures/test-fixtures.ts`                    | [rules](../../framework/docs/TESTING_STANDARDS.md#fixture-standard)                |
| `database-client`       | Domain-specific parameterized SQL and persisted record mapping                                                    | [template](database/database-client.template.ts)  | `src/database/clients/__Domain__DatabaseClient.ts` | [rules](../../framework/docs/TESTING_STANDARDS.md#database-test-standard)          |
| `api-spec`              | API behavior: positive contract tests and negative tests                                                          | [template](specs/api.spec.template.ts)            | `tests/api/create-__domain__.spec.ts`              | [rules](../../framework/docs/TESTING_STANDARDS.md#api-test-standard)               |
| `api-scenario-spec`     | API behavior with table-driven boundary, validation and authorization scenarios                                   | [template](specs/api-scenarios.spec.template.ts)  | `tests/api/update-__domain__.spec.ts`              | [rules](../../framework/docs/TESTING_STANDARDS.md#negative-api-test-standard)      |
| `ui-spec`               | Browser behavior with API setup, Page Object interaction and a mocked error state                                 | [template](specs/ui.spec.template.ts)             | `tests/ui/__domain__-__page__.spec.ts`             | [rules](../../framework/docs/TESTING_STANDARDS.md#ui-spec-standard)                |
| `database-spec`         | Persistence validation after behavior created through the API                                                     | [template](specs/database.spec.template.ts)       | `tests/database/__domain__-database.spec.ts`       | [rules](../../framework/docs/TESTING_STANDARDS.md#database-test-standard)          |
| `accessibility-spec`    | Full-page automated accessibility scans of public and authenticated pages                                         | [template](specs/accessibility.spec.template.ts)  | `tests/accessibility/accessibility.spec.ts`        | [rules](../../framework/docs/TESTING_STANDARDS.md#accessibility-test-standard)     |
| `visual-spec`           | Page-level and component-level screenshot contracts on deterministic state                                        | [template](specs/visual.spec.template.ts)         | `tests/visual/visual.spec.ts`                      | [rules](../../framework/docs/TESTING_STANDARDS.md#visual-regression-test-standard) |
| `lighthouse-spec`       | Authenticated browser performance measured by Lighthouse after deterministic setup                                | [template](specs/lighthouse.spec.template.ts)     | `tests/performance/lighthouse-__page__.spec.ts`    | [rules](../../framework/docs/TESTING_STANDARDS.md#browser-performance-standard)    |
| `k6-workload`           | API workload performance with setup outside the measured operation and native thresholds                          | [template](performance/k6-workload.template.js)   | `tests/performance/k6/__domain__ReadLoad.js`       | [rules](../../framework/docs/TESTING_STANDARDS.md#api-performance-standard)        |
