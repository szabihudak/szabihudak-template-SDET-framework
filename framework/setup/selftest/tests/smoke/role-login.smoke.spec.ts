import { test, expect } from "@app/fixtures/test-fixtures";
import { getRoleCredentials } from "@framework/auth/credentials";
import { getFrameworkConfig } from "@framework/config/frameworkConfig";

const { auth, roles } = getFrameworkConfig();

for (const role of Object.keys(roles)) {
  test.describe(`${role} role browser login`, { tag: "@selftest" }, () => {
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
