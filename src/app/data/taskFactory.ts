import type { TaskPriority, TaskStatus } from "../api/constants/task";
import type { TaskRequest } from "../api/schemas/TaskRequestSchema";

export type CompleteTaskRequest = Required<TaskRequest>;

type CreateTaskOptions = {
  title?: string;
  description?: string;
  priority?: TaskPriority;
  status?: TaskStatus;
};

type CreateTaskPayloadOptions = CreateTaskOptions & {
  missingFields?: (keyof TaskRequest)[];
};

export function createTask(
  options: CreateTaskOptions = {},
): CompleteTaskRequest {
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  return {
    title: options.title ?? `taskTitle_${id}`,
    description: options.description ?? `taskDescription_${id}`,
    priority: options.priority ?? "low",
    status: options.status ?? "done",
  };
}

export function createTaskPayload(
  options: CreateTaskPayloadOptions = {},
): Partial<TaskRequest> {
  const task: Partial<TaskRequest> = createTask(options);

  for (const field of options.missingFields ?? []) {
    delete task[field];
  }

  return task;
}
