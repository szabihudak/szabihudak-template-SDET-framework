import { test, expect } from "@app/fixtures/test-fixtures";

test.describe("Application smoke tests", () => {
  test("home page loads with public navigation", async ({
    homePage,
    navigation,
  }) => {
    await homePage.goto();

    await expect(navigation.logoLink).toBeVisible();
    await expect(navigation.loginLink).toBeVisible();
    await expect(navigation.registerLink).toBeVisible();
  });
});
