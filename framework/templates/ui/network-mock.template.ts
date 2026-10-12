// @template network-mock: Controlled network behavior for one scenario, leaving other requests untouched.
// @template Canonical source: src/mocks/taskApiMock.ts. Rules: framework/docs/TESTING_STANDARDS.md#mock-standard
// @template Replace the tokens described in framework/templates/index.json. Fields, locators and test data are illustrative.
import type { Page } from "@playwright/test";

const __DOMAIN__S_API_PATTERN = "**/api/__domains__";

export async function mock__Domains__ServerError(page: Page): Promise<void> {
  await page.route(__DOMAIN__S_API_PATTERN, async (route) => {
    if (route.request().method() !== "GET") {
      await route.continue();
      return;
    }

    await route.fulfill({
      status: 500,
      contentType: "application/json",
      body: JSON.stringify({
        error: "Internal Server Error",
      }),
    });
  });
}
