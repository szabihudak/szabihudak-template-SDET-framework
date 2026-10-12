import { type Page } from "@playwright/test";

import { AccessibilityScanner } from "@framework/accessibility/utils/AccessibilityScanner";
import {
  test as frameworkTest,
  expect,
} from "@framework/fixtures/framework-fixtures";

import { TaskApiClient } from "@app/api/clients/TaskApiClient";
import { UserApiClient } from "@app/api/clients/UserApiClient";
import type { AuthenticatedUser, TestUser } from "@app/api/models/User";
import type { TaskResponse } from "@app/api/schemas/TaskResponseSchema";
import { NavigationBar } from "@app/components/NavigationBar";
import { createTask, type CompleteTaskRequest } from "@app/data/taskFactory";
import { createTestUser } from "@app/data/userFactory";
import { TaskDatabaseClient } from "@app/database/clients/TaskDatabaseClient";
import { UserDatabaseClient } from "@app/database/clients/UserDatabaseClient";
import { HomePage } from "@app/pages/HomePage";
import { LoginPage } from "@app/pages/LoginPage";
import { RegisterPage } from "@app/pages/RegisterPage";
import { TasksDashboardPage } from "@app/pages/TasksDashboardPage";

type CreatedTask = {
  request: CompleteTaskRequest;
  response: TaskResponse;
};

type AppFixtures = {
  homePage: HomePage;
  loginPage: LoginPage;
  registerPage: RegisterPage;
  navigation: NavigationBar;
  userApi: UserApiClient;
  taskApi: TaskApiClient;
  testUserData: TestUser;
  registeredTestUser: TestUser;
  authenticatedTestUser: AuthenticatedUser;
  createdTask: CreatedTask;
  userDatabase: UserDatabaseClient;
  taskDatabase: TaskDatabaseClient;
  authenticatedPage: Page;
  authenticatedAccessibility: AccessibilityScanner;
  tasksDashboardPage: TasksDashboardPage;
};

export const test = frameworkTest.extend<AppFixtures>({
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

  userDatabase: async ({ databaseClient }, use) => {
    await use(new UserDatabaseClient(databaseClient));
  },

  taskDatabase: async ({ databaseClient }, use) => {
    await use(new TaskDatabaseClient(databaseClient));
  },

  authenticatedPage: async (
    { authenticatedPageFor, authenticatedTestUser },
    use,
  ) => {
    const page = await authenticatedPageFor({
      username: authenticatedTestUser.email,
      password: authenticatedTestUser.password,
    });

    await use(page);
  },

  authenticatedAccessibility: async ({ authenticatedPage }, use) => {
    await use(new AccessibilityScanner(authenticatedPage));
  },

  tasksDashboardPage: async ({ authenticatedPage }, use) => {
    await use(new TasksDashboardPage(authenticatedPage));
  },
});

export { expect };
