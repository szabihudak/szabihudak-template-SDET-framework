import assert from "node:assert/strict";
import { test } from "node:test";

import { parsePlannedFiles } from "../handoff.ts";
import {
  addExamples,
  featureTitle,
  proposeExamples,
  type ApprovedExample,
} from "../approve-examples.ts";

const PLAN = `# Login test plan

## Files

| Layer   | Path                               | Decision                    | Golden example or template |
| ------- | ---------------------------------- | --------------------------- | -------------------------- |
| Schema  | src/api/schemas/LoginRequestSchema.ts | create: login body       | request-schema             |
| Schema  | src/api/schemas/LoginResponseSchema.ts | create: login response  | response-schema            |
| Client  | src/api/clients/AuthApiClient.ts   | create: no auth client yet  | api-client                 |
| Factory | src/data/loginFactory.ts           | create: login data          | factory                    |
| Fixture | src/fixtures/test-fixtures.ts      | extend: authApi             | app-fixtures               |
| Spec    | tests/api/login.spec.ts            | create                      | api-spec                   |
| Spec    | tests/api/logout.spec.ts           | create                      | api-spec                   |
| Mock    | src/mocks/loginMock.ts             | create                      | my-own-pattern             |
`;

const TEMPLATE_IDS = [
  "request-schema",
  "response-schema",
  "api-client",
  "factory",
  "app-fixtures",
  "api-spec",
];

const propose = (
  overrides: Partial<Parameters<typeof proposeExamples>[0]> = {},
) =>
  proposeExamples({
    plan: "test-plans/login.md",
    review: "test-reviews/login.md",
    verdict: "PASS",
    title: featureTitle(PLAN, "login"),
    planned: parsePlannedFiles(PLAN),
    templateIds: TEMPLATE_IDS,
    existing: [],
    exists: () => true,
    ...overrides,
  });

test("names the feature after the plan's heading", () => {
  assert.equal(featureTitle(PLAN, "login"), "Login");
  assert.equal(featureTitle("# Plan\n", "login"), "login");
});

test("proposes one example per template id from the create rows", () => {
  const result = propose();
  assert.deepEqual(result.errors, []);
  assert.deepEqual(
    result.proposals.map(({ id, file }) => [id, file]),
    [
      ["request-schema", "src/api/schemas/LoginRequestSchema.ts"],
      ["response-schema", "src/api/schemas/LoginResponseSchema.ts"],
      ["api-client", "src/api/clients/AuthApiClient.ts"],
      ["factory", "src/data/loginFactory.ts"],
      ["api-spec", "tests/api/login.spec.ts"],
    ],
  );
  assert.equal(
    result.proposals[2].need,
    "Client for Login (test-plans/login.md)",
  );

  const reasons = Object.fromEntries(
    result.skipped.map(({ file, reason }) => [file, reason]),
  );
  assert.match(reasons["src/fixtures/test-fixtures.ts"], /extend, not create/);
  assert.match(
    reasons["tests/api/logout.spec.ts"],
    /already proposes api-spec/,
  );
  assert.match(reasons["src/mocks/loginMock.ts"], /no golden template id/);
});

test("never replaces an example the project has, nor registers a file twice", () => {
  const existing: ApprovedExample[] = [
    {
      id: "api-client",
      need: "Orders API client",
      file: "src/api/clients/OrderApiClient.ts",
    },
    {
      id: "api-spec-login",
      need: "Login spec",
      file: "tests/api/login.spec.ts",
    },
  ];
  const result = propose({ existing });
  const ids = result.proposals.map(({ id }) => id);
  assert.ok(!ids.includes("api-client"));
  // login.spec.ts is registered already, so the plan's next api-spec is proposed.
  assert.equal(
    result.proposals.find(({ id }) => id === "api-spec")?.file,
    "tests/api/logout.spec.ts",
  );
  assert.match(
    result.skipped.map(({ reason }) => reason).join("\n"),
    /already has an example for api-client: src\/api\/clients\/OrderApiClient\.ts/,
  );
});

test("proposes nothing without a PASS review, or for files that do not exist", () => {
  const unreviewed = propose({ verdict: "CHANGES NEEDED" });
  assert.deepEqual(unreviewed.proposals, []);
  assert.match(unreviewed.errors.join("\n"), /only files of a PASS review/);

  const missing = propose({
    exists: (file) => !file.includes("Factory") && !file.includes("factory"),
  });
  assert.ok(!missing.proposals.some(({ id }) => id === "factory"));
});

test("adds the chosen proposals after the existing examples, keeping the comment", () => {
  const written = addExamples(
    {
      $comment: "Project golden examples",
      examples: [
        { id: "factory", need: "Order data", file: "src/data/orderFactory.ts" },
      ],
    },
    propose().proposals.filter(({ id }) => id === "api-spec"),
  );
  assert.equal(written.$comment, "Project golden examples");
  assert.deepEqual(written.examples, [
    { id: "factory", need: "Order data", file: "src/data/orderFactory.ts" },
    {
      id: "api-spec",
      need: "Spec for Login (test-plans/login.md)",
      file: "tests/api/login.spec.ts",
    },
  ]);
});
