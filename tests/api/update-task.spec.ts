import { randomUUID } from "node:crypto";
import { test, expect } from "@app/fixtures/test-fixtures";
import { API_ERRORS } from "@app/api/constants/apiErrors";
import { HTTP_STATUS } from "@framework/api/httpStatuses";
import type { TaskUpdateRequest } from "@app/api/schemas/TaskUpdateRequestSchema";
import { taskResponseSchema } from "@app/api/schemas/TaskResponseSchema";
import { validateSchema } from "@framework/api/SchemaValidator";
import { createTask } from "@app/data/taskFactory";

const validTitleBoundaryScenarios = [
  {
    name: "accepts a 1-character title",
    title: "T",
  },
  {
    name: "accepts a 200-character title",
    title: "T".repeat(200),
  },
] satisfies { name: string; title: string }[];

type InvalidUpdateScenario = {
  name: string;
  update: TaskUpdateRequest;
};

const invalidUpdateScenarios = [
  {
    name: "rejects an empty title",
    update: { title: "" },
  },
  {
    name: "rejects a title longer than 200 characters",
    update: { title: "T".repeat(201) },
  },
  {
    name: "rejects a description longer than 2000 characters",
    update: { description: "D".repeat(2001) },
  },
  {
    name: "rejects an unsupported priority",
    update: { priority: "critical" as TaskUpdateRequest["priority"] },
  },
  {
    name: "rejects an unsupported status",
    update: { status: "blocked" as TaskUpdateRequest["status"] },
  },
  {
    name: "rejects a negative position",
    update: { position: -1 },
  },
  {
    name: "rejects a non-integer position",
    update: { position: 1.5 },
  },
] satisfies InvalidUpdateScenario[];

const unauthenticatedScenarios = [
  {
    name: "rejects an update without an authentication token",
    accessToken: "",
  },
  {
    name: "rejects an update with an invalid authentication token",
    accessToken: "Invalid-Token_123",
  },
] satisfies { name: string; accessToken: string }[];

const taskIdScenarios = [
  {
    name: "returns not found for a nonexistent task ID",
    taskId: randomUUID(),
    expectedStatus: HTTP_STATUS.NOT_FOUND,
  },
  {
    name: "returns method not allowed when the task ID is missing",
    taskId: "",
    expectedStatus: HTTP_STATUS.METHOD_NOT_ALLOWED,
  },
] satisfies { name: string; taskId: string; expectedStatus: number }[];

test.describe("Update a Task API", () => {
  test("updates every supported task field", async ({
    taskApi,
    authenticatedTestUser,
    createdTask,
  }) => {
    const user = authenticatedTestUser;
    const updatedTask = createTask({
      title: `Updated ${createdTask.request.title}`,
      description: `Updated ${createdTask.request.description}`,
      priority: "high",
      status: "in_progress",
    });
    const position = 0;

    const response = await taskApi.updateTask(
      createdTask.response.id,
      { ...updatedTask, position },
      user.accessToken,
    );
    expect(response.status()).toBe(HTTP_STATUS.OK);

    const body = await response.json();
    validateSchema(taskResponseSchema, body);

    expect(body.id).toBe(createdTask.response.id);
    expect(body.title).toBe(updatedTask.title);
    expect(body.description).toBe(updatedTask.description);
    expect(body.priority).toBe(updatedTask.priority);
    expect(body.status).toBe(updatedTask.status);
    expect(body.position).toBe(position);
  });

  test("accepts an update when other optional fields are omitted", async ({
    taskApi,
    authenticatedTestUser,
    createdTask,
  }) => {
    const user = authenticatedTestUser;
    const response = await taskApi.updateTask(
      createdTask.response.id,
      { priority: "high" },
      user.accessToken,
    );
    expect(response.status()).toBe(HTTP_STATUS.OK);

    const body = await response.json();
    validateSchema(taskResponseSchema, body);

    expect(body.id).toBe(createdTask.response.id);
    expect(body.priority).toBe("high");
  });

  for (const scenario of validTitleBoundaryScenarios) {
    test(
      scenario.name,
      async ({ taskApi, authenticatedTestUser, createdTask }) => {
        const user = authenticatedTestUser;
        const response = await taskApi.updateTask(
          createdTask.response.id,
          { title: scenario.title },
          user.accessToken,
        );
        expect(response.status()).toBe(HTTP_STATUS.OK);

        const body = await response.json();
        validateSchema(taskResponseSchema, body);

        expect(body.title).toBe(scenario.title);
      },
    );
  }

  test("accepts a description at the 2000-character limit", async ({
    taskApi,
    authenticatedTestUser,
    createdTask,
  }) => {
    const user = authenticatedTestUser;
    const description = "D".repeat(2000);

    const response = await taskApi.updateTask(
      createdTask.response.id,
      { description },
      user.accessToken,
    );
    expect(response.status()).toBe(HTTP_STATUS.OK);

    const body = await response.json();
    validateSchema(taskResponseSchema, body);

    expect(body.description).toBe(description);
  });

  for (const scenario of invalidUpdateScenarios) {
    test(
      scenario.name,
      async ({ taskApi, authenticatedTestUser, createdTask }) => {
        const user = authenticatedTestUser;
        const response = await taskApi.updateTask(
          createdTask.response.id,
          scenario.update,
          user.accessToken,
        );
        expect(response.status()).toBe(HTTP_STATUS.BAD_REQUEST);

        const body = await response.json();
        expect(body.error).toBe(API_ERRORS.VALIDATION_FAILED);
      },
    );
  }

  for (const scenario of unauthenticatedScenarios) {
    test(scenario.name, async ({ taskApi, createdTask }) => {
      const response = await taskApi.updateTask(
        createdTask.response.id,
        { priority: "high" },
        scenario.accessToken,
      );
      expect(response.status()).toBe(HTTP_STATUS.UNAUTHORIZED);

      const body = await response.json();
      expect(body.error).toBe(API_ERRORS.UNAUTHORIZED);
    });
  }

  for (const scenario of taskIdScenarios) {
    test(scenario.name, async ({ taskApi, authenticatedTestUser }) => {
      const user = authenticatedTestUser;
      const response = await taskApi.updateTask(
        scenario.taskId,
        { priority: "high" },
        user.accessToken,
      );

      expect(response.status()).toBe(scenario.expectedStatus);
    });
  }
});
