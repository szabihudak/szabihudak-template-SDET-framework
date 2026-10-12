// @template app-fixtures: Application fixtures that provide API clients, Page Objects for a logged-in role and test-owned data with cleanup.
// @template No reference-implementation file: UPEX registers fresh users instead of using role accounts. Validated by the setup self-test. Rules: framework/docs/TESTING_STANDARDS.md#fixture-standard
// @template Replace the tokens described in framework/templates/index.json. Use the role names from config/framework.config.ts.
import {
  test as frameworkTest,
  expect,
} from "@framework/fixtures/framework-fixtures";
import { getRoleCredentials } from "@framework/auth/credentials";

import { __Domain__ApiClient } from "@app/api/clients/__Domain__ApiClient";
import type { __Domain__Response } from "@app/api/schemas/__Domain__ResponseSchema";
import { create__Domain__ } from "@app/data/__domain__Factory";
import { __Page__Page } from "@app/pages/__Page__Page";

type AppFixtures = {
  __domain__Api: __Domain__ApiClient;
  __page__Page: __Page__Page;
  created__Domain__: __Domain__Response;
};

export const test = frameworkTest.extend<AppFixtures>({
  __domain__Api: async ({ request }, use) => {
    await use(new __Domain__ApiClient(request));
  },

  // Protected pages are built from the browser session of a configured role.
  __page__Page: async ({ authenticatedPageFor }, use) => {
    const page = await authenticatedPageFor(getRoleCredentials("user"));

    await use(new __Page__Page(page));
  },

  // Test-owned data is created through the API and removed after the test.
  created__Domain__: async ({ __domain__Api, apiTokenFor }, use) => {
    const accessToken = await apiTokenFor("user");
    const created = await __domain__Api.create__Domain__ForUser(
      create__Domain__(),
      accessToken,
    );

    await use(created);

    await __domain__Api.delete__Domain__ForUser(created.id, accessToken);
  },
});

export { expect };
