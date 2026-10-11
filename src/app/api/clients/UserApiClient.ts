import { type APIRequestContext, type APIResponse } from "@playwright/test";

import { getCurrentEnvironment } from "../../../framework/utils/env";
import type { LoginCredentials } from "../schemas/LoginCredentialsSchema";
import type { AuthenticatedUser, TestUser } from "../models/User";
import { authenticationSchema } from "../schemas/AuthenticationSchema";
import { logger } from "../../../framework/utils/logger";
import { validateSchema } from "../../../framework/api/SchemaValidator";

export class UserApiClient {
  constructor(private readonly request: APIRequestContext) {}

  async register(user: Partial<TestUser>): Promise<APIResponse> {
    const { apiBaseUrl } = getCurrentEnvironment();

    return this.request.post(`${apiBaseUrl}/auth/register`, {
      data: {
        ...user,
      },
    });
  }

  async login(credentials: Partial<LoginCredentials>): Promise<APIResponse> {
    const { apiBaseUrl } = getCurrentEnvironment();

    return this.request.post(`${apiBaseUrl}/auth/login`, {
      data: {
        ...credentials,
      },
    });
  }

  async getCurrentUser(accessToken?: string): Promise<APIResponse> {
    const { apiBaseUrl } = getCurrentEnvironment();

    return this.request.get(`${apiBaseUrl}/auth/me`, {
      headers: accessToken
        ? {
            Authorization: `Bearer ${accessToken}`,
          }
        : {},
    });
  }

  async registerUser(user: TestUser): Promise<TestUser> {
    logger.info(`Registering test user: ${user.email}`);

    const registrationResponse = await this.register(user);

    if (!registrationResponse.ok()) {
      logger.error(
        `User registration failed with status ${registrationResponse.status()}`,
      );
      throw new Error(
        `User registration failed: ${registrationResponse.status()} ${await registrationResponse.text()}`,
      );
    }

    logger.info(`Test user registered successfully: ${user.email}`);

    return {
      ...user,
    };
  }

  async registerAndAuthenticateUser(
    user: TestUser,
  ): Promise<AuthenticatedUser> {
    logger.info(`Registering test user: ${user.email}`);

    user = await this.registerUser(user);
    const loginResponse = await this.login(user);

    if (!loginResponse.ok()) {
      logger.error(`User login failed with status ${loginResponse.status()}`);
      throw new Error(
        `User login failed: ${loginResponse.status()} ${await loginResponse.text()}`,
      );
    }

    const body = await loginResponse.json();
    validateSchema(authenticationSchema, body);

    logger.info(`Test user logged in successfully: ${user.email}`);

    return {
      ...user,
      accessToken: body.access_token,
    };
  }
}
