import { test as base, expect, type Page } from "@playwright/test";

import { AccessibilityScanner } from "../accessibility/utils/AccessibilityScanner";
import { getApiAccessToken } from "../auth/apiLogin";
import { openAuthenticatedPage } from "../auth/browserLogin";
import { getRoleCredentials, type Credentials } from "../auth/credentials";
import { DatabaseClient } from "../database/DatabaseClient";
import { assertEnvironmentAllows } from "../utils/env";

type FrameworkFixtures = {
  accessibility: AccessibilityScanner;
  apiTokenFor: (role: string) => Promise<string>;
  authenticatedPageFor: (credentials: Credentials) => Promise<Page>;
  databaseClient: DatabaseClient;
};

export const test = base.extend<FrameworkFixtures>({
  accessibility: async ({ page }, use) => {
    await use(new AccessibilityScanner(page));
  },

  // Bearer token for a role configured in config/framework.config.ts, logged in
  // once per test and reused for later requests in the same test.
  apiTokenFor: async ({ request }, use) => {
    const tokens = new Map<string, Promise<string>>();

    await use((role) => {
      let token = tokens.get(role);

      if (!token) {
        token = getApiAccessToken(request, getRoleCredentials(role));
        tokens.set(role, token);
      }

      return token;
    });
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
