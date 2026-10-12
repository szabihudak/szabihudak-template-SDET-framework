import { test, expect } from "@app/fixtures/test-fixtures";
import type { LoginCredentials } from "@app/api/schemas/LoginCredentialsSchema";
import { HTTP_STATUS } from "@framework/api/httpStatuses";
import { API_ERRORS } from "@app/api/constants/apiErrors";
import { authenticationSchema } from "@app/api/schemas/AuthenticationSchema";
import { validateSchema } from "@framework/api/SchemaValidator";

type LoginValidationScenario = {
  name: string;
  statusCode: number;
  overrides: Partial<LoginCredentials>;
  expectedMessage: string;
};

const loginValidationScenarios = [
  {
    name: "rejects an empty email",
    statusCode: HTTP_STATUS.BAD_REQUEST,
    overrides: { email: "", password: "TestPassword1234!" },
    expectedMessage: API_ERRORS.INVALID_LOGIN_FORMAT,
  },
  {
    name: "rejects an empty password",
    statusCode: HTTP_STATUS.BAD_REQUEST,
    overrides: { email: "test@example.com", password: "" },
    expectedMessage: API_ERRORS.INVALID_LOGIN_FORMAT,
  },
  {
    name: "rejects a malformed email",
    statusCode: HTTP_STATUS.BAD_REQUEST,
    overrides: { email: "user.com", password: "TestPassword1234!" },
    expectedMessage: API_ERRORS.INVALID_LOGIN_FORMAT,
  },
  {
    name: "rejects an unknown user",
    statusCode: HTTP_STATUS.UNAUTHORIZED,
    overrides: { email: "somebody@gmail.com", password: "TestPassword1234!" },
    expectedMessage: API_ERRORS.INVALID_CREDENTIALS,
  },
  {
    name: "rejects a missing email",
    statusCode: HTTP_STATUS.BAD_REQUEST,
    overrides: { password: "TestPassword1234!" },
    expectedMessage: API_ERRORS.INVALID_LOGIN_FORMAT,
  },
  {
    name: "rejects a missing password",
    statusCode: HTTP_STATUS.BAD_REQUEST,
    overrides: { email: "test@example.com" },
    expectedMessage: API_ERRORS.INVALID_LOGIN_FORMAT,
  },
] satisfies LoginValidationScenario[];

test.describe("User Authentication API", () => {
  test("authenticates a valid user", async ({
    userApi,
    registeredTestUser,
  }) => {
    const credentials = {
      email: registeredTestUser.email,
      password: registeredTestUser.password,
    };

    const response = await userApi.login(credentials);
    expect(response.status()).toBe(HTTP_STATUS.OK);

    const body = await response.json();
    validateSchema(authenticationSchema, body);

    expect(body.access_token).toBeTruthy();
    expect(body.token_type).toBe("Bearer");
    expect(body.expires_in).toBe(86400);
  });

  test("rejects a valid user with wrong password", async ({
    userApi,
    registeredTestUser,
  }) => {
    const credentials = {
      email: registeredTestUser.email,
      password: "wrong_pwd_123",
    };

    const response = await userApi.login(credentials);
    expect(response.status()).toBe(HTTP_STATUS.UNAUTHORIZED);

    const body = await response.json();

    expect(body.error).toBe(API_ERRORS.INVALID_CREDENTIALS);
  });

  for (const scenario of loginValidationScenarios) {
    test(scenario.name, async ({ userApi }) => {
      const credentials = scenario.overrides;

      const response = await userApi.login(credentials);
      expect(response.status()).toBe(scenario.statusCode);

      const body = await response.json();

      expect(body.error).toBe(scenario.expectedMessage);
    });
  }
});
