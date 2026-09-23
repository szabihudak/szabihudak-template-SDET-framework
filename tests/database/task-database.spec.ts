import { createTask } from "../../src/data/taskFactory";
import { test, expect } from "../../src/fixtures/test-fixtures";

test.describe("Task database validation", () => {
  test("task is persisted with the expected data", async ({
    authenticatedTestUser,
    taskApi,
    taskDatabase,
  }) => {
    const user = authenticatedTestUser;
    const taskData = createTask();
    const createdTask = await taskApi.createTaskForUser(
      taskData,
      user.accessToken,
    );
    const taskInDb = await taskDatabase.findById(createdTask.id);

    expect(taskInDb).not.toBeNull();
    expect(taskInDb?.title).toBe(taskData.title);
    expect(taskInDb?.description).toBe(taskData.description);
    expect(taskInDb?.priority).toBe(taskData.priority);
    expect(taskInDb?.status).toBe(taskData.status);
    expect(taskInDb?.user_id).toBe(createdTask.userId);
    expect(taskInDb?.created_at).not.toBeNull();
    expect(taskInDb?.updated_at).not.toBeNull();
  });
});
