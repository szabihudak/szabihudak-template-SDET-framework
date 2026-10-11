import { Type, type Static } from "@sinclair/typebox";
import { TASK_PRIORITIES, TASK_STATUSES } from "../constants/task";

export const taskRequestSchema = Type.Object(
  {
    title: Type.String(),
    description: Type.Optional(Type.String()),
    priority: Type.Optional(
      Type.Union(TASK_PRIORITIES.map((priority) => Type.Literal(priority))),
    ),
    status: Type.Optional(
      Type.Union(TASK_STATUSES.map((status) => Type.Literal(status))),
    ),
  },
  {
    additionalProperties: false,
  },
);

export type TaskRequest = Static<typeof taskRequestSchema>;
