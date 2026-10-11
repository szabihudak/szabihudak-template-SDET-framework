import { test, expect } from "../../src/app/fixtures/test-fixtures";

test.describe("Login smoke tests", () => {
  test("login page is accessible", async ({ loginPage }) => {
    await loginPage.goto();

    await expect(loginPage.heading).toBeVisible();
    await expect(loginPage.emailInput).toBeVisible();
    await expect(loginPage.passwordInput).toBeVisible();
    await expect(loginPage.loginButton).toBeVisible();
  });
});
