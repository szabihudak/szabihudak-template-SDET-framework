import { test, expect } from "@app/fixtures/test-fixtures";
import { HTTP_STATUS } from "@framework/api/httpStatuses";
import { API_ERRORS } from "@app/api/constants/apiErrors";
import type { TaskRequest } from "@app/api/schemas/TaskRequestSchema";
import {
  type CurrentUser,
  currentUserSchema,
} from "@app/api/schemas/CurrentUserSchema";
import { taskResponseSchema } from "@app/api/schemas/TaskResponseSchema";
import { validateSchema } from "@framework/api/SchemaValidator";
import { createTask, createTaskPayload } from "@app/data/taskFactory";
import type { UserApiClient } from "@app/api/clients/UserApiClient";

type MissingTaskFieldScenario = {
  name: string;
  missingField: keyof TaskRequest;
};

const missingTaskFieldScenarios = [
  {
    name: "rejects a missing title",
    missingField: "title",
  },
] satisfies MissingTaskFieldScenario[];

test.describe("Create a Task API", () => {
  test("creates a task matching the provider contract", async ({
    userApi,
    taskApi,
    authenticatedTestUser,
  }) => {
    const user = authenticatedTestUser;
    const currentUser = await getCurrentUser(userApi, user.accessToken);
    const taskData = createTask();

    const response = await taskApi.createTask(taskData, user.accessToken);
    expect(response.status()).toBe(HTTP_STATUS.CREATED);

    const body = await response.json();
    validateSchema(taskResponseSchema, body);

    expect(body.description).toBe(taskData.description);
    expect(body.priority).toBe(taskData.priority);
    expect(body.status).toBe(taskData.status);
    expect(body.title).toBe(taskData.title);
    expect(body.userId).toBe(currentUser.user.id);
  });

  test("defaults description to null when omitted", async ({
    userApi,
    taskApi,
    authenticatedTestUser,
  }) => {
    const user = authenticatedTestUser;
    const currentUser = await getCurrentUser(userApi, user.accessToken);
    const taskData = createTaskPayload({
      missingFields: ["description"],
    });

    const response = await taskApi.createTask(taskData, user.accessToken);
    expect(response.status()).toBe(HTTP_STATUS.CREATED);

    const body = await response.json();
    validateSchema(taskResponseSchema, body);

    expect(body.description).toBeNull();
    expect(body.priority).toBe(taskData.priority);
    expect(body.status).toBe(taskData.status);
    expect(body.title).toBe(taskData.title);
    expect(body.userId).toBe(currentUser.user.id);
  });

  test("defaults priority to medium when omitted", async ({
    userApi,
    taskApi,
    authenticatedTestUser,
  }) => {
    const user = authenticatedTestUser;
    const currentUser = await getCurrentUser(userApi, user.accessToken);
    const taskData = createTaskPayload({
      missingFields: ["priority"],
    });

    const response = await taskApi.createTask(taskData, user.accessToken);
    expect(response.status()).toBe(HTTP_STATUS.CREATED);

    const body = await response.json();
    validateSchema(taskResponseSchema, body);

    expect(body.description).toBe(taskData.description);
    expect(body.priority).toBe("medium");
    expect(body.status).toBe(taskData.status);
    expect(body.title).toBe(taskData.title);
    expect(body.userId).toBe(currentUser.user.id);
  });

  test("defaults status to backlog when omitted", async ({
    userApi,
    taskApi,
    authenticatedTestUser,
  }) => {
    const user = authenticatedTestUser;
    const currentUser = await getCurrentUser(userApi, user.accessToken);
    const taskData = createTaskPayload({
      missingFields: ["status"],
    });

    const response = await taskApi.createTask(taskData, user.accessToken);
    expect(response.status()).toBe(HTTP_STATUS.CREATED);

    const body = await response.json();
    validateSchema(taskResponseSchema, body);

    expect(body.description).toBe(taskData.description);
    expect(body.priority).toBe(taskData.priority);
    expect(body.status).toBe("backlog");
    expect(body.title).toBe(taskData.title);
    expect(body.userId).toBe(currentUser.user.id);
  });

  test("rejects task without user token", async ({ taskApi }) => {
    const taskData = createTask();

    const response = await taskApi.createTask(taskData, "");
    expect(response.status()).toBe(HTTP_STATUS.UNAUTHORIZED);

    const body = await response.json();

    expect(body.error).toBe(API_ERRORS.UNAUTHORIZED);
  });

  test("rejects task with invalid user token", async ({ taskApi }) => {
    const taskData = createTask();

    const response = await taskApi.createTask(taskData, "Invalid-Token_123");
    expect(response.status()).toBe(HTTP_STATUS.UNAUTHORIZED);

    const body = await response.json();

    expect(body.error).toBe(API_ERRORS.UNAUTHORIZED);
  });

  test("rejects task with unsupported priority", async ({
    taskApi,
    authenticatedTestUser,
  }) => {
    const user = authenticatedTestUser;
    const taskData = {
      ...createTask(),
      priority: "critical" as TaskRequest["priority"],
    };

    const response = await taskApi.createTask(taskData, user.accessToken);
    expect(response.status()).toBe(HTTP_STATUS.BAD_REQUEST);

    const body = await response.json();

    expect(body.error).toBe(API_ERRORS.VALIDATION_FAILED);
  });

  for (const scenario of missingTaskFieldScenarios) {
    test(scenario.name, async ({ taskApi, authenticatedTestUser }) => {
      const user = authenticatedTestUser;
      const taskData = createTaskPayload({
        missingFields: [scenario.missingField],
      });

      const response = await taskApi.createTask(taskData, user.accessToken);
      expect(response.status()).toBe(HTTP_STATUS.BAD_REQUEST);

      const body = await response.json();

      expect(body.error).toBe(API_ERRORS.VALIDATION_FAILED);
      expect(body.details.fieldErrors[scenario.missingField]).toEqual([
        API_ERRORS.REQUIRED_FIELD,
      ]);
    });
  }
});

async function getCurrentUser(
  userApi: UserApiClient,
  accessToken: string,
): Promise<CurrentUser> {
  const response = await userApi.getCurrentUser(accessToken);
  expect(response.status()).toBe(HTTP_STATUS.OK);

  const body = await response.json();
  validateSchema(currentUserSchema, body);
  return body;
}
