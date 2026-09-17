import { type APIRequestContext, type APIResponse } from "@playwright/test";

import { getCurrentEnvironment } from "../../utils/env";
import { logger } from "../../utils/logger";
import type { TaskRequest } from "../schemas/TaskRequestSchema";
import {
  type TaskResponse,
  taskResponseSchema,
} from "../schemas/TaskResponseSchema";
import { validateSchema } from "../utils/SchemaValidator";

export class TaskApiClient {
  constructor(private readonly request: APIRequestContext) {}

  async createTask(
    task: Partial<TaskRequest>,
    accessToken: string,
  ): Promise<APIResponse> {
    const { apiBaseUrl } = getCurrentEnvironment();

    return this.request.post(`${apiBaseUrl}/tasks`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      data: {
        ...task,
      },
    });
  }

  async createTaskForUser(
    task: TaskRequest,
    accessToken: string,
  ): Promise<TaskResponse> {
    logger.info(`Creating a new task: ${task.title}`);

    const response = await this.createTask(task, accessToken);

    if (!response.ok()) {
      logger.error(`Task creation failed with status ${response.status()}`);
      throw new Error(
        `Task creation failed: ${response.status()} ${await response.text()}`,
      );
    }

    const createdTask = await response.json();
    validateSchema(taskResponseSchema, createdTask);

    logger.info(`Task created successfully: ${task.title}`);

    return createdTask;
  }

  async deleteTask(taskId: string, accessToken: string): Promise<APIResponse> {
    const { apiBaseUrl } = getCurrentEnvironment();

    return this.request.delete(`${apiBaseUrl}/tasks/${taskId}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
  }

  async deleteTaskForUser(taskId: string, accessToken: string): Promise<void> {
    logger.info(`Deleting task: ${taskId}`);

    const response = await this.deleteTask(taskId, accessToken);

    if (!response.ok()) {
      logger.error(`Task deletion failed with status ${response.status()}`);

      throw new Error(
        `Task deletion failed: ${response.status()} ${await response.text()}`,
      );
    }

    logger.info(`Task deleted successfully: ${taskId}`);
  }
}
