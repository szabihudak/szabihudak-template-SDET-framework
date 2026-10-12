import type { Page } from "@playwright/test";

const TASKS_API_PATTERN = "**/api/tasks";

export async function mockTasksServerError(page: Page): Promise<void> {
  await page.route(TASKS_API_PATTERN, async (route) => {
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
