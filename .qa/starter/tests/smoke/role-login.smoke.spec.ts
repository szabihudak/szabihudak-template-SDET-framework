import { test, expect } from "../../src/app/fixtures/test-fixtures";
import { getApiAccessToken } from "../../src/framework/auth/apiLogin";
import { getRoleCredentials } from "../../src/framework/auth/credentials";
import { getFrameworkConfig } from "../../src/framework/config/frameworkConfig";

const { auth, roles } = getFrameworkConfig();

for (const role of Object.keys(roles)) {
  test.describe(`${role} role login`, { tag: "@starter" }, () => {
    test("receives an API access token", async ({ request }) => {
      test.skip(auth.api.strategy === "none", "API authentication is disabled");

      const accessToken = await getApiAccessToken(
        request,
        getRoleCredentials(role),
      );

      expect(accessToken).not.toBe("");
    });

    test("reaches the landing page with a browser session", async ({
      authenticatedPageFor,
    }) => {
      test.skip(
        auth.browser.strategy === "none",
        "Browser authentication is disabled",
      );

      const page = await authenticatedPageFor(getRoleCredentials(role));

      await expect(page).not.toHaveURL(/login|signin/i);
    });
  });
}
