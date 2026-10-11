import { Type, type Static } from "@sinclair/typebox";
import { TASK_PRIORITIES, TASK_STATUSES } from "../constants/task";

export const taskResponseSchema = Type.Object(
  {
    id: Type.String(),
    userId: Type.String(),
    title: Type.String(),
    description: Type.Union([Type.String(), Type.Null()]),
    status: Type.Union(TASK_STATUSES.map((status) => Type.Literal(status))),
    priority: Type.Union(
      TASK_PRIORITIES.map((priority) => Type.Literal(priority)),
    ),
    position: Type.Number(),
    createdAt: Type.String({
      format: "date-time",
    }),
    updatedAt: Type.String({
      format: "date-time",
    }),
  },
  {
    additionalProperties: false,
  },
);

export type TaskResponse = Static<typeof taskResponseSchema>;
