import { Type, type Static } from "@sinclair/typebox";
import { TASK_PRIORITIES, TASK_STATUSES } from "@app/api/constants/task";

export const taskUpdateRequestSchema = Type.Object(
  {
    title: Type.Optional(Type.String({ minLength: 1, maxLength: 200 })),
    description: Type.Optional(Type.String({ maxLength: 2000 })),
    priority: Type.Optional(
      Type.Union(TASK_PRIORITIES.map((priority) => Type.Literal(priority))),
    ),
    status: Type.Optional(
      Type.Union(TASK_STATUSES.map((status) => Type.Literal(status))),
    ),
    position: Type.Optional(Type.Integer({ minimum: 0 })),
  },
  {
    additionalProperties: false,
  },
);

export type TaskUpdateRequest = Static<typeof taskUpdateRequestSchema>;
