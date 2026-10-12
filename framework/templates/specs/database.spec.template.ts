// @template database-spec: Persistence validation after behavior created through the API.
// @template Canonical source: tests/database/task-database.spec.ts. Rules: framework/docs/TESTING_STANDARDS.md#database-test-standard
// @template Replace the tokens described in framework/templates/index.json. Fields, locators and test data are illustrative.
import { create__Domain__ } from "@app/data/__domain__Factory";
import { test, expect } from "@app/fixtures/test-fixtures";

test.describe("__Domain__ database validation", () => {
  test("__domain__ is persisted with the expected data", async ({
    authenticatedTestUser,
    __domain__Api,
    __domain__Database,
  }) => {
    const user = authenticatedTestUser;
    const __domain__Data = create__Domain__();
    const created__Domain__ = await __domain__Api.create__Domain__ForUser(
      __domain__Data,
      user.accessToken,
    );
    const __domain__InDb = await __domain__Database.findById(created__Domain__.id);

    expect(__domain__InDb).not.toBeNull();
    expect(__domain__InDb?.title).toBe(__domain__Data.title);
    expect(__domain__InDb?.description).toBe(__domain__Data.description);
    expect(__domain__InDb?.priority).toBe(__domain__Data.priority);
    expect(__domain__InDb?.status).toBe(__domain__Data.status);
    expect(__domain__InDb?.user_id).toBe(created__Domain__.userId);
    expect(__domain__InDb?.created_at).not.toBeNull();
    expect(__domain__InDb?.updated_at).not.toBeNull();
  });
});
