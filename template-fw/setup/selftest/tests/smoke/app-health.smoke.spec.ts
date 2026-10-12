import { test, expect } from "@app/fixtures/test-fixtures";

test.describe("Application health", { tag: "@selftest" }, () => {
  test("home page loads without server or console errors", async ({ page }) => {
    const serverErrors: string[] = [];
    const consoleErrors: string[] = [];

    page.on("response", (response) => {
      if (response.status() >= 500) {
        serverErrors.push(`${response.status()} ${response.url()}`);
      }
    });
    page.on("console", (message) => {
      if (message.type() === "error") consoleErrors.push(message.text());
    });

    const response = await page.goto("/");
    await page.waitForLoadState("load");

    expect(response?.status()).toBeLessThan(400);
    expect(serverErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });
});
