import { test as base, expect, type Page } from "@playwright/test";

import { AccessibilityScanner } from "../accessibility/utils/AccessibilityScanner";
import { TaskApiClient } from "../api/clients/TaskApiClient";
import { UserApiClient } from "../api/clients/UserApiClient";
import type { AuthenticatedUser, TestUser } from "../api/models/User";
import type { TaskResponse } from "../api/schemas/TaskResponseSchema";
import { NavigationBar } from "../components/NavigationBar";
import { createTask, type CompleteTaskRequest } from "../data/taskFactory";
import { createTestUser } from "../data/userFactory";
import { HomePage } from "../pages/HomePage";
import { LoginPage } from "../pages/LoginPage";
import { RegisterPage } from "../pages/RegisterPage";
import { TasksDashboardPage } from "../pages/TasksDashboardPage";
import { getCurrentEnvironment } from "../utils/env";

type CreatedTask = {
  request: CompleteTaskRequest;
  response: TaskResponse;
};

type AppFixtures = {
  homePage: HomePage;
  loginPage: LoginPage;
  registerPage: RegisterPage;
  navigation: NavigationBar;
  accessibility: AccessibilityScanner;
  userApi: UserApiClient;
  taskApi: TaskApiClient;
  testUserData: TestUser;
  registeredTestUser: TestUser;
  authenticatedTestUser: AuthenticatedUser;
  createdTask: CreatedTask;
  authenticatedPage: Page;
  authenticatedAccessibility: AccessibilityScanner;
  tasksDashboardPage: TasksDashboardPage;
};

export const test = base.extend<AppFixtures>({
  homePage: async ({ page }, use) => {
    await use(new HomePage(page));
  },

  loginPage: async ({ page }, use) => {
    await use(new LoginPage(page));
  },

  registerPage: async ({ page }, use) => {
    await use(new RegisterPage(page));
  },

  navigation: async ({ page }, use) => {
    await use(new NavigationBar(page));
  },

  accessibility: async ({ page }, use) => {
    await use(new AccessibilityScanner(page));
  },

  userApi: async ({ request }, use) => {
    await use(new UserApiClient(request));
  },

  taskApi: async ({ request }, use) => {
    await use(new TaskApiClient(request));
  },

  testUserData: async ({}, use) => {
    await use(createTestUser());
  },

  registeredTestUser: async ({ userApi }, use) => {
    const user = await userApi.registerUser(createTestUser());

    await use(user);
  },

  authenticatedTestUser: async ({ userApi }, use) => {
    const user = await userApi.registerAndAuthenticateUser(createTestUser());

    await use(user);
  },

  createdTask: async ({ taskApi, authenticatedTestUser }, use) => {
    const request = createTask();

    const response = await taskApi.createTaskForUser(
      request,
      authenticatedTestUser.accessToken,
    );

    await use({
      request,
      response,
    });
  },

  authenticatedPage: async ({ browser, authenticatedTestUser }, use) => {
    const { webBaseUrl } = getCurrentEnvironment();

    const context = await browser.newContext({
      baseURL: webBaseUrl,
    });

    const csrfResponse = await context.request.get("/api/auth/csrf");

    if (!csrfResponse.ok()) {
      throw new Error(
        `Failed to obtain NextAuth CSRF token: ${csrfResponse.status()}`,
      );
    }

    const { csrfToken } = await csrfResponse.json();

    const loginResponse = await context.request.post(
      "/api/auth/callback/credentials",
      {
        form: {
          csrfToken,
          email: authenticatedTestUser.email,
          password: authenticatedTestUser.password,
          callbackUrl: `${webBaseUrl}/dashboard`,
        },
      },
    );

    if (!loginResponse.ok()) {
      throw new Error(
        `Programmatic authentication failed: ${loginResponse.status()} ${await loginResponse.text()}`,
      );
    }

    const page = await context.newPage();

    await page.goto("/dashboard");

    await page.waitForURL("**/dashboard");

    await use(page);

    await context.close();
  },

  authenticatedAccessibility: async ({ authenticatedPage }, use) => {
    await use(new AccessibilityScanner(authenticatedPage));
  },

  tasksDashboardPage: async ({ authenticatedPage }, use) => {
    await use(new TasksDashboardPage(authenticatedPage));
  },
});

export { expect };
