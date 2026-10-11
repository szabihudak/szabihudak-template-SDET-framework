import { test, expect } from "../../src/app/fixtures/test-fixtures";
import { NavigationBar } from "../../src/app/components/NavigationBar";

test.describe("Authenticated user", () => {
  test("authenticated user sees account navigation", async ({
    authenticatedPage,
    authenticatedTestUser,
  }) => {
    const navigation = new NavigationBar(authenticatedPage);

    await expect(navigation.userMenuButton).toBeVisible();

    await navigation.openUserMenu();

    await expect(navigation.userName).toHaveText(authenticatedTestUser.name);
    await expect(navigation.userEmail).toHaveText(authenticatedTestUser.email);
    await expect(navigation.dashboardLink).toBeVisible();
    await expect(navigation.loginLink).not.toBeVisible();
  });
});
