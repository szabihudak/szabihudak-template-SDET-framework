import { test as base, expect } from "@playwright/test";

import { AccessibilityScanner } from "../accessibility/utils/AccessibilityScanner";
import { DatabaseClient } from "../database/DatabaseClient";

type FrameworkFixtures = {
  accessibility: AccessibilityScanner;
  databaseClient: DatabaseClient;
};

export const test = base.extend<FrameworkFixtures>({
  accessibility: async ({ page }, use) => {
    await use(new AccessibilityScanner(page));
  },

  databaseClient: async ({}, use) => {
    const testEnvironment = process.env.TEST_ENV;
    if (testEnvironment !== "localDocker") {
      throw new Error(
        `Database tests are only allowed in the localDocker environment. Received TEST_ENV=${testEnvironment ?? "undefined"}`,
      );
    }
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error("DATABASE_URL is not defined");
    }
    const databaseClient = new DatabaseClient(connectionString);
    await use(databaseClient);
    await databaseClient.close();
  },
});

export { expect };
