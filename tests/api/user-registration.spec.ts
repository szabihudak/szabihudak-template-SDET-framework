import { test, expect } from "@app/fixtures/test-fixtures";
import type { TestUser } from "@app/api/models/User";
import { HTTP_STATUS } from "@framework/api/httpStatuses";
import { API_ERRORS } from "@app/api/constants/apiErrors";
import { userRegistrationSchema } from "@app/api/schemas/UserRegistrationSchema";
import { validateSchema } from "@framework/api/SchemaValidator";
import { createTestUser, createTestUserPayload } from "@app/data/userFactory";
import { API_MESSAGES } from "@app/api/constants/apiMessages";

type EmptyFieldScenario = {
  name: string;
  overrides: Partial<TestUser>;
  field: keyof TestUser;
  expectedMessage: string;
};

type MissingFieldScenario = {
  name: string;
  missingField: keyof TestUser;
};

const emptyFieldScenarios = [
  {
    name: "rejects an empty email",
    overrides: { email: "" },
    field: "email",
    expectedMessage: API_ERRORS.INVALID_EMAIL_ADDRESS,
  },
  {
    name: "rejects an empty name",
    overrides: { name: "" },
    field: "name",
    expectedMessage: API_ERRORS.NAME_LENGTH_VALIDATION_ERROR,
  },
  {
    name: "rejects an empty password",
    overrides: { password: "" },
    field: "password",
    expectedMessage: API_ERRORS.PASSWORD_LENGTH_VALIDATION_ERROR,
  },
] satisfies EmptyFieldScenario[];

const missingFieldScenarios: MissingFieldScenario[] = [
  {
    name: "rejects a missing email",
    missingField: "email",
  },
  {
    name: "rejects a missing name",
    missingField: "name",
  },
  {
    name: "rejects a missing password",
    missingField: "password",
  },
] satisfies MissingFieldScenario[];

test.describe("User Registration API", () => {
  test("registers a valid user", async ({ userApi }) => {
    const userData = createTestUser();

    const response = await userApi.register(userData);
    expect(response.status()).toBe(HTTP_STATUS.CREATED);

    const body = await response.json();
    validateSchema(userRegistrationSchema, body);

    expect(body.message).toBe(API_MESSAGES.USER_CREATED);
    expect(body.user.email).toBe(userData.email);
    expect(body.user.name).toBe(userData.name);
  });

  test("accepts a 6-character password", async ({ userApi }) => {
    const userData = createTestUser({ password: "123456" });

    const response = await userApi.register(userData);
    expect(response.status()).toBe(HTTP_STATUS.CREATED);

    const body = await response.json();
    validateSchema(userRegistrationSchema, body);

    expect(body.message).toBe(API_MESSAGES.USER_CREATED);
    expect(body.user.email).toBe(userData.email);
    expect(body.user.name).toBe(userData.name);
  });

  test("rejects a password shorter than 6 characters", async ({ userApi }) => {
    const userData = createTestUser({ password: "12345" });

    const response = await userApi.register(userData);
    expect(response.status()).toBe(HTTP_STATUS.BAD_REQUEST);

    const body = await response.json();

    expect(body.error).toBe(API_ERRORS.VALIDATION_FAILED);
    expect(body.details).toEqual({
      formErrors: [],
      fieldErrors: {
        password: [API_ERRORS.PASSWORD_LENGTH_VALIDATION_ERROR],
      },
    });
  });

  test("rejects duplicate registration - same email", async ({ userApi }) => {
    const userData = createTestUser();
    await userApi.register(userData);

    const response = await userApi.register(userData);
    expect(response.status()).toBe(HTTP_STATUS.CONFLICT);

    const body = await response.json();

    expect(body.error).toBe(API_ERRORS.USER_ALREADY_EXISTS);
  });

  for (const scenario of emptyFieldScenarios) {
    test(scenario.name, async ({ userApi }) => {
      const userData = createTestUser(scenario.overrides);

      const response = await userApi.register(userData);
      expect(response.status()).toBe(HTTP_STATUS.BAD_REQUEST);

      const body = await response.json();

      expect(body.error).toBe(API_ERRORS.VALIDATION_FAILED);
      expect(body.details.fieldErrors[scenario.field]).toEqual([
        scenario.expectedMessage,
      ]);
    });
  }

  for (const scenario of missingFieldScenarios) {
    test(scenario.name, async ({ userApi }) => {
      const userData = createTestUserPayload({
        missingFields: [scenario.missingField],
      });

      const response = await userApi.register(userData);
      expect(response.status()).toBe(HTTP_STATUS.BAD_REQUEST);

      const body = await response.json();

      expect(body.error).toBe(API_ERRORS.VALIDATION_FAILED);
      expect(body.details.fieldErrors[scenario.missingField]).toEqual([
        API_ERRORS.REQUIRED_FIELD,
      ]);
    });
  }
});
