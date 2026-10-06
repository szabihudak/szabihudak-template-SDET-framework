import { test, expect } from "../../src/fixtures/test-fixtures";
import { mockTasksServerError } from "../../src/mocks/taskApiMock";

test.describe("Task Dashboard tests", () => {
  test("keeps Create Task disabled until a title is entered", async ({
    tasksDashboardPage,
  }) => {
    await tasksDashboardPage.goto();
    await tasksDashboardPage.openNewTaskDialog();
    await expect(tasksDashboardPage.createTaskButton).toBeDisabled();

    await tasksDashboardPage.fillTaskTitle("UI validation task");

    await expect(tasksDashboardPage.createTaskButton).toBeEnabled();
  });

  test("authenticated user sees the tasks on the dashboard", async ({
    tasksDashboardPage,
    createdTask,
  }) => {
    const { request } = createdTask;

    await tasksDashboardPage.goto();

    await expect(tasksDashboardPage.taskTitle(request.title)).toHaveText(
      request.title,
    );
    await expect(
      tasksDashboardPage.taskDescription(request.title, request.description),
    ).toHaveText(request.description);
    await expect(
      tasksDashboardPage.taskPriority(request.title, request.priority),
    ).toHaveText(request.priority);
  });

  test("updates task priority through the edit dialog", async ({
    tasksDashboardPage,
    createdTask,
  }) => {
    const { request, response } = createdTask;
    const updatedPriority = "high";

    await tasksDashboardPage.goto();

    await expect(
      tasksDashboardPage.taskPriority(request.title, request.priority),
    ).toHaveText(request.priority);

    await tasksDashboardPage.updateTaskPriority(response.id, updatedPriority);

    await expect(
      tasksDashboardPage.taskPriority(request.title, updatedPriority),
    ).toHaveText(updatedPriority);
  });

  test("shows error state when tasks API fails", async ({
    authenticatedPage,
    tasksDashboardPage,
  }) => {
    await mockTasksServerError(authenticatedPage);

    await tasksDashboardPage.goto();

    await expect(tasksDashboardPage.emptyColumn("backlog")).toHaveText(
      "No tasks",
    );
    await expect(tasksDashboardPage.emptyColumn("in_progress")).toHaveText(
      "No tasks",
    );
    await expect(tasksDashboardPage.emptyColumn("done")).toHaveText("No tasks");
  });
});
