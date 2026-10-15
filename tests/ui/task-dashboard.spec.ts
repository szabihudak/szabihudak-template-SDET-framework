import { test, expect } from "@app/fixtures/test-fixtures";
import { mockTasksServerError } from "@app/mocks/taskApiMock";

test.describe("Task Dashboard tests", () => {
  test("T001_TaskDashboard_E2E: keeps Create Task disabled until a title is entered", async ({
    tasksDashboardPage,
  }) => {
    await tasksDashboardPage.goto();
    await tasksDashboardPage.openNewTaskDialog();
    await expect(tasksDashboardPage.createTaskButton).toBeDisabled();

    await tasksDashboardPage.fillTaskTitle("UI validation task");

    await expect(tasksDashboardPage.createTaskButton).toBeEnabled();
  });

  test("T002_TaskDashboard_E2E: authenticated user sees the tasks on the dashboard", async ({
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

  test("T003_TaskDashboard_E2E: updates task priority through the edit dialog", async ({
    taskApi,
    tasksDashboardPage,
    createdTask,
    authenticatedTestUser,
  }) => {
    const taskToUpdate = createdTask.response;
    const unchangedTask = await taskApi.createTaskForUser(
      {
        title: "Priority Update Unchanged Task",
        description: "Task that should retain its original priority",
        priority: "medium",
        status: "backlog",
      },
      authenticatedTestUser.accessToken,
    );
    const updatedPriority = "high";

    await tasksDashboardPage.goto();

    await expect(
      tasksDashboardPage.taskPriority(
        taskToUpdate.title,
        taskToUpdate.priority,
      ),
    ).toHaveText(taskToUpdate.priority);
    await expect(
      tasksDashboardPage.taskPriority(
        unchangedTask.title,
        unchangedTask.priority,
      ),
    ).toHaveText(unchangedTask.priority);

    await tasksDashboardPage.updateTaskPriority(
      taskToUpdate.id,
      updatedPriority,
    );

    await expect(
      tasksDashboardPage.taskPriority(taskToUpdate.title, updatedPriority),
    ).toHaveText(updatedPriority);
    await expect(
      tasksDashboardPage.taskPriority(
        unchangedTask.title,
        unchangedTask.priority,
      ),
    ).toHaveText(unchangedTask.priority);

    await tasksDashboardPage.goto();

    await expect(
      tasksDashboardPage.taskPriority(taskToUpdate.title, updatedPriority),
    ).toHaveText(updatedPriority);
    await expect(
      tasksDashboardPage.taskPriority(
        unchangedTask.title,
        unchangedTask.priority,
      ),
    ).toHaveText(unchangedTask.priority);
  });

  test("T004_TaskDashboard_E2E: shows error state when tasks API fails", async ({
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
