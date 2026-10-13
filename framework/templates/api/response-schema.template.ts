// @template response-schema: Provider response contract, used for runtime validation.
// @template Canonical source: src/api/schemas/TaskResponseSchema.ts. Rules: framework/docs/TESTING_STANDARDS.md#schema-standard
// @template Replace the tokens described in framework/templates/index.json. Fields, locators and test data are illustrative.
import { Type, type Static } from "@sinclair/typebox";
import { __DOMAIN___PRIORITIES, __DOMAIN___STATUSES } from "@app/api/constants/__domain__";

export const __domain__ResponseSchema = Type.Object(
  {
    id: Type.String({ format: "uuid" }),
    userId: Type.String({ format: "uuid" }),
    title: Type.String(),
    description: Type.Union([Type.String(), Type.Null()]),
    status: Type.Union(__DOMAIN___STATUSES.map((status) => Type.Literal(status))),
    priority: Type.Union(
      __DOMAIN___PRIORITIES.map((priority) => Type.Literal(priority)),
    ),
    position: Type.Integer(),
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

export type __Domain__Response = Static<typeof __domain__ResponseSchema>;
