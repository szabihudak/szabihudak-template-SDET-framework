import { test, expect } from "../../src/app/fixtures/test-fixtures";

test.describe("Authentication", () => {
  test("registered user can log in through the UI", async ({
    loginPage,
    authenticatedTestUser,
    navigation,
  }) => {
    await loginPage.goto();

    await loginPage.login(
      authenticatedTestUser.email,
      authenticatedTestUser.password,
    );

    await expect(loginPage.page).toHaveURL(/\/dashboard/);
    await expect(navigation.userMenuButton).toBeVisible();
    await expect(navigation.loginLink).not.toBeVisible();
  });
});
