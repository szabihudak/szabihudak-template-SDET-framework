// @template api-spec: API behavior: positive contract tests and negative tests.
// @template Canonical source: tests/api/create-task.spec.ts. Rules: docs/TESTING_STANDARDS.md#api-test-standard
// @template Replace the __Tokens__ described in .qa/index.json. Fields, locators and test data are illustrative.
import { test, expect } from "../../src/app/fixtures/test-fixtures";
import { HTTP_STATUS } from "../../src/framework/api/httpStatuses";
import { API_ERRORS } from "../../src/app/api/constants/apiErrors";
import type { __Domain__Request } from "../../src/app/api/schemas/__Domain__RequestSchema";
import {
  type CurrentUser,
  currentUserSchema,
} from "../../src/app/api/schemas/CurrentUserSchema";
import { __domain__ResponseSchema } from "../../src/app/api/schemas/__Domain__ResponseSchema";
import { validateSchema } from "../../src/framework/api/SchemaValidator";
import {
  create__Domain__,
  create__Domain__Payload,
} from "../../src/app/data/__domain__Factory";
import type { UserApiClient } from "../../src/app/api/clients/UserApiClient";

type Missing__Domain__FieldScenario = {
  name: string;
  missingField: keyof __Domain__Request;
};

const missing__Domain__FieldScenarios = [
  {
    name: "rejects a missing title",
    missingField: "title",
  },
] satisfies Missing__Domain__FieldScenario[];

test.describe("Create a __Domain__ API", () => {
  test("creates a __domain__ matching the provider contract", async ({
    userApi,
    __domain__Api,
    authenticatedTestUser,
  }) => {
    const user = authenticatedTestUser;
    const currentUser = await getCurrentUser(userApi, user.accessToken);
    const __domain__Data = create__Domain__();

    const response = await __domain__Api.create__Domain__(
      __domain__Data,
      user.accessToken,
    );
    expect(response.status()).toBe(HTTP_STATUS.CREATED);

    const body = await response.json();
    validateSchema(__domain__ResponseSchema, body);

    expect(body.description).toBe(__domain__Data.description);
    expect(body.priority).toBe(__domain__Data.priority);
    expect(body.status).toBe(__domain__Data.status);
    expect(body.title).toBe(__domain__Data.title);
    expect(body.userId).toBe(currentUser.user.id);
  });

  test("defaults description to null when omitted", async ({
    userApi,
    __domain__Api,
    authenticatedTestUser,
  }) => {
    const user = authenticatedTestUser;
    const currentUser = await getCurrentUser(userApi, user.accessToken);
    const __domain__Data = create__Domain__Payload({
      missingFields: ["description"],
    });

    const response = await __domain__Api.create__Domain__(
      __domain__Data,
      user.accessToken,
    );
    expect(response.status()).toBe(HTTP_STATUS.CREATED);

    const body = await response.json();
    validateSchema(__domain__ResponseSchema, body);

    expect(body.description).toBeNull();
    expect(body.priority).toBe(__domain__Data.priority);
    expect(body.status).toBe(__domain__Data.status);
    expect(body.title).toBe(__domain__Data.title);
    expect(body.userId).toBe(currentUser.user.id);
  });

  test("defaults priority to medium when omitted", async ({
    userApi,
    __domain__Api,
    authenticatedTestUser,
  }) => {
    const user = authenticatedTestUser;
    const currentUser = await getCurrentUser(userApi, user.accessToken);
    const __domain__Data = create__Domain__Payload({
      missingFields: ["priority"],
    });

    const response = await __domain__Api.create__Domain__(
      __domain__Data,
      user.accessToken,
    );
    expect(response.status()).toBe(HTTP_STATUS.CREATED);

    const body = await response.json();
    validateSchema(__domain__ResponseSchema, body);

    expect(body.description).toBe(__domain__Data.description);
    expect(body.priority).toBe("medium");
    expect(body.status).toBe(__domain__Data.status);
    expect(body.title).toBe(__domain__Data.title);
    expect(body.userId).toBe(currentUser.user.id);
  });

  test("defaults status to backlog when omitted", async ({
    userApi,
    __domain__Api,
    authenticatedTestUser,
  }) => {
    const user = authenticatedTestUser;
    const currentUser = await getCurrentUser(userApi, user.accessToken);
    const __domain__Data = create__Domain__Payload({
      missingFields: ["status"],
    });

    const response = await __domain__Api.create__Domain__(
      __domain__Data,
      user.accessToken,
    );
    expect(response.status()).toBe(HTTP_STATUS.CREATED);

    const body = await response.json();
    validateSchema(__domain__ResponseSchema, body);

    expect(body.description).toBe(__domain__Data.description);
    expect(body.priority).toBe(__domain__Data.priority);
    expect(body.status).toBe("backlog");
    expect(body.title).toBe(__domain__Data.title);
    expect(body.userId).toBe(currentUser.user.id);
  });

  test("rejects __domain__ without user token", async ({ __domain__Api }) => {
    const __domain__Data = create__Domain__();

    const response = await __domain__Api.create__Domain__(__domain__Data, "");
    expect(response.status()).toBe(HTTP_STATUS.UNAUTHORIZED);

    const body = await response.json();

    expect(body.error).toBe(API_ERRORS.UNAUTHORIZED);
  });

  test("rejects __domain__ with invalid user token", async ({
    __domain__Api,
  }) => {
    const __domain__Data = create__Domain__();

    const response = await __domain__Api.create__Domain__(
      __domain__Data,
      "Invalid-Token_123",
    );
    expect(response.status()).toBe(HTTP_STATUS.UNAUTHORIZED);

    const body = await response.json();

    expect(body.error).toBe(API_ERRORS.UNAUTHORIZED);
  });

  test("rejects __domain__ with unsupported priority", async ({
    __domain__Api,
    authenticatedTestUser,
  }) => {
    const user = authenticatedTestUser;
    const __domain__Data = {
      ...create__Domain__(),
      priority: "critical" as __Domain__Request["priority"],
    };

    const response = await __domain__Api.create__Domain__(
      __domain__Data,
      user.accessToken,
    );
    expect(response.status()).toBe(HTTP_STATUS.BAD_REQUEST);

    const body = await response.json();

    expect(body.error).toBe(API_ERRORS.VALIDATION_FAILED);
  });

  for (const scenario of missing__Domain__FieldScenarios) {
    test(scenario.name, async ({ __domain__Api, authenticatedTestUser }) => {
      const user = authenticatedTestUser;
      const __domain__Data = create__Domain__Payload({
        missingFields: [scenario.missingField],
      });

      const response = await __domain__Api.create__Domain__(
        __domain__Data,
        user.accessToken,
      );
      expect(response.status()).toBe(HTTP_STATUS.BAD_REQUEST);

      const body = await response.json();

      expect(body.error).toBe(API_ERRORS.VALIDATION_FAILED);
      expect(body.details.fieldErrors[scenario.missingField]).toEqual([
        API_ERRORS.REQUIRED_FIELD,
      ]);
    });
  }
});

async function getCurrentUser(
  userApi: UserApiClient,
  accessToken: string,
): Promise<CurrentUser> {
  const response = await userApi.getCurrentUser(accessToken);
  expect(response.status()).toBe(HTTP_STATUS.OK);

  const body = await response.json();
  validateSchema(currentUserSchema, body);
  return body;
}
