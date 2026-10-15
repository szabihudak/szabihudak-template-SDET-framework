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
  caseId: string;
  name: string;
  missingField: keyof TaskRequest;
};

const missingTaskFieldScenarios = [
  {
    caseId: "T008_Task_API",
    name: "rejects a missing title",
    missingField: "title",
  },
] satisfies MissingTaskFieldScenario[];

const unauthenticatedScenarios = [
  {
    caseId: "T005_Task_API",
    name: "rejects task without user token",
    accessToken: "",
  },
  {
    caseId: "T006_Task_API",
    name: "rejects task with invalid user token",
    accessToken: "Invalid-Token_123",
  },
] satisfies { caseId: string; name: string; accessToken: string }[];

// unasserted: position (the API contract does not define its value on create)
test.describe("Create a Task API", () => {
  test("T001_Task_API: creates a task matching the provider contract", async ({
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

  test("T002_Task_API: defaults description to null when omitted", async ({
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

  test("T003_Task_API: defaults priority to medium when omitted", async ({
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

  test("T004_Task_API: defaults status to backlog when omitted", async ({
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

  for (const scenario of unauthenticatedScenarios) {
    test(`${scenario.caseId}: ${scenario.name}`, async ({ taskApi }) => {
      const taskData = createTask();

      const response = await taskApi.createTask(taskData, scenario.accessToken);
      expect(response.status()).toBe(HTTP_STATUS.UNAUTHORIZED);

      const body = await response.json();

      expect(body.error).toBe(API_ERRORS.UNAUTHORIZED);
    });
  }

  test("T007_Task_API: rejects task with unsupported priority", async ({
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
    test(`${scenario.caseId}: ${scenario.name}`, async ({
      taskApi,
      authenticatedTestUser,
    }) => {
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
