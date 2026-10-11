import { test, expect } from "../../src/app/fixtures/test-fixtures";
import { getFrameworkConfig } from "../../src/framework/config/frameworkConfig";

const { auth, roles } = getFrameworkConfig();

for (const role of Object.keys(roles)) {
  test.describe(`${role} role API authentication`, { tag: "@starter" }, () => {
    test("receives an API access token", async ({ apiTokenFor }) => {
      test.skip(auth.api.strategy === "none", "API authentication is disabled");

      const accessToken = await apiTokenFor(role);

      expect(accessToken).not.toBe("");
    });
  });
}
