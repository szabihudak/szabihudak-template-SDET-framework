import { test as base, expect, type Page } from "@playwright/test";

import { AccessibilityScanner } from "../accessibility/utils/AccessibilityScanner";
import { openAuthenticatedPage } from "../auth/browserLogin";
import type { Credentials } from "../auth/credentials";
import { DatabaseClient } from "../database/DatabaseClient";
import { assertEnvironmentAllows } from "../utils/env";

type FrameworkFixtures = {
  accessibility: AccessibilityScanner;
  authenticatedPageFor: (credentials: Credentials) => Promise<Page>;
  databaseClient: DatabaseClient;
};

export const test = base.extend<FrameworkFixtures>({
  accessibility: async ({ page }, use) => {
    await use(new AccessibilityScanner(page));
  },

  authenticatedPageFor: async ({ browser }, use) => {
    const pages: Page[] = [];

    await use(async (credentials) => {
      const page = await openAuthenticatedPage(browser, credentials);
      pages.push(page);

      return page;
    });

    for (const page of pages) {
      await page.context().close();
    }
  },

  databaseClient: async ({}, use) => {
    assertEnvironmentAllows("database", "Direct database access");
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
