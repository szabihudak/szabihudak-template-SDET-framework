import { createTask } from "../../src/data/taskFactory";
import { test, expect } from "../../src/fixtures/test-fixtures";
import { VISUAL_COMPARSION_OPTIONS } from "../../src/visual/constants/visualComparison";

test.describe("Visual regression", () => {
  test("authenticated dashboard matches the approved visual baseline", async ({
    taskApi,
    authenticatedTestUser,
    authenticatedPage,
    tasksDashboardPage,
  }) => {
    const task = createTask({
      title: "Visual Regression Task - Page",
      description: "Stable visual regression fixture",
      priority: "high",
      status: "done",
    });

    await taskApi.createTaskForUser(task, authenticatedTestUser.accessToken);
    await tasksDashboardPage.goto();
    await expect(tasksDashboardPage.taskCardByTitle(task.title)).toBeVisible();

    await expect(authenticatedPage).toHaveScreenshot(
      "task-dashboard.png",
      VISUAL_COMPARSION_OPTIONS,
    );
  });

  test("the task card matches the approved visual baseline", async ({
    taskApi,
    authenticatedTestUser,
    authenticatedPage,
    tasksDashboardPage,
  }) => {
    const task = createTask({
      title: "Visual Regression Task - Card",
      description: "Stable visual regression fixture",
      priority: "low",
      status: "in_progress",
    });

    await taskApi.createTaskForUser(task, authenticatedTestUser.accessToken);
    await tasksDashboardPage.goto();
    const taskCard = tasksDashboardPage.taskCardByTitle(task.title);
    await expect(taskCard).toBeVisible();

    await expect(taskCard).toHaveScreenshot(
      "task-card.png",
      VISUAL_COMPARSION_OPTIONS,
    );
  });
});
